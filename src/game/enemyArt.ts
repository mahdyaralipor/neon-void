/* Standalone enemy-hull renderer for the codex.
 * Mirrors GameEngine.drawEnemy silhouettes (same paths, simplified details)
 * so menu icons ARE the ships you fight — no generic glyphs.
 * Pure canvas, no engine state → safe to use in React. */

import type { EnemyKind } from './types';
import { ENEMY_COLOR, isBossKind } from './enemies';

const TAU = Math.PI * 2;

/** Trace the hull body path (local space, facing +x). Must be followed by fill+stroke. */
function traceBody(ctx: CanvasRenderingContext2D, kind: EnemyKind, r: number, t: number): void {
  ctx.beginPath();
  if (kind === 'chaser' || kind === 'mirage') {
    const grow = kind === 'mirage' ? 1.25 : 1;
    ctx.moveTo(r * grow, 0);
    ctx.lineTo(-r * 0.7, r * 0.75);
    ctx.lineTo(-r * 0.7, -r * 0.75);
    ctx.closePath();
  } else if (kind === 'weaver') {
    ctx.moveTo(r + 3, 0);
    ctx.lineTo(0, r * 0.6);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.6);
    ctx.closePath();
  } else if (kind === 'dasher') {
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.8);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.8);
    ctx.closePath();
  } else if (kind === 'shooter') {
    const q = r * 0.95;
    ctx.rect(-q / 1.2, -q / 1.2, (q * 2) / 1.2, (q * 2) / 1.2);
  } else if (kind === 'sniper') {
    ctx.moveTo(r + 6, 0);
    ctx.lineTo(-r * 0.6, r * 0.45);
    ctx.lineTo(-r * 0.6, -r * 0.45);
    ctx.closePath();
  } else if (kind === 'lancer') {
    ctx.moveTo(r + 8, 0);
    ctx.lineTo(-r * 0.5, r * 0.5);
    ctx.lineTo(-r * 0.2, 0);
    ctx.lineTo(-r * 0.5, -r * 0.5);
    ctx.closePath();
  } else if (kind === 'stinger') {
    ctx.moveTo(r + 5, 0);
    ctx.lineTo(-r * 0.4, r * 0.55);
    ctx.lineTo(-r * 0.1, 0);
    ctx.lineTo(-r * 0.4, -r * 0.55);
    ctx.closePath();
  } else if (kind === 'hive' || kind === 'splitter' || kind === 'mini') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (kind === 'tank' || kind === 'juggernaut') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (kind === 'bomber' || kind === 'mender') {
    ctx.arc(0, 0, r, 0, TAU);
  } else if (kind === 'tesla') {
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.8);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.8);
    ctx.closePath();
  } else if (kind === 'mortar') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (kind === 'tempest') {
    ctx.arc(0, 0, r, 0, TAU);
  } else if (kind === 'voidborn') {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const rr = i % 2 === 0 ? r : r * 0.8;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    // boss: spiked octagon
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 === 0 ? r : r * 0.78;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  void t;
}

/** One or two signature details per hull (local space, facing +x). */
function traceDetails(ctx: CanvasRenderingContext2D, kind: EnemyKind, r: number, t: number, color: string): void {
  ctx.lineWidth = Math.max(1, r * 0.07);
  if (kind === 'chaser') {
    ctx.fillStyle = '#ffd7e4';
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, Math.max(1.5, r * 0.13), 0, TAU);
    ctx.fill();
  } else if (kind === 'mirage') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.1, 0, Math.max(1.5, r * 0.2), 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.5);
    ctx.lineTo(-r * 0.85, r * 0.85);
    ctx.moveTo(-r * 0.2, -r * 0.5);
    ctx.lineTo(-r * 0.85, -r * 0.85);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'shooter') {
    ctx.fillStyle = color;
    ctx.fillRect(r * 0.4, -3, r * 0.55, 6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.9, 0, 2, 0, TAU);
    ctx.fill();
  } else if (kind === 'sniper') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0);
    ctx.lineTo(r + 12, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 'mortar') {
    ctx.fillStyle = color;
    ctx.fillRect(r * 0.5, -4, r * 0.62, 8);
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(r * 1.05, 0, 3.2, 0, TAU);
    ctx.fill();
  } else if (kind === 'mender') {
    ctx.fillStyle = color;
    const c = r * 0.34;
    ctx.fillRect(-c, -c * 0.32, c * 2, c * 0.64);
    ctx.fillRect(-c * 0.32, -c, c * 0.64, c * 2);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'bomber') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, r * 0.22), 0, TAU);
    ctx.fill();
  } else if (kind === 'tesla') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, r * 0.2), 0, TAU);
    ctx.fill();
  } else if (kind === 'tank' || kind === 'hive' || kind === 'splitter') {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, t * 0.4, t * 0.4 + TAU * 0.8);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'tempest') {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, t * 0.8, t * 0.8 + TAU * 0.7);
    ctx.stroke();
    ctx.restore();
  } else if (isBossKind(kind)) {
    // rotating tick ring — the boss read
    ctx.save();
    ctx.rotate(t * 0.8);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
      ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
      ctx.stroke();
    }
    ctx.restore();
    if (kind === 'voidborn') {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#8b7cf6';
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = t * 40;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  // hull core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.6, r * (isBossKind(kind) ? 0.14 : 0.17)), 0, TAU);
  ctx.fill();
}

export interface EnemyArtOpts {
  /** outer glow (codex icons usually rely on CSS glow instead) */
  glow?: boolean;
  /** slow idle rotation for non-boss hulls */
  spin?: boolean;
}

/** Draw the enemy's true hull centered at (cx, cy). */
export function drawEnemyArt(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  cx: number,
  cy: number,
  r: number,
  t: number,
  opts: EnemyArtOpts = {},
): void {
  const color = ENEMY_COLOR[kind];
  const boss = isBossKind(kind);
  if (opts.glow !== false) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.4);
    g.addColorStop(0, color + '55');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  // face slightly upward like a ship on patrol; bosses hold still
  ctx.rotate(opts.spin === false ? 0 : boss ? 0 : -Math.PI / 2 + Math.sin(t * 0.7) * 0.12);
  ctx.fillStyle = '#0a0d20';
  ctx.strokeStyle = kind === 'mirage' ? color : color;
  ctx.globalAlpha = kind === 'mirage' ? 0.92 : 1;
  ctx.lineWidth = Math.max(1.4, r * (boss ? 0.09 : 0.12));
  traceBody(ctx, kind, r, t);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
  traceDetails(ctx, kind, r, t, color);
  ctx.restore();
}
