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
