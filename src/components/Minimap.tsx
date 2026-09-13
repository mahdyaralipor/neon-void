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
  boss: '#ff2244',
  gem: '#a3ff12',
  powerup: '#ffffff',
  player: '#00f0ff',
};

export default function Minimap({ dots, px, py }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef({ dots, px, py });
  useEffect(() => {
    dataRef.current = { dots, px, py };
  }, [dots, px, py]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = ref.current;
      if (cv) {
        const ctx = cv.getContext('2d');
        if (ctx) {
          const { dots: d, px: x, py: y } = dataRef.current;
          const W = cv.width;
          const H = cv.height;
          ctx.clearRect(0, 0, W, H);
          ctx.fillStyle = 'rgba(5,5,20,0.85)';
          ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(0,240,255,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
          const sx = W / WORLD_W;
          const sy = H / WORLD_H;
          for (const dot of d) {
            ctx.fillStyle = DOT_COLOR[dot.kind] ?? '#fff';
            const r = dot.kind === 'boss' ? 3.4 : dot.elite ? 2.8 : dot.kind === 'powerup' ? 2.6 : 1.6;
            if (dot.elite) {
              ctx.fillStyle = '#ffd319';
            }
            ctx.beginPath();
            ctx.arc(dot.x * sx, dot.y * sy, r, 0, Math.PI * 2);
            ctx.fill();
          }
          // player wedge
          ctx.fillStyle = '#00f0ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(x * sx, y * sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={132}
      height={102}
      className="rounded-xl border border-cyan-400/20"
      aria-label="minimap"
    />
  );
}
