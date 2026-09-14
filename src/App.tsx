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
  getMeta, getShards, buyMeta, getCheckpoint,
  type BoardEntry, type Checkpoint, type SavedSettings, type Totals,
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
  const [takenStacks, setTakenStacks] = useState<Record<string, number>>({});
  const [rerollsLeft, setRerollsLeft] = useState(1);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [pendingCheckpoint, setPendingCheckpoint] = useState<Checkpoint | null>(null);
  const [qualityToast, setQualityToast] = useState<{ q: number; key: number } | null>(null);
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
    setTakenStacks({});
    setRerollsLeft(1);
    setCheckpoint(null);
    setPendingCheckpoint(null);
    setQualityToast(null);
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

  const continueEndless = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    try {
      eng.continueEndless();
    } catch {
      return;
    }
    setResult(null);
    setPhase('playing');
  }, []);

  const continueFromCheckpoint = useCallback(() => {
    const cp = getCheckpoint();
    if (!cp) return;
    setPendingCheckpoint(cp);
    setCheckpoint(null);
    setResult(null);
    setHud(null);
    setChoices([]);
    setTakenStacks({});
    setRerollsLeft(1);
    setPhase('playing');
    setRunId((v) => v + 1);
  }, []);

  const onQualityChange = useCallback((q: number) => {
    setQualityToast({ q, key: Date.now() });
  }, []);

  // auto-dismiss the quality toast
  useEffect(() => {
    if (!qualityToast) return;
    const t = setTimeout(() => setQualityToast(null), 4000);
    return () => clearTimeout(t);
  }, [qualityToast]);

  // engine callbacks (stable wrapper via ref in GameCanvas, so plain callbacks fine)
  const onHud = useCallback((h: HudSnapshot) => setHud(h), []);
  const onLevelUp = useCallback((c: UpgradeDef[]) => {
    setChoices(c);
    const eng = engineRef.current;
    if (eng) {
      try {
        setTakenStacks(eng.getTakenStacks());
        setRerollsLeft(eng.getRerollsLeft());
      } catch {
        /* ignore */
      }
    }
    setPhase('upgrade');
  }, []);
  const onGameOver = useCallback((r: GameResult) => {
    setResult(r);
    setBest(getBest());
    setBoard(getBoard());
    setTotals(getTotals());
    setShards(getShards());
    setCheckpoint(getCheckpoint());
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
    try {
      setTakenStacks(eng.getTakenStacks());
      setRerollsLeft(eng.getRerollsLeft());
    } catch {
      /* ignore */
    }
    // engine fires onLevelUp synchronously if another level is queued
    // (upgradeLock stays true) — only return to playing when fully unlocked.
    if (!eng.pendingUpgrade) setPhase('playing');
  }, []);

  const rerollUpgrades = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const res = eng.rerollUpgrades();
    if (res) {
      try {
        setRerollsLeft(eng.getRerollsLeft());
      } catch {
        /* ignore */
      }
    }
  }, []);

  const skipUpgrade = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.skipUpgrade();
    try {
      setTakenStacks(eng.getTakenStacks());
      setRerollsLeft(eng.getRerollsLeft());
    } catch {
      /* ignore */
    }
    if (!eng.pendingUpgrade) setPhase('playing');
  }, []);

  // number keys for upgrades (1/2/3 pick, 0 skip)
  useEffect(() => {
    if (phase !== 'upgrade') return;
    const fn = (e: KeyboardEvent) => {
      const idx = ['1', '2', '3'].indexOf(e.key);
      if (idx >= 0 && choices[idx]) pickUpgrade(choices[idx].id);
      else if (e.key === '0') skipUpgrade();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [phase, choices, pickUpgrade, skipUpgrade]);

  const pausedForEngine = phase === 'paused' || phase === 'upgrade' || (screen === 'game' && showSettings);

  // sync build snapshot whenever the player opens pause (cheap, on-demand)
  useEffect(() => {
    if (phase === 'paused' && engineRef.current) {
      try {
        setTakenStacks(engineRef.current.getTakenStacks());
      } catch {
        /* ignore */
      }
    }
  }, [phase]);

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
            onToggleCoop={() => updateSettings({ ...settings, coOp: !settings.coOp })}
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
            checkpoint={pendingCheckpoint}
            paused={pausedForEngine}
            callbacks={{ onHud, onLevelUp, onGameOver, onWave, onPauseKey, onQualityChange }}
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
              onOpenSettings={() => setShowSettings(true)}
            />
          )}

          {/* bottom-left hint */}
          {phase === 'playing' && (
            <div className="font-display pointer-events-none absolute bottom-3 left-3 z-20 hidden text-[10px] tracking-[0.14em] text-slate-600 md:block" dir="ltr">
              {settings.coOp ? 'P1 WASD · MOUSE · SHIFT DASH — P2 ARROWS · ENTER DASH' : 'WASD MOVE · MOUSE AIM · SHIFT DASH · P PAUSE'}
            </div>
          )}

          {/* first-run coach — three quiet hints, gone after 12s */}
          {phase === 'playing' && totals.runs === 0 && hud && hud.time < 12 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center px-4">
              <div className="anim-rise flex flex-wrap items-center justify-center gap-1.5">
                <span className="chip !bg-black/60 !text-[11px] backdrop-blur-md">حرکت با WASD</span>
                <span className="chip !bg-black/60 !text-[11px] backdrop-blur-md">شلیک خودکار است — فقط aim بگیر</span>
                <span className="chip !bg-black/60 !text-[11px] backdrop-blur-md">Shift دش می‌زند</span>
                {settings.coOp && (
                  <span className="chip !bg-black/60 !text-[11px] backdrop-blur-md">P2: جهت‌نما + Enter</span>
                )}
              </div>
            </div>
          )}

          {phase === 'upgrade' && choices.length > 0 && (
            <UpgradeModal
              choices={choices}
              level={hud?.level ?? 1}
              taken={takenStacks}
              rerollsLeft={rerollsLeft}
              onPick={pickUpgrade}
              onReroll={rerollUpgrades}
              onSkip={skipUpgrade}
            />
          )}

          {phase === 'paused' && (
            <PauseMenu
              muted={settings.muted}
              hud={hud}
              taken={takenStacks}
              onResume={() => setPhase('playing')}
              onRestart={startGame}
              onMenu={goMenu}
              onToggleMute={() => updateSettings({ ...settings, muted: !settings.muted })}
            />
          )}

          {phase === 'gameover' && result && (
            <GameOver
              result={result}
              best={best}
              board={board}
              onRetry={startGame}
              onMenu={goMenu}
              onEndless={result.victory && !result.endless ? continueEndless : undefined}
              checkpointWave={
                !result.victory && checkpoint && checkpoint.wave >= 5 &&
                checkpoint.wave < result.wave && checkpoint.ship === settings.ship
                  ? checkpoint.wave
                  : null
              }
              onCheckpoint={continueFromCheckpoint}
            />
          )}

          {/* auto-quality toast — the game tells you instead of silently degrading */}
          {qualityToast && phase === 'playing' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
              <div key={qualityToast.key} className="anim-announce chip !border-amber-200/25 !bg-black/70 !text-[12px] !text-amber-100 backdrop-blur-md">
                ⚡ {qualityToast.q >= 3 ? 'حالت سبک فعال شد — روان ولی کم‌افکت‌تر' : qualityToast.q === 2 ? 'حالت عملکرد فعال شد — تعادل سرعت و کیفیت' : 'کیفیت متعادل فعال شد'}
              </div>
            </div>
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
