import { useEffect, useRef } from 'react';
import type { EnemyKind } from '../game/types';
import { ENEMY_COLOR } from '../game/enemies';
import { drawEnemyArt } from '../game/enemyArt';

interface Props {
  kind: EnemyKind;
  /** css px */
  size?: number;
}

/** The enemy's real hull, rendered on canvas — no generic glyphs. */
export default function EnemyIcon({ kind, size = 40 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const r = size * (kind === 'mini' ? 0.2 : 0.3);
    drawEnemyArt(ctx, kind, size / 2, size / 2, r, 1.2, { glow: false });
  }, [kind, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, filter: `drop-shadow(0 0 6px ${ENEMY_COLOR[kind]}66)` }}
      aria-hidden
    />
  );
}
