import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';
import type { EngineCallbacks, EngineOptions } from '../game/types';
import type { SavedSettings } from '../game/storage';

interface Props {
  settings: SavedSettings;
  paused: boolean;
  callbacks: EngineCallbacks;
  onEngine: (e: GameEngine | null) => void;
}

export default function GameCanvas({ settings, paused, callbacks, onEngine }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // create engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stable: EngineCallbacks = {
      onHud: (h) => cbRef.current.onHud(h),
      onLevelUp: (c) => cbRef.current.onLevelUp(c),
      onGameOver: (r) => cbRef.current.onGameOver(r),
      onWave: (w) => cbRef.current.onWave(w),
      onPauseKey: () => cbRef.current.onPauseKey(),
    };
    const opts: EngineOptions = {
      difficulty: settings.difficulty,
      particleScale: settings.particles,
      shakeEnabled: settings.shake,
      muted: settings.muted,
      ship: settings.ship,
      autoQuality: settings.autoQuality,
    };
    const engine = new GameEngine(canvas, stable, opts);
    engineRef.current = engine;
    engine.setVolumes(settings.musicVol, settings.sfxVol);
    onEngine(engine);
    // unlock audio on first interaction
    const unlock = () => {
      try {
        engine.setMuted(settings.muted);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    engine.start();
    return () => {
      window.removeEventListener('pointerdown', unlock);
      engine.destroy();
      engineRef.current = null;
      onEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pause sync
  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  // settings sync
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setMuted(settings.muted);
    e.setParticleScale(settings.particles);
    e.setShakeEnabled(settings.shake);
    e.setVolumes(settings.musicVol, settings.sfxVol);
    e.setAutoQuality(settings.autoQuality);
  }, [settings.muted, settings.particles, settings.shake, settings.musicVol, settings.sfxVol, settings.autoQuality]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="game-canvas absolute inset-0" />
    </div>
  );
}
