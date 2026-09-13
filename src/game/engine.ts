/* NEON VOID — custom arena-survival engine.
   Fixed-clamp loop, camera + shake + slow-mo, spatial-collected collisions,
   7 enemy AIs, wave director, dash, combo, gems, boss patterns. */

import type {
  Difficulty,
  EngineCallbacks,
  EngineOptions,
  EnemyKind,
  GameResult,
  Grade,
  HudSnapshot,
  PlayerStats,
  PowerUpKind,
  MinimapDot,
} from './types';
import { statsForShip } from './types';
import { SynthAudio } from './audio';
import { ParticleSystem } from './particles';
import {
  applyUpgrade, rollUpgrades, executionerMult, comboScoreMult, comboWindow, thornsDamage,
} from './upgrades';
import { angleTo, clamp, dist2, rand, TAU } from './utils';
import { saveBest, pushBoard, addTotals } from './storage';

export const WORLD_W = 2600;
export const WORLD_H = 2000;

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number; y: number; vx: number; vy: number;
  r: number;
  hp: number; maxHp: number;
  speed: number;
  dmg: number;
  xp: number;
  score: number;
  t: number;
  flash: number;
  fireCd: number;
  state: number;
  stateT: number;
  lockDx: number; lockDy: number;
  strafe: number;
  kx: number; ky: number;
  elite: boolean;
  orbHitCd: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  crit: boolean;
  friendly: boolean;
  dead: boolean;
  hit: Set<number>;
}

interface Gem {
  x: number; y: number; vx: number; vy: number;
  val: number;
  t: number;
}

interface PowerUp {
  x: number; y: number; vx: number; vy: number;
  kind: PowerUpKind;
  t: number;
  life: number;
}

interface Ghost {
  x: number; y: number; aim: number; life: number;
}

interface Stick {
  active: boolean;
  id: number;
  ox: number; oy: number;
  dx: number; dy: number;
}

const DIFF: Record<Difficulty, { hp: number; dmg: number; speed: number; quota: number; interval: number }> = {
  easy: { hp: 0.7, dmg: 0.7, speed: 0.92, quota: 0.8, interval: 1.25 },
  normal: { hp: 1, dmg: 1, speed: 1, quota: 1, interval: 1 },
  hard: { hp: 1.38, dmg: 1.28, speed: 1.06, quota: 1.25, interval: 0.82 },
  insane: { hp: 1.85, dmg: 1.65, speed: 1.13, quota: 1.55, interval: 0.66 },
};

const ENEMY_COLOR: Record<EnemyKind, string> = {
  chaser: '#ff2d78',
  weaver: '#ff9f1c',
  dasher: '#ffcf1c',
  shooter: '#b14bff',
  splitter: '#3dff8e',
  mini: '#7dff6a',
  sniper: '#ff5df2',
  tank: '#ff6b35',
  boss: '#ff2244',
};

const POWERUP_COLOR: Record<PowerUpKind, string> = {
  shield: '#00e5ff',
  magnet: '#b14bff',
  nuke: '#ff5d2a',
  overdrive: '#ffd319',
  heal: '#3dff8e',
};

const POWERUP_FA: Record<PowerUpKind, string> = {
  shield: 'سپر انرژی!',
  magnet: 'مگنت همگانی!',
  nuke: 'انفجار هسته‌ای!',
  overdrive: 'اور‌درایو!',
  heal: '+۴۰ جان!',
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private opts: EngineOptions;
  private audio = new SynthAudio();
  private fx = new ParticleSystem();

  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private upgradeLock = false;
  private destroyed = false;

  private viewW = 1280;
  private viewH = 800;
  private dpr = 1;

  // input
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseSeen = false;
  private leftStick: Stick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  private rightStick: Stick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };

  // player
  private px = WORLD_W / 2;
  private py = WORLD_H / 2;
  private pvx = 0;
  private pvy = 0;
  private aim = 0;
  private hp = 100;
  private fireCd = 0;
  private dashCd = 0;
  private dashT = 0;
  private dashDx = 1;
  private dashDy = 0;
  private invuln = 0;
  private stats: PlayerStats = statsForShip('vanguard');

  // run state
  private time = 0;
  private kills = 0;
  private elites = 0;
  private score = 0;
  private level = 1;
  private xp = 0;
  private xpNext = 30;
  private combo = 0;
  private comboT = 0;
  private maxCombo = 0;
  private wave = 1;
  private waveKills = 0;
  private waveQuota = 10;
  private intermission = 0;
  private spawnT = 0;
  private pendingLevels = 0;
  private taken = new Map<string, number>();
  private boss: Enemy | null = null;
  private nextId = 1;
  private deathT = -1;
  private gameOverSent = false;
  private waveBannerT = 0;
  private trauma = 0;
  private slowmoT = 0;
  private hitstopT = 0;
  private hudAcc = 1;
  // v2 juice & systems
  private announce: string | null = null;
  private announceT = 0;
  private gridPulse = 0;
  private orbitalAngle = 0;
  private shieldT = 0;
  private overdriveT = 0;
  private magnetAllT = 0;
  private powerupsCollected = 0;
  private ghosts: Ghost[] = [];
  private ghostAcc = 0;

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: Bullet[] = [];
  private gems: Gem[] = [];
  private powerups: PowerUp[] = [];

  private camX = 0;
  private camY = 0;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.cb = cb;
    this.opts = opts;
    this.fx.scale = opts.particleScale;
    this.audio.muted = opts.muted;
  }

  setVolumes(music: number, sfx: number): void {
    this.audio.setVolumes(music, sfx);
  }

  start(): void {
    this.reset();
    this.attach();
    this.resize();
    this.audio.ensure();
    this.audio.startMusic();
    this.audio.waveStart();
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      this.frame(t);
      if (this.running) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.detach();
    this.audio.stopMusic();
  }

  setPaused(p: boolean): void {
    if (this.upgradeLock || this.deathT >= 0) {
      this.paused = p ? true : this.paused;
      return;
    }
    this.paused = p;
    this.last = performance.now();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get pendingUpgrade(): boolean {
    return this.upgradeLock;
  }

  setMuted(m: boolean): void {
    this.opts.muted = m;
    this.audio.setMuted(m);
  }

  setParticleScale(s: number): void {
    this.opts.particleScale = s;
    this.fx.scale = s;
  }

  setShakeEnabled(b: boolean): void {
    this.opts.shakeEnabled = b;
    if (!b) this.trauma = 0;
  }

  applyUpgrade(id: string): void {
    applyUpgrade(this.stats, id);
    if (id === 'maxhp') this.hp = Math.min(this.stats.maxHp, this.hp + 25);
    this.taken.set(id, (this.taken.get(id) ?? 0) + 1);
    this.audio.upgradePick();
    this.fx.shockwave(this.px, this.py, '#a3ff12', 160, 0.5, 5);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) {
      this.cb.onLevelUp(rollUpgrades(this.taken, 3));
    } else {
      this.upgradeLock = false;
      this.paused = false;
      this.last = performance.now();
    }
    this.emitHud();
  }

  tryDash(): void {
    if (this.paused || this.deathT >= 0) return;
    if (this.dashCd > 0 || this.dashT > 0) return;
    let dx = this.pvx;
    let dy = this.pvy;
    if (Math.abs(dx) + Math.abs(dy) < 10) {
      dx = Math.cos(this.aim);
      dy = Math.sin(this.aim);
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashDx = dx / l;
    this.dashDy = dy / l;
    this.dashT = 0.18;
    this.dashCd = this.stats.dashCooldownMax;
    this.invuln = Math.max(this.invuln, 0.28);
    this.audio.dash();
    this.fx.shockwave(this.px, this.py, '#00f0ff', 90, 0.3, 3);
  }

  // ---------- setup ----------

  private reset(): void {
    this.stats = statsForShip(this.opts.ship);
    this.px = WORLD_W / 2;
    this.py = WORLD_H / 2;
    this.pvx = 0; this.pvy = 0;
    this.hp = this.stats.maxHp;
    this.fireCd = 0.3;
    this.dashCd = 0; this.dashT = 0; this.invuln = 0;
    this.time = 0; this.kills = 0; this.elites = 0; this.score = 0;
    this.level = 1; this.xp = 0; this.xpNext = 30;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.wave = 1;
    this.waveKills = 0;
    this.waveQuota = this.quotaFor(1);
    this.intermission = 0;
    this.spawnT = 0.5;
    this.pendingLevels = 0;
    this.taken.clear();
    this.boss = null;
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.gems = [];
    this.powerups = [];
    this.ghosts = [];
    this.shieldT = 0; this.overdriveT = 0; this.magnetAllT = 0;
    this.powerupsCollected = 0;
    this.announce = null; this.announceT = 0;
    this.gridPulse = 0; this.orbitalAngle = 0;
    this.deathT = -1;
    this.gameOverSent = false;
    this.waveBannerT = 2.2;
    this.trauma = 0;
    this.slowmoT = 0;
    this.hitstopT = 0;
    this.paused = false;
    this.upgradeLock = false;
    this.aim = -Math.PI / 2;
  }

  private quotaFor(w: number): number {
    return Math.round((6 + w * 4.5) * DIFF[this.opts.difficulty].quota);
  }

  // ---------- events ----------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.cb.onPauseKey();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    this.audio.ensure();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
      this.tryDash();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left;
    this.mouseY = e.clientY - r.top;
    this.mouseSeen = true;
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.audio.ensure();
    if (e.button === 0) {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this.mouseSeen = true;
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.audio.ensure();
    const r = this.canvas.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const sx = t.clientX - r.left;
      const sy = t.clientY - r.top;
      if (sx < r.width / 2 && !this.leftStick.active) {
        this.leftStick = { active: true, id: t.identifier, ox: sx, oy: sy, dx: 0, dy: 0 };
      } else if (sx >= r.width / 2 && !this.rightStick.active) {
        this.rightStick = { active: true, id: t.identifier, ox: sx, oy: sy, dx: 0, dy: 0 };
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const sx = t.clientX - r.left;
      const sy = t.clientY - r.top;
      if (this.leftStick.active && t.identifier === this.leftStick.id) {
        this.leftStick.dx = clamp(sx - this.leftStick.ox, -70, 70);
        this.leftStick.dy = clamp(sy - this.leftStick.oy, -70, 70);
      }
      if (this.rightStick.active && t.identifier === this.rightStick.id) {
        this.rightStick.dx = clamp(sx - this.rightStick.ox, -70, 70);
        this.rightStick.dy = clamp(sy - this.rightStick.oy, -70, 70);
      }
    }
    void r;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.leftStick.active && t.identifier === this.leftStick.id) {
        this.leftStick.active = false;
        this.leftStick.dx = 0;
        this.leftStick.dy = 0;
      }
      if (this.rightStick.active && t.identifier === this.rightStick.id) {
        this.rightStick.active = false;
        this.rightStick.dx = 0;
        this.rightStick.dy = 0;
      }
    }
  };

  private onResize = (): void => {
    this.resize();
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.viewW = Math.max(320, w);
    this.viewH = Math.max(320, h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
  }

  // ---------- loop ----------

  private frame(now: number): void {
    let raw = (now - this.last) / 1000;
    this.last = now;
    if (raw > 0.1) raw = 0.1;
    if (raw <= 0) {
      this.render();
      return;
    }
    if (this.paused) {
      this.render();
      return;
    }
    let dt = raw;
    if (this.hitstopT > 0) {
      this.hitstopT -= raw;
      this.render();
      return;
    }
    if (this.slowmoT > 0) {
      this.slowmoT -= raw;
      dt *= 0.3;
    }
    this.update(dt);
    this.render();
    this.hudAcc += raw;
    if (this.hudAcc >= 0.1) {
      this.hudAcc = 0;
      this.emitHud();
    }
  }

  private emitHud(): void {
    const dots: MinimapDot[] = [];
    const maxDots = 70;
    const step = Math.max(1, Math.floor(this.enemies.length / maxDots));
    for (let i = 0; i < this.enemies.length; i += step) {
      const e = this.enemies[i];
      dots.push({ x: e.x, y: e.y, kind: e.kind, elite: e.elite });
      if (dots.length >= maxDots) break;
    }
    for (const p of this.powerups.slice(0, 8)) {
      dots.push({ x: p.x, y: p.y, kind: 'powerup' });
    }
    const active: { kind: PowerUpKind; t: number }[] = [];
    if (this.shieldT > 0) active.push({ kind: 'shield', t: this.shieldT });
    if (this.overdriveT > 0) active.push({ kind: 'overdrive', t: this.overdriveT });
    if (this.magnetAllT > 0) active.push({ kind: 'magnet', t: this.magnetAllT });
    const snap: HudSnapshot = {
      hp: Math.max(0, Math.ceil(this.hp)),
      maxHp: Math.round(this.stats.maxHp),
      xp: Math.floor(this.xp),
      xpNext: this.xpNext,
      level: this.level,
      wave: this.wave,
      kills: this.kills,
      elites: this.elites,
      score: Math.floor(this.score),
      time: this.time,
      combo: this.combo,
      comboT: clamp(this.comboT / comboWindow(this.taken), 0, 1),
      dashCd: Math.max(0, this.dashCd),
      dashMax: this.stats.dashCooldownMax,
      bossHp: this.boss ? Math.max(0, this.boss.hp) : null,
      bossMax: this.boss ? this.boss.maxHp : null,
      px: this.px,
      py: this.py,
      damage: this.stats.damage,
      fireRate: this.stats.fireRate,
      moveSpeed: this.stats.moveSpeed,
      critChance: this.stats.critChance,
      intermission: Math.max(0, this.intermission),
      waveProgress: clamp(this.waveKills / Math.max(1, this.waveQuota), 0, 1),
      announce: this.announceT > 0 ? this.announce : null,
      powerups: active,
      orbitals: this.stats.orbitals,
      dots,
    };
    this.cb.onHud(snap);
  }

  private setAnnounce(text: string, dur = 2.2): void {
    this.announce = text;
    this.announceT = dur;
    this.audio.announce();
  }

  // ---------- update ----------

  private update(dt: number): void {
    if (this.deathT >= 0) {
      this.deathT += dt;
      this.updateBullets(dt);
      this.updateEnemies(dt);
      this.fx.update(dt);
      this.updateCamera(dt);
      if (this.deathT > 1.5 && !this.gameOverSent) {
        this.gameOverSent = true;
        const upgrades = [...this.taken.keys()];
        const score = Math.floor(this.score);
        const isBest = saveBest(score) || false;
        pushBoard({
          score, wave: this.wave, kills: this.kills,
          time: Math.floor(this.time), ship: this.opts.ship, date: Date.now(),
        });
        addTotals(this.kills, this.time, this.wave);
        const result: GameResult = {
          score,
          kills: this.kills,
          elites: this.elites,
          wave: this.wave,
          level: this.level,
          time: this.time,
          maxCombo: this.maxCombo,
          grade: this.calcGrade(),
          isBest,
          upgradesTaken: upgrades,
          ship: this.opts.ship,
        };
        this.audio.gameOver();
        this.cb.onGameOver(result);
      }
      return;
    }

    this.time += dt;
    this.score += dt * (2 + this.wave * 0.6);

    // timers
    this.fireCd -= dt;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.overdriveT = Math.max(0, this.overdriveT - dt);
    this.magnetAllT = Math.max(0, this.magnetAllT - dt);
    this.waveBannerT = Math.max(0, this.waveBannerT - dt);
    this.announceT = Math.max(0, this.announceT - dt);
    if (this.announceT <= 0) this.announce = null;
    this.gridPulse = Math.max(0, this.gridPulse - dt * 2.2);
    this.orbitalAngle += dt * 3.4;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    // regen (+ emergency protocol)
    let regen = this.stats.regen;
    if ((this.taken.get('emergency') ?? 0) > 0 && this.hp < this.stats.maxHp * 0.3) {
      regen += 4 * (this.taken.get('emergency') ?? 0);
    }
    if (this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + regen * dt);
    }

    this.updatePlayer(dt);
    this.updateDirector(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.collide(dt);
    this.updateGems(dt);
    this.updatePowerups(dt);
    this.updateOrbitals(dt);
    this.updateCamera(dt);
    this.fx.update(dt);
    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  private calcGrade(): Grade {
    const s = this.score / Math.max(1, this.time) + this.wave * 60 + this.kills * 4 + this.maxCombo * 10;
    if (s > 2600) return 'S';
    if (s > 1700) return 'A';
    if (s > 1000) return 'B';
    if (s > 500) return 'C';
    return 'D';
  }

  private moveInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.leftStick.active) {
      x += this.leftStick.dx / 70;
      y += this.leftStick.dy / 70;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  private updatePlayer(dt: number): void {
    const mv = this.moveInput();
    const berserk = (this.taken.get('emergency') ?? 0) > 0 && this.hp < this.stats.maxHp * 0.3;
    if (this.dashT > 0) {
      this.dashT -= dt;
      const power = 950;
      this.pvx = this.dashDx * power;
      this.pvy = this.dashDy * power;
      this.fx.trail(this.px, this.py, '#00f0ff');
      this.fx.trail(this.px, this.py, '#ff2d78');
      this.ghostAcc -= dt;
      if (this.ghostAcc <= 0) {
        this.ghostAcc = 0.03;
        this.ghosts.push({ x: this.px, y: this.py, aim: this.aim, life: 0.35 });
      }
    } else {
      const sp = this.stats.moveSpeed * (berserk ? 1.5 : 1);
      const tx = mv.x * sp;
      const ty = mv.y * sp;
      const k = Math.min(1, dt * 10);
      this.pvx += (tx - this.pvx) * k;
      this.pvy += (ty - this.pvy) * k;
    }
    this.px = clamp(this.px + this.pvx * dt, 24, WORLD_W - 24);
    this.py = clamp(this.py + this.pvy * dt, 24, WORLD_H - 24);

    // aim
    let aimed = false;
    if (this.rightStick.active && Math.hypot(this.rightStick.dx, this.rightStick.dy) > 12) {
      this.aim = Math.atan2(this.rightStick.dy, this.rightStick.dx);
      aimed = true;
    } else if (this.mouseSeen) {
      const wx = this.camX + this.mouseX;
      const wy = this.camY + this.mouseY;
      if (dist2(this.px, this.py, wx, wy) > 100) {
        this.aim = angleTo(this.px, this.py, wx, wy);
        aimed = true;
      }
    }
    if (!aimed) {
      const near = this.nearestEnemy(760);
      if (near) this.aim = angleTo(this.px, this.py, near.x, near.y);
    }

    // fire (always auto-fire; overdrive boosts rate + damage handled in volley)
    if (this.fireCd <= 0) {
      this.fireVolley();
      const rate = this.stats.fireRate * (this.overdriveT > 0 ? 1.7 : 1);
      this.fireCd += 1 / rate;
      if (this.fireCd < -0.1) this.fireCd = 0;
    }
  }

  private nearestEnemy(maxD: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD * maxD;
    for (const e of this.enemies) {
      const d = dist2(this.px, this.py, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private fireVolley(): void {
    const n = this.stats.multishot;
    const base = this.aim;
    const od = this.overdriveT > 0 ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * this.stats.spread * 2.2;
      const a = base + off + rand(-0.02, 0.02);
      const crit = Math.random() < this.stats.critChance;
      const dmg = this.stats.damage * od * (crit ? this.stats.critMult : 1) * rand(0.92, 1.08);
      const sp = this.stats.bulletSpeed;
      this.bullets.push({
        x: this.px + Math.cos(a) * 20,
        y: this.py + Math.sin(a) * 20,
        vx: Math.cos(a) * sp + this.pvx * 0.25,
        vy: Math.sin(a) * sp + this.pvy * 0.25,
        r: crit ? 6 : 4.5,
        dmg,
        pierce: this.stats.pierce,
        life: 1.4,
        crit,
        friendly: true,
        dead: false,
        hit: new Set<number>(),
      });
    }
    this.fx.muzzle(this.px + Math.cos(base) * 22, this.py + Math.sin(base) * 22, base, '#00f0ff');
    this.audio.shoot();
  }

  private updateDirector(dt: number): void {
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) {
        this.wave += 1;
        this.waveKills = 0;
        this.waveQuota = this.quotaFor(this.wave);
        this.waveBannerT = 2.2;
        this.audio.waveStart();
        this.cb.onWave(this.wave);
        this.emitHud();
        if (this.wave % 5 === 0) {
          this.setAnnounce(`⚠ موج ${this.wave} — باس نزدیک است!`, 2.6);
          this.spawnBoss();
        }
      }
      return;
    }
    const d = DIFF[this.opts.difficulty];
    this.spawnT -= dt;
    const aliveWeight = this.enemies.length;
    const cap = Math.min(130, 14 + this.wave * 5);
    if (this.spawnT <= 0 && aliveWeight < cap && this.waveKills < this.waveQuota) {
      this.spawnT = Math.max(0.16, (rand(0.5, 1.1) - this.wave * 0.045) * d.interval);
      const batch = this.wave >= 7 ? rand(1, 10) < 3 ? 2 : 1 : 1;
      for (let i = 0; i < batch; i++) this.spawnEnemy();
    }
    if (this.waveKills >= this.waveQuota && this.enemies.length === 0 && this.deathT < 0) {
      // wave cleared
      this.score += 100 * this.wave;
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.12);
      this.setAnnounce(`موج ${this.wave} پاکسازی شد! +${100 * this.wave}`, 2);
      this.fx.shockwave(this.px, this.py, '#ffd319', 200, 0.6, 5);
      this.audio.levelup();
      if (this.wave >= 12) {
        // endless scaling keeps going; still intermission
      }
      this.intermission = 3.2;
      this.emitHud();
    }
  }

  private spawnPos(margin = 60): { x: number; y: number } {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * TAU;
      const rad = Math.max(this.viewW, this.viewH) * 0.62 + rand(0, 220);
      const x = clamp(this.px + Math.cos(a) * rad, margin, WORLD_W - margin);
      const y = clamp(this.py + Math.sin(a) * rad, margin, WORLD_H - margin);
      const dx = x - (this.camX + this.viewW / 2);
      const dy = y - (this.camY + this.viewH / 2);
      // prefer spawns outside view
      if (Math.abs(dx) > this.viewW / 2 + 40 || Math.abs(dy) > this.viewH / 2 + 40) {
        return { x, y };
      }
      if (tries === 11) return { x, y };
    }
    return { x: WORLD_W / 2, y: 80 };
  }

  private pickKind(): EnemyKind {
    const w = this.wave;
    const bag: EnemyKind[] = ['chaser', 'chaser', 'chaser'];
    if (w >= 2) bag.push('weaver', 'weaver');
    if (w >= 3) bag.push('dasher', 'dasher');
    if (w >= 4) bag.push('shooter');
    if (w >= 5) bag.push('splitter');
    if (w >= 6) bag.push('shooter', 'dasher', 'sniper');
    if (w >= 7) bag.push('tank');
    if (w >= 8) bag.push('splitter', 'weaver', 'sniper');
    if (w >= 10) bag.push('tank', 'shooter');
    return bag[Math.floor(Math.random() * bag.length)];
  }

  private eliteChance(): number {
    return Math.min(0.16, 0.03 + this.wave * 0.008);
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const d = DIFF[this.opts.difficulty];
    const wScale = 1 + (this.wave - 1) * 0.13 + Math.max(0, this.time / 240) * 0.25;
    const base: Enemy = {
      id: this.nextId++, kind, x, y, vx: 0, vy: 0,
      r: 16, hp: 30, maxHp: 30, speed: 130, dmg: 12,
      xp: 6, score: 25, t: 0, flash: 0, fireCd: rand(1, 2.5),
      state: 0, stateT: 0, lockDx: 0, lockDy: 0, strafe: Math.random() < 0.5 ? -1 : 1,
      kx: 0, ky: 0, elite: false, orbHitCd: 0,
    };
    switch (kind) {
      case 'chaser':
        base.hp = base.maxHp = 30 * wScale * d.hp;
        base.speed = 135 * d.speed;
        base.dmg = 12 * d.dmg;
        base.xp = 6; base.score = 25; base.r = 16;
        break;
      case 'weaver':
        base.hp = base.maxHp = 22 * wScale * d.hp;
        base.speed = 175 * d.speed;
        base.dmg = 10 * d.dmg;
        base.xp = 7; base.score = 35; base.r = 14;
        break;
      case 'dasher':
        base.hp = base.maxHp = 40 * wScale * d.hp;
        base.speed = 120 * d.speed;
        base.dmg = 16 * d.dmg;
        base.xp = 10; base.score = 50; base.r = 15;
        break;
      case 'shooter':
        base.hp = base.maxHp = 34 * wScale * d.hp;
        base.speed = 105 * d.speed;
        base.dmg = 10 * d.dmg;
        base.xp = 11; base.score = 60; base.r = 16;
        break;
      case 'splitter':
        base.hp = base.maxHp = 70 * wScale * d.hp;
        base.speed = 85 * d.speed;
        base.dmg = 14 * d.dmg;
        base.xp = 8; base.score = 55; base.r = 22;
        break;
      case 'mini':
        base.hp = base.maxHp = 12 * wScale * d.hp;
        base.speed = 215 * d.speed;
        base.dmg = 7 * d.dmg;
        base.xp = 3; base.score = 12; base.r = 9;
        break;
      case 'sniper':
        base.hp = base.maxHp = 46 * wScale * d.hp;
        base.speed = 95 * d.speed;
        base.dmg = 18 * d.dmg;
        base.xp = 14; base.score = 80; base.r = 15;
        base.fireCd = rand(1.2, 2);
        break;
      case 'tank':
        base.hp = base.maxHp = 150 * wScale * d.hp;
        base.speed = 62 * d.speed;
        base.dmg = 20 * d.dmg;
        base.xp = 18; base.score = 110; base.r = 26;
        break;
      case 'boss': {
        const mult = 1 + (this.wave / 5 - 1) * 0.9;
        base.hp = base.maxHp = 950 * mult * d.hp;
        base.speed = 92 * d.speed;
        base.dmg = 24 * d.dmg;
        base.xp = 120; base.score = 1500; base.r = 52;
        break;
      }
    }
    base.hp = base.maxHp = Math.round(base.hp);
    // elite roll (not for mini/boss)
    if (kind !== 'boss' && kind !== 'mini' && Math.random() < this.eliteChance()) {
      base.elite = true;
      base.hp = base.maxHp = Math.round(base.maxHp * 3.2);
      base.dmg = Math.round(base.dmg * 1.4);
      base.xp *= 5;
      base.score *= 4;
      base.r *= 1.22;
      base.speed *= 1.06;
    }
    return base;
  }

  private spawnEnemy(force?: EnemyKind): void {
    const kind = force ?? this.pickKind();
    const p = this.spawnPos();
    const e = this.makeEnemy(kind, p.x, p.y);
    this.enemies.push(e);
    if (e.elite) {
      this.fx.text(p.x, p.y - 24, 'ELITE!', '#ffd319', 16);
    }
  }

  private spawnBoss(): void {
    const p = this.spawnPos(140);
    const boss = this.makeEnemy('boss', p.x, p.y);
    this.enemies.push(boss);
    this.boss = boss;
    this.audio.bossSpawn();
    this.trauma = Math.min(1, this.trauma + 0.7);
    this.fx.shockwave(p.x, p.y, '#ff2244', 320, 0.8, 7);
    this.fx.text(p.x, p.y - 60, 'BOSS', '#ff2244', 30);
    this.slowmoT = 0.7;
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H) b.dead = true;
    }
    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H) b.dead = true;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.ebullets = this.ebullets.filter((b) => !b.dead);
  }

  private updateEnemies(dt: number): void {
    const px = this.px;
    const py = this.py;
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 5);
      e.fireCd -= dt;
      e.orbHitCd = Math.max(0, e.orbHitCd - dt);
      // knockback decay
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= 1 - Math.min(1, dt * 8);
      e.ky *= 1 - Math.min(1, dt * 8);

      const ang = angleTo(e.x, e.y, px, py);
      const dist = Math.hypot(px - e.x, py - e.y) || 1;

      switch (e.kind) {
        case 'chaser':
        case 'mini':
        case 'splitter': {
          const sp = e.speed;
          e.vx += (Math.cos(ang) * sp - e.vx) * Math.min(1, dt * 3);
          e.vy += (Math.sin(ang) * sp - e.vy) * Math.min(1, dt * 3);
          break;
        }
        case 'weaver': {
          const sp = e.speed;
          const perp = ang + Math.PI / 2;
          const wob = Math.sin(e.t * 4.2) * 0.9;
          const ax = Math.cos(ang) + Math.cos(perp) * wob * 0.7;
          const ay = Math.sin(ang) + Math.sin(perp) * wob * 0.7;
          const l = Math.hypot(ax, ay) || 1;
          e.vx += ((ax / l) * sp - e.vx) * Math.min(1, dt * 4);
          e.vy += ((ay / l) * sp - e.vy) * Math.min(1, dt * 4);
          break;
        }
        case 'dasher': {
          // 0 approach, 1 telegraph, 2 dash, 3 recover
          e.stateT -= dt;
          if (e.state === 0) {
            e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 3);
            e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 3);
            if (dist < 420 && e.stateT <= 0) {
              e.state = 1;
              e.stateT = 0.65;
              e.lockDx = Math.cos(ang);
              e.lockDy = Math.sin(ang);
            }
          } else if (e.state === 1) {
            e.vx *= 1 - Math.min(1, dt * 4);
            e.vy *= 1 - Math.min(1, dt * 4);
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.42;
              e.vx = e.lockDx * 640;
              e.vy = e.lockDy * 640;
              this.fx.trail(e.x, e.y, '#ffcf1c');
            }
          } else if (e.state === 2) {
            if (e.stateT <= 0) {
              e.state = 3;
              e.stateT = 1.1;
            }
          } else {
            e.vx *= 1 - Math.min(1, dt * 3);
            e.vy *= 1 - Math.min(1, dt * 3);
            if (e.stateT <= 0) {
              e.state = 0;
              e.stateT = rand(0.4, 1.2);
            }
          }
          break;
        }
        case 'shooter': {
          const want = 380;
          const dir = dist > want + 60 ? 1 : dist < want - 60 ? -1 : 0;
          const strafeAng = ang + Math.PI / 2 * e.strafe;
          const tx = Math.cos(ang) * dir * e.speed + Math.cos(strafeAng) * e.speed * 0.6;
          const ty = Math.sin(ang) * dir * e.speed + Math.sin(strafeAng) * e.speed * 0.6;
          e.vx += (tx - e.vx) * Math.min(1, dt * 2.5);
          e.vy += (ty - e.vy) * Math.min(1, dt * 2.5);
          if (Math.random() < dt * 0.25) e.strafe *= -1;
          if (e.fireCd <= 0 && dist < 640) {
            e.fireCd = rand(1.7, 2.6);
            const a = angleTo(e.x, e.y, px, py);
            const sp = 300 + this.wave * 8;
            this.ebullets.push({
              x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              r: 6, dmg: e.dmg, pierce: 0, life: 3.2, crit: false,
              friendly: false, dead: false, hit: new Set<number>(),
            });
            this.audio.enemyShoot();
            this.fx.muzzle(e.x, e.y, a, '#b14bff');
          }
          break;
        }
        case 'sniper': {
          // keeps far, telegraphs (state 1) then fires a fast bolt
          const want = 560;
          const dir = dist > want + 80 ? 1 : dist < want - 80 ? -1 : 0;
          const tx = Math.cos(ang) * dir * e.speed;
          const ty = Math.sin(ang) * dir * e.speed;
          e.vx += (tx - e.vx) * Math.min(1, dt * 2);
          e.vy += (ty - e.vy) * Math.min(1, dt * 2);
          e.stateT -= dt;
          if (e.state === 0 && e.fireCd <= 0 && dist < 800) {
            e.state = 1;
            e.stateT = 0.7;
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
          } else if (e.state === 1) {
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            if (e.stateT <= 0) {
              e.state = 0;
              e.fireCd = rand(2.2, 3.2);
              const sp = 520 + this.wave * 10;
              this.ebullets.push({
                x: e.x, y: e.y,
                vx: e.lockDx * sp, vy: e.lockDy * sp,
                r: 5, dmg: e.dmg, pierce: 0, life: 2.6, crit: false,
                friendly: false, dead: false, hit: new Set<number>(),
              });
              this.audio.sniperShot();
              this.fx.muzzle(e.x, e.y, Math.atan2(e.lockDy, e.lockDx), '#ff5df2');
            }
          }
          break;
        }
        case 'tank': {
          e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 1.8);
          e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 1.8);
          break;
        }
        case 'boss': {
          const enraged = e.hp < e.maxHp * 0.32;
          const sp = e.speed * (enraged ? 1.5 : 1);
          e.vx += (Math.cos(ang) * sp - e.vx) * Math.min(1, dt * 1.6);
          e.vy += (Math.sin(ang) * sp - e.vy) * Math.min(1, dt * 1.6);
          // radial burst
          if (e.fireCd <= 0) {
            e.fireCd = enraged ? 1.5 : 2.4;
            const n = enraged ? 14 : 10;
            const off = Math.random() * TAU;
            for (let i = 0; i < n; i++) {
              const a = off + (i / n) * TAU;
              this.ebullets.push({
                x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
                r: 7, dmg: e.dmg * 0.7, pierce: 0, life: 4, crit: false,
                friendly: false, dead: false, hit: new Set<number>(),
              });
            }
            this.audio.enemyShoot();
            this.fx.shockwave(e.x, e.y, '#ff2244', 160, 0.4, 4);
          }
          // charge
          e.stateT -= dt;
          if (e.stateT <= 0) {
            e.stateT = enraged ? 4 : 6;
            e.state = e.state === 0 ? 1 : 0;
            if (e.state === 1) {
              e.vx = Math.cos(ang) * 520;
              e.vy = Math.sin(ang) * 520;
              this.trauma = Math.min(1, this.trauma + 0.35);
            } else {
              // spawn minis
              for (let i = 0; i < 3; i++) {
                const m = this.makeEnemy('mini', e.x + rand(-60, 60), e.y + rand(-60, 60));
                this.enemies.push(m);
              }
              this.fx.explosion(e.x, e.y, '#ff2244', 18, 260);
            }
          }
          break;
        }
      }

      e.x = clamp(e.x + e.vx * dt, e.r, WORLD_W - e.r);
      e.y = clamp(e.y + e.vy * dt, e.r, WORLD_H - e.r);
    }

    // separation (cheap, capped)
    const n = this.enemies.length;
    if (n > 1 && n < 140) {
      for (let i = 0; i < n; i++) {
        const a = this.enemies[i];
        for (let j = i + 1; j < n; j++) {
          const b = this.enemies[j];
          const rr = a.r + b.r;
          const d2 = dist2(a.x, a.y, b.x, b.y);
          if (d2 > 0.01 && d2 < rr * rr) {
            const d = Math.sqrt(d2);
            const push = ((rr - d) / d) * 22 * dt * 60 * 0.016;
            const nx = (b.x - a.x) / d;
            const ny = (b.y - a.y) / d;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }

    // drop dead boss ref
    if (this.boss && this.boss.hp <= 0) this.boss = null;
  }

  private collide(_dt: number): void {
    // friendly bullets vs enemies
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0 || b.hit.has(e.id)) continue;
        const rr = b.r + e.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hit.add(e.id);
          this.damageEnemy(e, b.dmg, b.crit, b.vx, b.vy);
          if (b.hit.size > b.pierce) {
            b.dead = true;
            break;
          }
        }
      }
    }
    // cleanup dead enemies
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (dead.length > 0) {
      for (const e of dead) this.killEnemy(e);
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    }

    if (this.deathT >= 0) return;

    // enemy bullets vs player
    const pr = 13;
    for (const b of this.ebullets) {
      if (b.dead) continue;
      const rr = b.r + pr;
      if (dist2(b.x, b.y, this.px, this.py) < rr * rr) {
        b.dead = true;
        this.damagePlayer(b.dmg, b.x, b.y);
      }
    }
    // enemies vs player
    const thorns = thornsDamage(this.taken);
    for (const e of this.enemies) {
      const rr = e.r + pr - 2;
      if (dist2(e.x, e.y, this.px, this.py) < rr * rr) {
        this.damagePlayer(e.dmg, e.x, e.y);
        if (thorns > 0 && e.hp > 0) {
          this.damageEnemy(e, thorns, false, e.x - this.px, e.y - this.py);
        }
        // push enemy back a bit so it doesn't stick
        const a = angleTo(this.px, this.py, e.x, e.y);
        e.kx += Math.cos(a) * 180;
        e.ky += Math.sin(a) * 180;
      }
    }
    this.ebullets = this.ebullets.filter((b) => !b.dead);
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, vx: number, vy: number): void {
    // executioner bonus vs wounded
    if ((this.taken.get('executioner') ?? 0) > 0 && e.hp < e.maxHp * 0.3) {
      dmg *= executionerMult(this.taken);
    }
    e.hp -= dmg;
    e.flash = 1;
    const l = Math.hypot(vx, vy) || 1;
    const kb = e.kind === 'boss' ? 12 : e.kind === 'tank' ? 40 : 130;
    e.kx += (vx / l) * kb;
    e.ky += (vy / l) * kb;
    this.fx.explosion(e.x, e.y, ENEMY_COLOR[e.kind], crit ? 7 : 3, 200);
    if (crit || dmg >= 30) {
      this.fx.text(e.x, e.y - e.r, String(Math.round(dmg)), crit ? '#ffd319' : '#ffffff', crit ? 17 : 13);
    }
    if (e.hp <= 0) {
      this.hitstopT = Math.max(this.hitstopT, e.kind === 'boss' ? 0.14 : e.elite ? 0.06 : 0.02);
    }
  }

  private killEnemy(e: Enemy): void {
    this.kills += 1;
    this.waveKills += 1;
    this.combo += 1;
    this.comboT = comboWindow(this.taken);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const comboMult = 1 + Math.min(2 + (this.taken.get('combomaster') ?? 0), this.combo * 0.02 * comboScoreMult(this.taken));
    const pts = e.score * (1 + this.wave * 0.08) * comboMult;
    this.score += pts;
    if (e.elite) {
      this.elites += 1;
      this.setAnnounce(`الیت نابود شد! +${Math.round(pts)}`, 1.8);
    }

    const big = e.kind === 'boss' || e.kind === 'splitter' || e.kind === 'tank' || e.elite;
    this.fx.explosion(e.x, e.y, e.elite ? '#ffd319' : ENEMY_COLOR[e.kind], big ? 42 : 16, big ? 460 : 320);
    this.fx.shockwave(e.x, e.y, e.elite ? '#ffd319' : ENEMY_COLOR[e.kind], big ? 190 : 70, 0.4, big ? 6 : 3);
    this.gridPulse = Math.min(1, this.gridPulse + (e.kind === 'boss' ? 1 : e.elite ? 0.5 : 0.12));
    if (e.elite) this.audio.eliteDie();
    else this.audio.enemyDie(big);
    this.trauma = Math.min(1, this.trauma + (e.kind === 'boss' ? 0.8 : e.elite ? 0.4 : e.kind === 'splitter' ? 0.22 : 0.08));

    if (e.kind === 'boss') {
      this.slowmoT = 1.0;
      this.fx.text(e.x, e.y, `+${Math.round(pts)}`, '#ffd319', 26);
      this.dropPowerup(e.x, e.y, true);
      // shower of gems
      for (let i = 0; i < 14; i++) {
        this.gems.push({
          x: e.x + rand(-40, 40), y: e.y + rand(-40, 40),
          vx: rand(-220, 220), vy: rand(-220, 220),
          val: 12, t: 0,
        });
      }
      this.boss = null;
    } else {
      // gems
      const gemVal = e.xp;
      const parts = e.xp >= 10 ? 3 : 1;
      for (let i = 0; i < parts; i++) {
        this.gems.push({
          x: e.x + rand(-8, 8), y: e.y + rand(-8, 8),
          vx: rand(-160, 160), vy: rand(-160, 160),
          val: Math.ceil(gemVal / parts), t: 0,
        });
      }
      if (e.kind === 'splitter') {
        for (let i = 0; i < 2; i++) {
          const m = this.makeEnemy('mini', e.x + rand(-18, 18), e.y + rand(-18, 18));
          m.hp = m.maxHp;
          this.enemies.push(m);
        }
      }
      // powerup drop: elites always, others 2%
      if (e.elite) {
        this.dropPowerup(e.x, e.y, false);
      } else if (Math.random() < 0.02) {
        this.dropPowerup(e.x, e.y, false);
      }
    }

    if (this.stats.lifesteal > 0) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lifesteal);
    }
    if (this.combo > 0 && this.combo % 25 === 0) {
      this.setAnnounce(`کمبو ×${this.combo}!`, 1.8);
      this.fx.text(this.px, this.py - 34, `COMBO x${this.combo}`, '#00f0ff', 20);
    }
  }

  private dropPowerup(x: number, y: number, guaranteed: boolean): void {
    if (this.powerups.length > 6) return;
    const kinds: PowerUpKind[] = ['shield', 'magnet', 'nuke', 'overdrive', 'heal'];
    const kind = guaranteed && Math.random() < 0.5 ? 'heal' : kinds[Math.floor(Math.random() * kinds.length)];
    this.powerups.push({
      x: clamp(x, 40, WORLD_W - 40), y: clamp(y, 40, WORLD_H - 40),
      vx: rand(-60, 60), vy: rand(-60, 60), kind, t: 0, life: 22,
    });
    this.fx.shockwave(x, y, POWERUP_COLOR[kind], 80, 0.4, 3);
  }

  private updatePowerups(dt: number): void {
    for (const p of this.powerups) {
      p.t += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 2);
      p.vy *= 1 - Math.min(1, dt * 2);
      const d2 = dist2(p.x, p.y, this.px, this.py);
      const pullR = this.magnetAllT > 0 ? 1200 : this.stats.magnet;
      if (d2 < pullR * pullR) {
        const d = Math.sqrt(d2) || 1;
        p.vx += ((this.px - p.x) / d) * 1400 * dt;
        p.vy += ((this.py - p.y) / d) * 1400 * dt;
      }
      if (d2 < 30 * 30) {
        p.life = -1;
        this.collectPowerup(p.kind);
      }
    }
    this.powerups = this.powerups.filter((p) => p.life > 0);
  }

  private collectPowerup(kind: PowerUpKind): void {
    this.powerupsCollected += 1;
    this.score += 50;
    if (kind === 'heal') {
      this.hp = Math.min(this.stats.maxHp, this.hp + 40);
    } else if (kind === 'shield') {
      this.shieldT = 6;
      this.audio.shieldUp();
    } else if (kind === 'magnet') {
      this.magnetAllT = 8;
    } else if (kind === 'overdrive') {
      this.overdriveT = 8;
    } else if (kind === 'nuke') {
      this.detonateNuke();
      return;
    }
    this.audio.powerup();
    this.setAnnounce(POWERUP_FA[kind], 1.8);
    this.fx.shockwave(this.px, this.py, POWERUP_COLOR[kind], 170, 0.5, 5);
    this.fx.pickupBurst(this.px, this.py, POWERUP_COLOR[kind]);
    this.emitHud();
  }

  private detonateNuke(): void {
    this.audio.nuke();
    this.trauma = 1;
    this.gridPulse = 1;
    this.slowmoT = Math.max(this.slowmoT, 0.6);
    this.fx.shockwave(this.px, this.py, '#ff5d2a', 700, 0.8, 10);
    this.fx.explosion(this.px, this.py, '#ffd319', 60, 600);
    const dead = [...this.enemies];
    for (const e of dead) {
      if (e.kind === 'boss') {
        this.damageEnemy(e, e.maxHp * 0.35, false, 0, -1);
      } else {
        e.hp = 0;
      }
    }
    const gone = this.enemies.filter((e) => e.hp <= 0);
    for (const e of gone) this.killEnemy(e);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.setAnnounce('انفجار هسته‌ای!', 2);
  }

  private updateOrbitals(dt: number): void {
    void dt;
    const n = this.stats.orbitals;
    if (n <= 0 || this.deathT >= 0) return;
    const R = 74;
    const dmg = this.stats.damage * this.stats.orbitalDamage;
    for (let i = 0; i < n; i++) {
      const a = this.orbitalAngle + (i / n) * TAU;
      const ox = this.px + Math.cos(a) * R;
      const oy = this.py + Math.sin(a) * R;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.orbHitCd > 0) continue;
        const rr = e.r + 13;
        if (dist2(ox, oy, e.x, e.y) < rr * rr) {
          e.orbHitCd = 0.35;
          const ka = angleTo(e.x, e.y, ox, oy);
          this.damageEnemy(e, dmg, false, Math.cos(ka) * 300, Math.sin(ka) * 300);
        }
      }
    }
    // cleanup orbital kills immediately so blades feel responsive
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (dead.length > 0) {
      for (const e of dead) this.killEnemy(e);
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    }
  }

  private damagePlayer(raw: number, fromX: number, fromY: number): void {
    if (this.invuln > 0 || this.dashT > 0 || this.deathT >= 0) return;
    if (this.shieldT > 0) {
      // shield absorbs the hit with a spark
      this.invuln = 0.4;
      this.fx.shockwave(this.px, this.py, '#00e5ff', 90, 0.3, 3);
      this.fx.pickupBurst(this.px, this.py, '#00e5ff');
      return;
    }
    const dmg = Math.max(1, raw - this.stats.armor);
    this.hp -= dmg;
    this.invuln = 0.55;
    this.combo = 0;
    this.comboT = 0;
    this.audio.hurt();
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.fx.explosion(this.px, this.py, '#ff2d78', 14, 300);
    this.fx.text(this.px, this.py - 26, `-${Math.round(dmg)}`, '#ff5d7e', 16);
    const a = angleTo(fromX, fromY, this.px, this.py);
    this.pvx += Math.cos(a) * 260;
    this.pvy += Math.sin(a) * 260;
    if (this.hp <= 0) {
      this.hp = 0;
      this.deathT = 0;
      this.slowmoT = 1.2;
      this.trauma = 1;
      this.fx.explosion(this.px, this.py, '#00f0ff', 80, 560);
      this.fx.explosion(this.px, this.py, '#ff2d78', 60, 420);
      this.fx.shockwave(this.px, this.py, '#ffffff', 320, 0.9, 7);
    }
    this.emitHud();
  }

  private addXp(v: number): void {
    this.xp += v * this.stats.xpGainMult;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.floor(this.xpNext * 1.27 + 18);
      this.pendingLevels += 1;
    }
    if (this.pendingLevels > 0 && !this.upgradeLock) {
      this.upgradeLock = true;
      this.paused = true;
      this.audio.levelup();
      this.fx.shockwave(this.px, this.py, '#a3ff12', 220, 0.6, 5);
      this.cb.onLevelUp(rollUpgrades(this.taken, 3));
      this.emitHud();
    }
  }

  private updateGems(dt: number): void {
    const magnetR = this.magnetAllT > 0 ? 1200 : this.stats.magnet;
    const magnetR2 = magnetR * magnetR;
    for (const g of this.gems) {
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= 1 - Math.min(1, dt * 3);
      g.vy *= 1 - Math.min(1, dt * 3);
      const d2 = dist2(g.x, g.y, this.px, this.py);
      if (d2 < magnetR2) {
        const d = Math.sqrt(d2) || 1;
        const pull = 900 * (1 - d / (magnetR + 1)) + 260;
        g.vx += ((this.px - g.x) / d) * pull * dt * 4;
        g.vy += ((this.py - g.y) / d) * pull * dt * 4;
      }
      if (d2 < 26 * 26) {
        g.t = -999; // collected marker
        this.addXp(g.val);
        this.score += 5;
        this.audio.pickup();
        this.fx.pickupBurst(g.x, g.y);
      }
    }
    if (this.gems.length > 400) {
      this.gems.splice(0, this.gems.length - 400);
    }
    this.gems = this.gems.filter((g) => g.t > -100);
  }

  private updateCamera(_dt: number): void {
    const tx = clamp(this.px - this.viewW / 2, 0, Math.max(0, WORLD_W - this.viewW));
    const ty = clamp(this.py - this.viewH / 2, 0, Math.max(0, WORLD_H - this.viewH));
    // if world smaller than view, center
    const cx = WORLD_W < this.viewW ? (WORLD_W - this.viewW) / 2 : tx;
    const cy = WORLD_H < this.viewH ? (WORLD_H - this.viewH) / 2 : ty;
    this.camX += (cx - this.camX) * 0.2;
    this.camY += (cy - this.camY) * 0.2;
    if (Math.abs(cx - this.camX) < 0.5) this.camX = cx;
    if (Math.abs(cy - this.camY) < 0.5) this.camY = cy;
  }

  // ---------- render ----------

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // bg
    const bg = ctx.createLinearGradient(0, 0, 0, this.viewH);
    bg.addColorStop(0, '#07071c');
    bg.addColorStop(1, '#050514');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    let shX = 0;
    let shY = 0;
    if (this.opts.shakeEnabled && this.trauma > 0) {
      const s = this.trauma * this.trauma * 22;
      shX = rand(-s, s);
      shY = rand(-s, s);
    }
    const camX = this.camX - shX;
    const camY = this.camY - shY;

    // stars (screen space parallax)
    this.fx.drawStars(ctx, { x: camX, y: camY }, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(-camX, -camY);

    // grid (pulses on big kills / nukes)
    const pulse = this.gridPulse;
    ctx.strokeStyle = `rgba(0,240,255,${(0.07 + pulse * 0.25).toFixed(3)})`;
    ctx.lineWidth = 1 + pulse * 1.5;
    const step = 100;
    const x0 = Math.floor(camX / step) * step;
    const y0 = Math.floor(camY / step) * step;
    ctx.beginPath();
    for (let x = x0; x < camX + this.viewW + step; x += step) {
      ctx.moveTo(x, camY - 20);
      ctx.lineTo(x, camY + this.viewH + 20);
    }
    for (let y = y0; y < camY + this.viewH + step; y += step) {
      ctx.moveTo(camX - 20, y);
      ctx.lineTo(camX + this.viewW + 20, y);
    }
    ctx.stroke();

    // arena border
    ctx.strokeStyle = 'rgba(0,240,255,0.5)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.shadowBlur = 0;

    // gems
    for (const g of this.gems) {
      const pulse = 1 + Math.sin(g.t * 6) * 0.18;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#a3ff12';
      ctx.shadowColor = '#a3ff12';
      ctx.shadowBlur = 10;
      const s = 5.5 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // powerups (world space, bobbing + glow ring)
    const nowMs = performance.now();
    for (const p of this.powerups) {
      const bob = Math.sin((nowMs / 300) + p.x) * 4;
      const blink = p.life < 5 ? (Math.sin(nowMs / 120) > 0 ? 1 : 0.35) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = POWERUP_COLOR[p.kind];
      ctx.lineWidth = 2;
      ctx.shadowColor = POWERUP_COLOR[p.kind];
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = POWERUP_COLOR[p.kind];
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph: Record<PowerUpKind, string> = {
        shield: '◈', magnet: '◎', nuke: '✸', overdrive: '⚡', heal: '✚',
      };
      ctx.fillText(glyph[p.kind], 0, 1);
      ctx.restore();
    }

    // enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // dash ghosts (afterimages)
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = (g.life / 0.35) * 0.45;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.aim);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, 12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, -12);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // orbital blades
    if (this.stats.orbitals > 0 && this.deathT < 0) {
      for (let i = 0; i < this.stats.orbitals; i++) {
        const a = this.orbitalAngle + (i / this.stats.orbitals) * TAU;
        const ox = this.px + Math.cos(a) * 74;
        const oy = this.py + Math.sin(a) * 74;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(a * 3);
        ctx.fillStyle = 'rgba(255,211,25,0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd319';
        ctx.shadowColor = '#ffd319';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-7, 8);
        ctx.lineTo(-7, -8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // friendly bullets
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.fillStyle = b.crit ? '#ffd319' : '#00f0ff';
      ctx.shadowColor = b.crit ? '#ffd319' : '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fillRect(-10, -2.2, 20, 4.4);
      ctx.beginPath();
      ctx.arc(8, 0, b.r * 0.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // enemy bullets
    for (const b of this.ebullets) {
      ctx.fillStyle = '#ff2d78';
      ctx.shadowColor = '#ff2d78';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // player
    if (this.deathT < 0) {
      this.drawPlayer(ctx);
    }

    // particles (world space)
    this.fx.draw(ctx);

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(
      this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * 0.42,
      this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * 0.75,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // low hp pulse
    const hpFrac = this.hp / this.stats.maxHp;
    if (hpFrac < 0.32 && this.deathT < 0) {
      const a = (0.32 - hpFrac) * 1.6 + Math.sin(performance.now() / 240) * 0.06;
      ctx.fillStyle = `rgba(255,20,60,${clamp(a, 0, 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // wave banner
    if (this.waveBannerT > 0) {
      const t = this.waveBannerT;
      const alpha = clamp(t / 0.5, 0, 1) * clamp((2.2 - t) / 0.3 + 0.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.min(54, this.viewW / 12)}px Orbitron, Vazirmatn, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      const label = this.wave % 5 === 0 ? `WAVE ${this.wave} — BOSS` : `WAVE ${this.wave}`;
      ctx.strokeText(label, this.viewW / 2, 120);
      ctx.fillStyle = this.wave % 5 === 0 ? '#ff2244' : '#00f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 24;
      ctx.fillText(label, this.viewW / 2, 120);
      ctx.restore();
    }

    if (this.intermission > 0 && this.deathT < 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      ctx.font = '700 15px Vazirmatn, sans-serif';
      ctx.fillStyle = '#ffd319';
      ctx.fillText(`موج بعدی تا ${this.intermission.toFixed(1)} ثانیه…`, this.viewW / 2, 156);
      ctx.restore();
    }

    this.drawSticks(ctx);
  }

  private shipColor(): string {
    if (this.opts.ship === 'phantom') return '#b14bff';
    if (this.opts.ship === 'titan') return '#ffb020';
    return '#00f0ff';
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const col = this.shipColor();
    ctx.save();
    ctx.translate(this.px, this.py);
    // glow
    ctx.fillStyle = 'rgba(0,240,255,0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
    // overdrive aura
    if (this.overdriveT > 0) {
      ctx.fillStyle = 'rgba(255,211,25,0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, 38 + Math.sin(performance.now() / 110) * 4, 0, TAU);
      ctx.fill();
    }
    // dash trail direction
    ctx.rotate(this.aim);
    // engine flame
    const flame = 12 + Math.sin(performance.now() / 60) * 4 + Math.hypot(this.pvx, this.pvy) / 60;
    ctx.fillStyle = '#ff9f1c';
    ctx.shadowColor = '#ff9f1c';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(-12, 7);
    ctx.lineTo(-12 - flame, 0);
    ctx.lineTo(-12, -7);
    ctx.closePath();
    ctx.fill();
    // hull
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#0b1026';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // cockpit
    ctx.shadowBlur = 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(3, 0, 4.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    // energy shield bubble (powerup)
    if (this.shieldT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 140) * 0.15;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 30, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(this.px, this.py, 30, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // shield ring
    if (this.invuln > 0 || this.dashT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.invuln * 2, 0.15, 0.7);
      ctx.strokeStyle = this.dashT > 0 ? '#ffffff' : '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 22 + Math.sin(performance.now() / 90) * 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const color = e.elite ? '#ffd319' : ENEMY_COLOR[e.kind];
    ctx.save();
    ctx.translate(e.x, e.y);
    const face = angleTo(e.x, e.y, this.px, this.py);
    ctx.rotate(e.kind === 'shooter' || e.kind === 'boss' || e.kind === 'sniper' ? face : face + e.t * 0.6);

    const flash = e.flash > 0.3;
    const body = flash ? '#ffffff' : color;

    // soft glow disc
    ctx.fillStyle = color;
    ctx.globalAlpha = e.elite ? 0.3 : 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // elite outer ring (rotates opposite)
    if (e.elite) {
      ctx.save();
      ctx.rotate(-e.t * 1.8);
      ctx.strokeStyle = '#ffd319';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#0a0a1c';
    ctx.strokeStyle = body;
    ctx.lineWidth = e.kind === 'boss' ? 4 : 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = e.elite ? 20 : 12;

    ctx.beginPath();
    if (e.kind === 'chaser') {
      // triangle
      ctx.moveTo(e.r, 0);
      ctx.lineTo(-e.r * 0.7, e.r * 0.75);
      ctx.lineTo(-e.r * 0.7, -e.r * 0.75);
      ctx.closePath();
    } else if (e.kind === 'weaver') {
      // dart
      ctx.moveTo(e.r + 3, 0);
      ctx.lineTo(0, e.r * 0.6);
      ctx.lineTo(-e.r, 0);
      ctx.lineTo(0, -e.r * 0.6);
      ctx.closePath();
    } else if (e.kind === 'dasher') {
      // diamond (telegraph flashes bigger)
      const grow = e.state === 1 ? 1 + Math.sin(e.t * 30) * 0.12 : 1;
      const r = e.r * grow;
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.8);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.8);
      ctx.closePath();
    } else if (e.kind === 'shooter') {
      // square
      const r = e.r * 0.95;
      ctx.rect(-r / 1.2, -r / 1.2, (r * 2) / 1.2, (r * 2) / 1.2);
    } else if (e.kind === 'sniper') {
      // long needle + scope ring
      ctx.moveTo(e.r + 6, 0);
      ctx.lineTo(-e.r * 0.6, e.r * 0.45);
      ctx.lineTo(-e.r * 0.6, -e.r * 0.45);
      ctx.closePath();
    } else if (e.kind === 'tank') {
      // heavy octagon
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (e.kind === 'splitter' || e.kind === 'mini') {
      // hexagon
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      // boss: spiked octagon
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const rr = i % 2 === 0 ? e.r : e.r * 0.78;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // core
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.5, e.r * 0.22), 0, TAU);
    ctx.fill();
    ctx.restore();

    // hp bar for tanky enemies
    if ((e.kind === 'splitter' || e.kind === 'shooter' || e.kind === 'dasher' || e.kind === 'boss' || e.kind === 'tank' || e.kind === 'sniper' || e.elite) && e.hp < e.maxHp) {
      const w = e.kind === 'boss' ? 110 : e.kind === 'tank' ? 52 : 34;
      const frac = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * frac, 5);
    }

    // dasher telegraph line
    if (e.kind === 'dasher' && e.state === 1) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(e.t * 30) * 0.15;
      ctx.strokeStyle = '#ffcf1c';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.lockDx * 300, e.y + e.lockDy * 300);
      ctx.stroke();
      ctx.restore();
    }
    // sniper laser telegraph
    if (e.kind === 'sniper' && e.state === 1) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(e.t * 40) * 0.2;
      ctx.strokeStyle = '#ff5df2';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.lockDx * 700, e.y + e.lockDy * 700);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawSticks(ctx: CanvasRenderingContext2D): void {
    const draw = (s: Stick, label: string) => {
      if (!s.active) return;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, 52, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(s.ox + s.dx * 0.6, s.oy + s.dy * 0.6, 22, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.font = '11px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, s.ox, s.oy - 60);
      ctx.restore();
    };
    draw(this.leftStick, 'حرکت');
    draw(this.rightStick, 'شلیک');
  }
}
