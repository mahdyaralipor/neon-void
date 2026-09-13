import { useEffect, useRef } from 'react';
import type { MinimapDot } from '../game/types';
import { WORLD_W, WORLD_H } from '../game/engine';

interface Props {
  dots: MinimapDot[];
  px: number;
  py: number;
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
  boss: '#ff2244',
  gem: '#a3ff12',
  powerup: '#ffffff',
  player: '#00f0ff',
};

const W = 132;
const H = 102;

export default function Minimap({ dots, px, py }: Props) {
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
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    const sx = W / WORLD_W;
    const sy = H / WORLD_H;
    for (const dot of dots) {
      ctx.fillStyle = dot.elite ? '#ffd319' : (DOT_COLOR[dot.kind] ?? '#fff');
      const r = dot.kind === 'boss' ? 3.4 : dot.elite ? 2.8 : dot.kind === 'powerup' ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.arc(dot.x * sx, dot.y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // player dot (plain, no per-frame shadowBlur)
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(px * sx, py * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,240,255,0.25)';
    ctx.beginPath();
    ctx.arc(px * sx, py * sy, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }, [dots, px, py]);

  return (
    <canvas
      ref={ref}
      style={{ width: W, height: H }}
      className="rounded-xl border border-cyan-400/20"
      aria-label="minimap"
    />
  );
}
