import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import UpgradeModal from './components/UpgradeModal';
import GameOver from './components/GameOver';
import PauseMenu from './components/PauseMenu';
import SettingsModal from './components/SettingsModal';
import LabModal from './components/LabModal';
import type { GameEngine } from './game/engine';
import type { GameResult, HudSnapshot, UpgradeDef, ShipId, MetaLevels } from './game/types';
import {
  getBest, getBoard, getSettings, getTotals, saveSettings,
  getMeta, getShards, buyMeta,
  type BoardEntry, type SavedSettings, type Totals,
} from './game/storage';

type Screen = 'menu' | 'game';
type Phase = 'playing' | 'upgrade' | 'paused' | 'gameover';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [phase, setPhase] = useState<Phase>('playing');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [choices, setChoices] = useState<UpgradeDef[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [best, setBest] = useState<number>(() => getBest());
  const [board, setBoard] = useState<BoardEntry[]>(() => getBoard());
  const [totals, setTotals] = useState<Totals>(() => getTotals());
  const [settings, setSettings] = useState<SavedSettings>(() => getSettings());
  const [meta, setMeta] = useState<MetaLevels>(() => getMeta());
  const [shards, setShards] = useState<number>(() => getShards());
  const [showSettings, setShowSettings] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [runId, setRunId] = useState(0);
  const engineRef = useRef<GameEngine | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const updateSettings = useCallback((s: SavedSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const buyTrack = useCallback((track: keyof MetaLevels) => {
    const res = buyMeta(track);
    if (res) {
      setMeta(res.meta);
      setShards(res.shards);
    }
  }, []);

  const refreshWallet = useCallback(() => {
    setMeta(getMeta());
    setShards(getShards());
  }, []);

  const startGame = useCallback(() => {
    setResult(null);
    setHud(null);
    setChoices([]);
    setPhase('playing');
    setScreen('game');
    setRunId((v) => v + 1);
  }, []);

  const goMenu = useCallback(() => {
    setScreen('menu');
    setPhase('playing');
    setResult(null);
    setHud(null);
    setChoices([]);
    setBest(getBest());
    setBoard(getBoard());
    setTotals(getTotals());
    setMeta(getMeta());
    setShards(getShards());
  }, []);

  // engine callbacks (stable wrapper via ref in GameCanvas, so plain callbacks fine)
  const onHud = useCallback((h: HudSnapshot) => setHud(h), []);
  const onLevelUp = useCallback((c: UpgradeDef[]) => {
    setChoices(c);
    setPhase('upgrade');
  }, []);
  const onGameOver = useCallback((r: GameResult) => {
    setResult(r);
    setBest(getBest());
    setBoard(getBoard());
    setTotals(getTotals());
    setShards(getShards());
    setPhase('gameover');
  }, []);
  const onWave = useCallback(() => {
    /* canvas banner + sfx already handled in engine */
  }, []);
  const onPauseKey = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'playing') setPhase('paused');
    else if (p === 'paused') setPhase('playing');
  }, []);

  const pickUpgrade = useCallback((id: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.applyUpgrade(id);
    // engine fires onLevelUp synchronously if another level is queued
    // (upgradeLock stays true) — only return to playing when fully unlocked.
    if (!eng.pendingUpgrade) setPhase('playing');
  }, []);

  // number keys for upgrades
  useEffect(() => {
    if (phase !== 'upgrade') return;
    const fn = (e: KeyboardEvent) => {
      const idx = ['1', '2', '3'].indexOf(e.key);
      if (idx >= 0 && choices[idx]) pickUpgrade(choices[idx].id);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [phase, choices, pickUpgrade]);

  const pausedForEngine = phase === 'paused' || phase === 'upgrade';

  return (
    <div className="h-full min-h-screen bg-[#050514] text-slate-100" dir="rtl">
      {screen === 'menu' && (
        <div className="min-h-screen">
          <MainMenu
            best={best}
            board={board}
            totals={totals}
            settings={settings}
            shards={shards}
            meta={meta}
            onPlay={startGame}
            onOpenSettings={() => setShowSettings(true)}
            onOpenLab={() => setShowLab(true)}
            onToggleMute={() => updateSettings({ ...settings, muted: !settings.muted })}
            onSelectShip={(s: ShipId) => updateSettings({ ...settings, ship: s })}
          />
          {showSettings && (
            <SettingsModal
              settings={settings}
              onChange={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
          {showLab && (
            <LabModal
              meta={meta}
              shards={shards}
              onBuy={buyTrack}
              onClose={() => {
                setShowLab(false);
                refreshWallet();
              }}
            />
          )}
        </div>
      )}

      {screen === 'game' && (
        <div className="relative h-screen w-full overflow-hidden">
          <GameCanvas
            key={runId}
            settings={settings}
            meta={meta}
            paused={pausedForEngine}
            callbacks={{ onHud, onLevelUp, onGameOver, onWave, onPauseKey }}
            onEngine={(e) => {
              engineRef.current = e;
            }}
          />

          {hud && phase !== 'gameover' && (
            <HUD
              hud={hud}
              muted={settings.muted}
              showFps={settings.showFps}
              gameSpeed={settings.gameSpeed}
              onPause={() => setPhase('paused')}
              onMute={() => updateSettings({ ...settings, muted: !settings.muted })}
              onDash={() => engineRef.current?.tryDash()}
            />
          )}

          {/* bottom-left hint */}
          {phase === 'playing' && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden text-[11px] text-slate-500 md:block" dir="ltr">
              WASD move · mouse aim · SHIFT dash · P pause
            </div>
          )}

          {phase === 'upgrade' && choices.length > 0 && (
            <UpgradeModal choices={choices} level={hud?.level ?? 1} onPick={pickUpgrade} />
          )}

          {phase === 'paused' && (
            <PauseMenu
              muted={settings.muted}
              onResume={() => setPhase('playing')}
              onRestart={startGame}
              onMenu={goMenu}
              onToggleMute={() => updateSettings({ ...settings, muted: !settings.muted })}
            />
          )}

          {phase === 'gameover' && result && (
            <GameOver result={result} best={best} board={board} onRetry={startGame} onMenu={goMenu} />
          )}

          {showSettings && screen === 'game' && (
            <SettingsModal
              settings={settings}
              onChange={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
