import { useEffect, useRef } from 'react';
import type { EnemyKind, MinimapDot } from '../game/types';
import { WORLD_W, WORLD_H } from '../game/engine';
import { isBossKind } from '../game/enemies';

interface Props {
  dots: MinimapDot[];
  players: { x: number; y: number }[];
}

const DOT_COLOR: Record<string, string> = {
  chaser: '#ff2d78',
  weaver: '#ff9f1c',
  dasher: '#ffcf1c',
  shooter: '#b14bff',
  splitter: '#3dff8e',
  mini: '#7dff6a',
  sniper: '#ff5df2',
  tank: '#ff6b35',
  lancer: '#2dd4bf',
  hive: '#fbbf24',
  stinger: '#5df2ff',
  bomber: '#f43f5e',
  tesla: '#93c5fd',
  mortar: '#cbd5e1',
  mender: '#bef264',
  mirage: '#a5f3fc',
  boss: '#ff2244',
  juggernaut: '#ff5d00',
  tempest: '#d8b4fe',
  voidborn: '#ddd6fe',
  gem: '#a3ff12',
  powerup: '#ffffff',
  player: '#00f0ff',
};

const W = 132;
const H = 102;

export default function Minimap({ dots, players }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  // prop-driven redraw (was: always-on 60fps rAF loop) + DPR-sharp canvas
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 10);
    ctx.fill();
    const sx = W / WORLD_W;
    const sy = H / WORLD_H;
    for (const dot of dots) {
      ctx.fillStyle = dot.elite ? '#e8e4d8' : (DOT_COLOR[dot.kind] ?? '#fff');
      ctx.globalAlpha = dot.kind === 'gem' ? 0.55 : 0.9;
      const r = isBossKind(dot.kind as EnemyKind) ? 3 : dot.elite ? 2.4 : dot.kind === 'powerup' ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(dot.x * sx, dot.y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // pilot dots — soft white cores (P1 + P2 in co-op)
    for (const pl of players) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(pl.x * sx, pl.y * sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(pl.x * sx, pl.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [dots, players]);

  return (
    <canvas
      ref={ref}
      style={{ width: W, height: H }}
      className="rounded-xl border border-white/10 opacity-90"
      aria-label="minimap"
    />
  );
}
