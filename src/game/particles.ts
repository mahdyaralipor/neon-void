/* Pooled particle / shockwave / floating-text / starfield system. */

import { rand, TAU } from './utils';

export interface Cam {
  x: number;
  y: number;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  shape: number; // 0 circle, 1 spark(line), 2 square
}

interface Shockwave {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

interface FloatText {
  alive: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

const MAX_P = 700;

export class ParticleSystem {
  private pool: Particle[] = [];
  private waves: Shockwave[] = [];
  private texts: FloatText[] = [];
  private stars: Star[] = [];
  private cursor = 0;
  scale = 1;
  /** 0 cinematic · 1 balanced · 2 performance · 3 potato — set by engine */
  quality = 0;

  setQuality(q: number): void {
    this.quality = Math.max(0, Math.min(3, Math.round(q)));
  }

  /** visible star count shrinks on weak GPUs — cheap fill-rate win */
  get starCount(): number {
    return this.quality === 0 ? 140 : this.quality === 1 ? 100 : this.quality === 2 ? 65 : 38;
  }

  constructor() {
    for (let i = 0; i < MAX_P; i++) {
      this.pool.push({
        alive: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 2, color: '#fff', drag: 1, shape: 0,
      });
    }
    for (let i = 0; i < 26; i++) {
      this.waves.push({ alive: false, x: 0, y: 0, r: 0, maxR: 100, life: 0, maxLife: 1, color: '#fff', width: 3 });
    }
    for (let i = 0; i < 96; i++) {
      this.texts.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 14 });
    }
    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: Math.random() * 3000, y: Math.random() * 2400, z: rand(0.2, 1) });
    }
  }

  /** rotating-cursor alloc: O(1) typical case instead of full-pool scan */
  private alloc(): Particle | null {
    for (let i = 0; i < MAX_P; i++) {
      this.cursor = (this.cursor + 1) % MAX_P;
      const p = this.pool[this.cursor];
      if (!p.alive) return p;
    }
    return null;
  }

  explosion(x: number, y: number, color: string, count: number, power = 320): void {
    // juice preserved via bigger/faster sparks, not just more of them —
    // low quality keeps the core flash + fewer satellites so kills still pop.
    const juice = this.quality <= 1 ? 1.6 : this.quality === 2 ? 1.1 : 0.8;
    const n = Math.round(count * this.scale * juice);
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = rand(power * 0.15, power * 1.25);
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = rand(0.4, 1.0);
      p.life = p.maxLife;
      p.size = rand(1.8, 5.5);
      p.color = Math.random() < 0.35 ? '#ffffff' : color;
      p.drag = 2.8;
      p.shape = Math.random() < 0.45 ? 1 : 0;
    }
    // hot core flash — always kept, even on potato (1 sprite = cheap pop)
    const core = this.alloc();
    if (core) {
      core.alive = true;
      core.x = x; core.y = y;
      core.vx = 0; core.vy = 0;
      core.maxLife = 0.22; core.life = 0.22;
      core.size = this.quality >= 3 ? 7 : 9;
      core.color = '#ffffff';
      core.drag = 1;
      core.shape = 0;
    }
  }

  /** small directional impact sparks on every bullet hit */
  hitSpark(x: number, y: number, angle: number, color: string): void {
    const n = Math.max(2, Math.round(4 * this.scale));
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = angle + rand(-0.9, 0.9);
      const sp = rand(180, 520);
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = rand(0.15, 0.35); p.life = p.maxLife;
      p.size = rand(1.5, 3.4);
      p.color = Math.random() < 0.4 ? '#ffffff' : color;
      p.drag = 5;
      p.shape = 1;
    }
  }

  /** dash afterimage burst */
  dashBurst(x: number, y: number, angle: number, color: string): void {
    const n = Math.max(4, Math.round(10 * this.scale));
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = angle + Math.PI + rand(-0.6, 0.6);
      const sp = rand(80, 320);
      p.alive = true;
      p.x = x + rand(-6, 6); p.y = y + rand(-6, 6);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = rand(0.25, 0.55); p.life = p.maxLife;
      p.size = rand(2, 4.2);
      p.color = i % 3 === 0 ? '#ffffff' : color;
      p.drag = 3.4;
      p.shape = 0;
    }
  }

  /** level-up ring explosion */
  levelUp(x: number, y: number): void {
    this.shockwave(x, y, '#00f0ff', 170, 0.6, 6);
    this.shockwave(x, y, '#ffffff', 110, 0.45, 3);
    this.explosion(x, y, '#00f0ff', 34, 420);
    this.explosion(x, y, '#ffd319', 14, 300);
  }

  /** victory / big-boss confetti storm */
  confetti(x: number, y: number, count = 60): void {
    const colors = ['#00f0ff', '#ff2d78', '#ffd319', '#a3ff12', '#b14bff', '#ffffff'];
    const n = Math.round(count * this.scale);
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = rand(120, 640);
      p.alive = true;
      p.x = x + rand(-20, 20); p.y = y + rand(-20, 20);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 160;
      p.maxLife = rand(0.8, 1.8); p.life = p.maxLife;
      p.size = rand(2, 5);
      p.color = colors[i % colors.length];
      p.drag = 1.6;
      p.shape = 2;
    }
  }

  trail(x: number, y: number, color: string): void {
    if (Math.random() > 0.6 * this.scale + 0.15) return;
    const p = this.alloc();
    if (!p) return;
    p.alive = true;
    p.x = x + rand(-4, 4); p.y = y + rand(-4, 4);
    p.vx = rand(-40, 40); p.vy = rand(-40, 40);
    p.maxLife = rand(0.2, 0.45); p.life = p.maxLife;
    p.size = rand(1, 2.6);
    p.color = color;
    p.drag = 2;
    p.shape = 0;
  }

  muzzle(x: number, y: number, angle: number, color: string): void {
    const n = Math.max(1, Math.round(3 * this.scale));
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = angle + rand(-0.5, 0.5);
      const sp = rand(120, 300);
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = rand(0.12, 0.25); p.life = p.maxLife;
      p.size = rand(1.5, 3);
      p.color = color;
      p.drag = 4;
      p.shape = 1;
    }
  }

  pickupBurst(x: number, y: number, color = '#a3ff12'): void {
    const n = Math.max(2, Math.round(6 * this.scale));
    for (let i = 0; i < n; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = rand(60, 220);
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = rand(0.25, 0.5); p.life = p.maxLife;
      p.size = rand(1.2, 2.8);
      p.color = color;
      p.drag = 3;
      p.shape = 0;
    }
  }

  shockwave(x: number, y: number, color: string, maxR = 120, life = 0.45, width = 4): void {
    const w = this.waves.find((s) => !s.alive);
    if (!w) return;
    w.alive = true;
    w.x = x; w.y = y; w.r = 6;
    w.maxR = maxR;
    w.life = life; w.maxLife = life;
    w.color = color;
    w.width = width;
  }

  text(x: number, y: number, text: string, color = '#fff', size = 14): void {
    const t = this.texts.find((s) => !s.alive);
    if (!t) return;
    t.alive = true;
    t.x = x + rand(-8, 8); t.y = y - 10;
    t.life = 0.9; t.maxLife = 0.9;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const w of this.waves) {
      if (!w.alive) continue;
      w.life -= dt;
      if (w.life <= 0) {
        w.alive = false;
        continue;
      }
      const t = 1 - w.life / w.maxLife;
      const e = 1 - (1 - t) * (1 - t);
      w.r = 6 + (w.maxR - 6) * e;
    }
    for (const t of this.texts) {
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) t.alive = false;
      else t.y -= 46 * dt;
    }
  }

  drawStars(ctx: CanvasRenderingContext2D, cam: Cam, vw: number, vh: number): void {
    ctx.save();
    const wSpan = vw + 100;
    const hSpan = vh + 100;
    const t = performance.now() / 1000;
    const n = Math.min(this.stars.length, this.starCount);
    const twinkle = this.quality >= 2 ? 1 : 0; // potato skips sin twinkle
    for (let i = 0; i < n; i++) {
      const s = this.stars[i];
      const drift = 0.25 + s.z * 0.35;
      const x = (((s.x - cam.x * drift) % wSpan) + wSpan) % wSpan - 50;
      const y = (((s.y - cam.y * drift) % hSpan) + hSpan) % hSpan - 50;
      if (twinkle === 0) {
        const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + s.z) + s.x * 0.05);
        ctx.globalAlpha = (0.16 + s.z * 0.4) * tw;
      } else {
        ctx.globalAlpha = 0.16 + s.z * 0.4;
      }
      ctx.fillStyle = s.z > 0.8 ? '#c8ecff' : '#e8ecf5';
      const sz = 0.8 + s.z * 1.3;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, cam?: Cam, vw?: number, vh?: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cheap = this.quality >= 2;
    // cull margin so offscreen fireworks cost nothing on weak chips
    const hasCull = cam !== undefined && vw !== undefined && vh !== undefined;
    const x0 = hasCull ? cam!.x - 60 : 0;
    const y0 = hasCull ? cam!.y - 60 : 0;
    const x1 = hasCull ? cam!.x + vw! + 60 : 0;
    const y1 = hasCull ? cam!.y + vh! + 60 : 0;
    for (const p of this.pool) {
      if (!p.alive) continue;
      if (hasCull && (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1)) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      if (p.shape === 1) {
        if (cheap) {
          // potato: axis-aligned streak, no save/rotate (2-3x faster)
          ctx.fillRect(p.x - 3, p.y - 1, 6, 2);
        } else {
          const len = 1 + (1 - t) * 8;
          const a = Math.atan2(p.vy, p.vx);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(a);
          ctx.fillRect(-len / 2, -p.size / 2, len, p.size);
          ctx.restore();
        }
      } else if (p.shape === 2) {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        if (cheap && p.size < 3) {
          const s = p.size * (0.4 + t * 0.6);
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, TAU);
          ctx.fill();
        }
      }
    }
    for (const w of this.waves) {
      if (!w.alive) continue;
      const t = w.life / w.maxLife;
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width * t + 0.5;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // floating texts (normal blending, sharp)
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      if (!t.alive) continue;
      const a = Math.min(1, (t.life / t.maxLife) * 2);
      ctx.globalAlpha = a * 0.92;
      ctx.font = `600 ${t.size}px Orbitron, Vazirmatn, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(3,4,12,0.65)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
