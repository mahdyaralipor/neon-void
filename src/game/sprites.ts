/* Baked glow sprites — replaces per-entity shadowBlur in the hot loop.
   A radial-gradient sprite per color is drawn with drawImage (fast),
   while vector shapes are stroked/filled with shadows disabled. */

const cache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string): HTMLCanvasElement {
  const hit = cache.get(color);
  if (hit) return hit;
  // normalize to 6-digit hex so alpha suffixes stay valid
  let hex = color;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, hex);
    g.addColorStop(0.35, hex + 'AA');
    g.addColorStop(1, hex + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  cache.set(color, c);
  return c;
}

/** draw a glow disc centered at (x, y) with the given radius */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
): void {
  const s = glowSprite(color);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

export function clearSpriteCache(): void {
  cache.clear();
}

let gemSpr: HTMLCanvasElement | null = null;
const gemTierSpr: (HTMLCanvasElement | null)[] = [null, null, null];

function bakeGem(glow: string, light: string, mid: string): HTMLCanvasElement {
  const S = 32;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, glow);
    g.addColorStop(0.5, glow.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, glow.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = light;
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
    ctx.fillStyle = mid;
    ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
    ctx.restore();
  }
  return c;
}

/** Baked XP-gem sprite (diamond + glow) — drawn with a single drawImage, no save/rotate. */
export function gemSprite(): HTMLCanvasElement {
  if (gemSpr) return gemSpr;
  gemSpr = bakeGem('rgba(163,255,18,0.9)', '#c8ff4d', '#a3ff12');
  return gemSpr;
}

/** Tiered gems by value: 0 small green, 1 blue, 2 gold. Cached, zero per-frame cost. */
export function gemSpriteTier(tier: number): HTMLCanvasElement {
  const t = tier <= 0 ? 0 : tier === 1 ? 1 : 2;
  const hit = gemTierSpr[t];
  if (hit) return hit;
  const spr =
    t === 0
      ? bakeGem('rgba(163,255,18,0.9)', '#c8ff4d', '#a3ff12')
      : t === 1
        ? bakeGem('rgba(125,211,252,0.9)', '#d9f4ff', '#7dd3fc')
        : bakeGem('rgba(255,211,25,0.9)', '#fff3c4', '#ffd319');
  gemTierSpr[t] = spr;
  return spr;
}

/** 0/1/2 tier from gem value — keeps the field readable at a glance. */
export function gemTierFor(val: number): number {
  return val >= 20 ? 2 : val >= 10 ? 1 : 0;
}
