/* NEON VOID v2.1 — custom arena-survival engine.
   Fixed-clamp loop, camera + shake + slow-mo, spatial-grid collisions,
   9 enemy AIs, wave director with mutators, elites with affixes,
   dash, combo, gems, power-ups, orbitals, boss spiral patterns.
   Perf: baked glow sprites (no hot-loop shadowBlur), pooled bullets,
   swap-remove sweeps, cached gradients, FPS-driven auto-quality. */

import type {
  EngineCallbacks,
  EngineOptions,
  EnemyKind,
  GameResult,
  Grade,
  HudSnapshot,
  MutatorKind,
  PlayerStats,
  PowerUpKind,
  MinimapDot,
} from './types';
import { statsForShip, MUTATORS, WIN_WAVE } from './types';
import type { Enemy } from './enemies';
import {
  DIFF, ENEMY_COLOR, ENEMY_FA, isBossKind, bossVariantForWave,
  createEnemy, pickKindFor, pickTarget, diffScoreMultFor, bulletSpeedMultFor,
} from './enemies';
import { SynthAudio } from './audio';
import { ParticleSystem } from './particles';
import { drawGlow, gemSpriteTier, gemTierFor } from './sprites';
import {
  applyUpgrade, rollUpgrades, executionerMult, comboScoreMult, comboWindow, thornsDamage,
  stormProcChance, stormTargets, critNovaMult, critNovaRadius, midasGemMult, midasScoreMult,
} from './upgrades';
import { angleTo, clamp, dist2, rand, sweep, TAU } from './utils';
import { saveBest, pushBoard, addTotals, addShards, pushRun, saveCheckpoint, clearCheckpoint } from './storage';
import type { Checkpoint } from './storage';
import { unlockAchievement, achievementDef } from './achievements';

export const WORLD_W = 2600;
export const WORLD_H = 2000;

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  crit: boolean;
  friendly: boolean;
  dead: boolean;
  hit: number[]; // enemy ids already struck (pooled, cleared on reuse)
  homing: boolean; // seeker missile: steers toward nearest enemy
  tint: string | null; // custom glow color (null = default by side/crit)
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

/** One pilot body. In solo only fighters[0] lives; co-op adds fighters[1].
 *  The build (stats/taken/upgrades) is always shared. */
interface Fighter {
  x: number; y: number; vx: number; vy: number;
  aim: number;
  hp: number;
  fireCd: number;
  dashCd: number;
  dashT: number;
  dashDx: number; dashDy: number;
  invuln: number;
  hurtFlash: number;
  alive: boolean;
}

interface Stick {
  active: boolean;
  id: number;
  ox: number; oy: number;
  dx: number; dy: number;
}

const POWERUP_COLOR: Record<PowerUpKind, string> = {
  shield: '#00e5ff',
  magnet: '#b14bff',
  nuke: '#ff5d2a',
  overdrive: '#ffd319',
  heal: '#3dff8e',
  frost: '#7dd3fc',
  greed: '#e879f9',
  phase: '#e2e8f0',
};

const POWERUP_FA: Record<PowerUpKind, string> = {
  shield: 'سپر انرژی!',
  magnet: 'مگنت همگانی!',
  nuke: 'انفجار هسته‌ای!',
  overdrive: 'اور‌درایو!',
  heal: '+۴۰ جان!',
  frost: '❄ یخبندان!',
  greed: '◆ طمع طلایی! (جم ۲×)',
  phase: '◇ فاز شبح! (۵ ثانیه نامرئی)',
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

  // co-op: two bodies (fighters), one shared build. P1 fields are proxied
  // to fighters[0] so every solo code path stays byte-identical.
  private fighters: Fighter[] = [GameEngine.freshFighter(-30), GameEngine.freshFighter(30)];
  private static freshFighter(offsetX: number): Fighter {
    return {
      x: WORLD_W / 2 + offsetX, y: WORLD_H / 2,
      vx: 0, vy: 0, aim: -Math.PI / 2, hp: 100,
      fireCd: 0.1, dashCd: 0, dashT: 0, dashDx: 1, dashDy: 0,
      invuln: 0, hurtFlash: 0, alive: true,
    };
  }
  private get px(): number { return this.fighters[0].x; }
  private set px(v: number) { this.fighters[0].x = v; }
  private get py(): number { return this.fighters[0].y; }
  private set py(v: number) { this.fighters[0].y = v; }
  private get pvx(): number { return this.fighters[0].vx; }
  private set pvx(v: number) { this.fighters[0].vx = v; }
  private get pvy(): number { return this.fighters[0].vy; }
  private set pvy(v: number) { this.fighters[0].vy = v; }
  private get aim(): number { return this.fighters[0].aim; }
  private set aim(v: number) { this.fighters[0].aim = v; }
  private get hp(): number { return this.fighters[0].hp; }
  private set hp(v: number) { this.fighters[0].hp = v; }
  private get fireCd(): number { return this.fighters[0].fireCd; }
  private set fireCd(v: number) { this.fighters[0].fireCd = v; }
  private get dashCd(): number { return this.fighters[0].dashCd; }
  private set dashCd(v: number) { this.fighters[0].dashCd = v; }
  private get dashT(): number { return this.fighters[0].dashT; }
  private set dashT(v: number) { this.fighters[0].dashT = v; }
  private get dashDx(): number { return this.fighters[0].dashDx; }
  private set dashDx(v: number) { this.fighters[0].dashDx = v; }
  private get dashDy(): number { return this.fighters[0].dashDy; }
  private set dashDy(v: number) { this.fighters[0].dashDy = v; }
  private get invuln(): number { return this.fighters[0].invuln; }
  private set invuln(v: number) { this.fighters[0].invuln = v; }
  private get hurtFlash(): number { return this.fighters[0].hurtFlash; }
  private set hurtFlash(v: number) { this.fighters[0].hurtFlash = v; }
  /** P2 is in the arena only in co-op mode. */
  private get coOp(): boolean { return this.opts.coOp === true; }
  private stats: PlayerStats = statsForShip('vanguard');

  // run state
  private time = 0;
  private kills = 0;
  private elites = 0;
  private score = 0;
  private level = 1;
  private xp = 0;
  private xpNext = 26;
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
  private announcePrio = 0;
  private pendingAnnounce: { text: string; dur: number; prio: number } | null = null;
  private gridPulse = 0;
  private orbitalAngle = 0;
  private shieldT = 0;
  private overdriveT = 0;
  private magnetAllT = 0;
  private greedT = 0;
  private phaseT = 0;
  private powerupsCollected = 0;
  private ghosts: Ghost[] = [];
  private ghostAcc = 0;

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: Bullet[] = [];
  private gems: Gem[] = [];
  private powerups: PowerUp[] = [];
  // pooled bullets (reused to avoid GC churn)
  private bulletPool: Bullet[] = [];
  private ebulletPool: Bullet[] = [];
  // uniform spatial grid for collisions (rebuilt each frame)
  private grid: Map<number, Enemy[]> = new Map();
  private static readonly GRID_CELL = 128;

  // v2.1 speed: fps monitor + auto quality
  private fpsEMA = 60;
  private quality = 0; // 0 cinematic, 1 balanced, 2 performance, 3 potato
  private qualityT = 0;
  private goodT = 0;
  private baseParticleScale = 1;
  private qualityMode: 'auto' | 'high' | 'balanced' | 'performance' | 'potato' = 'auto';
  private renderNow = 0;
  private prevQualityApplied = 0;

  // v2.1 features: wave mutator + boss/achievement tracking
  private mutator: MutatorKind | null = null;
  private bossDamageTaken = false;
  private announced5min = false;
  // v3 systems: frost slow, weapon mods, shards meta, feel timers
  private frostT = 0;
  private novaCd = 0;
  private seekerCd = 0;
  private swCd = 0; // second-wind cooldown
  private shards = 0;
  private hives = 0;
  private recoil = 0;
  private bossSpiralAnn = false;
  private bossEnrageAnn = false;
  // v3.2 juice & pacing
  private pityT = 0; // time since last powerup drop (pity guarantee)
  private heartbeatT = 0;
  private musicT = 0;
  private moveTrailAcc = 0;
  private rerollsLeft = 1;
  // v4 goals & feel
  private victoryT = -1; // >=0 while the victory cinematic plays
  private deathBy: string | null = null;
  private dashKickX = 0;
  private dashKickY = 0;
  // v6 overdrive: endless + chain storm + voidstorm + perf
  private endless = false;
  private endlessAnn = false;
  private chainCd = 2;
  private lastStormSfx = 0;
  private stormT = 3;
  private stormWarn: { x: number; y: number; t: number } | null = null;
  private frameCount = 0;
  private reducedMotion = false;
  private stingerKills = 0;
  private bomberKills = 0;
  private defeatedBosses = new Set<EnemyKind>();
  // totals bookkeeping so victory + endless death don't double-count one run
  private accountedKills = 0;
  private accountedTime = 0;

  // cached background gradients (rebuilt on resize)
  private bgGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;

  private camX = 0;
  private camY = 0;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.cb = cb;
    this.opts = { showDamageNumbers: true, ...opts };
    this.baseParticleScale = opts.particleScale;
    this.fx.scale = opts.particleScale;
    this.audio.muted = opts.muted;
    this.qualityMode = opts.qualityMode ?? (opts.autoQuality ? 'auto' : 'high');
    this.quality = this.initialQuality();
    this.prevQualityApplied = this.quality;
    this.fx.setQuality(this.quality);
    this.fx.scale = this.baseParticleScale * this.qualityParticleMult();
    try {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (this.reducedMotion) this.opts.shakeEnabled = false;
    } catch {
      this.reducedMotion = false;
    }
  }

  /** v6: keep fighting past wave 20 — endless scaling + score fever */
  continueEndless(): void {
    if (this.victoryT < 0 || this.endless) return;
    this.endless = true;
    this.victoryT = -1;
    this.gameOverSent = false;
    this.paused = false;
    this.upgradeLock = false;
    this.intermission = 3;
    this.waveBannerT = 2.2;
    this.setAnnounce('♾️ حالت بی‌پایان! امتیاز ×۱.۵ — تا کجا می‌روی؟', 3, 3);
    this.audio.waveStart();
    this.grantAchievement('endless1');
    this.last = performance.now();
  }

  get isEndless(): boolean {
    return this.endless;
  }

  /** weak-device sniff: few cores / little RAM / mobile / small screen → start lower, no shame */
  private initialQuality(): number {
    if (this.qualityMode === 'high') return 0;
    if (this.qualityMode === 'balanced') return 1;
    if (this.qualityMode === 'performance') return 2;
    if (this.qualityMode === 'potato') return 3;
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const cores = nav.hardwareConcurrency ?? 8;
      const mem = nav.deviceMemory ?? 8;
      const mobile = /android|iphone|ipad|mobile/i.test(nav.userAgent ?? '');
      const small = Math.min(window.innerWidth, window.innerHeight) < 700;
      if (cores <= 4 || mem <= 4) return 2;
      if (mobile || small) return 1;
    } catch {
      /* ignore */
    }
    return 0;
  }

  private qualityParticleMult(): number {
    return this.quality === 0 ? 1 : this.quality === 1 ? 0.7 : this.quality === 2 ? 0.45 : 0.28;
  }

  private enemyCap(): number {
    const base = Math.min(150, 16 + this.wave * 6);
    return this.quality === 0 ? base : this.quality === 1 ? Math.min(base, 130) : this.quality === 2 ? Math.min(base, 110) : Math.min(base, 90);
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
    document.addEventListener('visibilitychange', this.onVisibility);
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
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.detach();
    this.audio.stopMusic();
  }

  private onVisibility = (): void => {
    if (document.hidden && !this.destroyed && !this.paused && this.deathT < 0) {
      // App toggles playing -> paused; no-op during upgrade/gameover overlays
      this.cb.onPauseKey();
    }
    if (document.hidden) this.clearInputs();
  };

  private onBlur = (): void => {
    this.clearInputs();
    // alt-tab / window switch would otherwise kill the run silently —
    // request a pause (App no-ops it during upgrade/gameover overlays).
    if (!this.destroyed && !this.paused && !this.upgradeLock && this.deathT < 0 && this.victoryT < 0) {
      this.cb.onPauseKey();
    }
  };

  /** prevent stuck movement keys / sticks when tab loses focus */
  private clearInputs(): void {
    this.keys.clear();
    this.leftStick.active = false;
    this.leftStick.dx = 0;
    this.leftStick.dy = 0;
    this.rightStick.active = false;
    this.rightStick.dx = 0;
    this.rightStick.dy = 0;
  }

  setPaused(p: boolean): void {
    if (this.upgradeLock || this.deathT >= 0 || this.victoryT >= 0) {
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
    this.baseParticleScale = s;
    this.fx.scale = s * this.qualityParticleMult();
  }

  setShakeEnabled(b: boolean): void {
    this.opts.shakeEnabled = b;
    if (!b) this.trauma = 0;
  }

  applyUpgrade(id: string): void {
    applyUpgrade(this.stats, id);
    if (id === 'maxhp') this.hp = Math.min(this.stats.maxHp, this.hp + 25);
    if (id === 'phoenix') this.hp = Math.min(this.stats.maxHp, this.hp + 20);
    if (id === 'orbital' && this.stats.orbitals >= 3) this.grantAchievement('orbital3');
    if (id === 'chain') this.grantAchievement('chainlord');
    if (id === 'stormrounds') this.grantAchievement('stormlord');
    this.taken.set(id, (this.taken.get(id) ?? 0) + 1);
    // v7.5 fusion: completing a synergy pair pays an achievement
    if (this.isFusionComplete()) this.grantAchievement('fusion');
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

  /** v7.5: true when any hybrid + its partner are both owned */
  private isFusionComplete(): boolean {
    const has = (k: string) => (this.taken.get(k) ?? 0) > 0;
    return (
      (has('stormrounds') && (has('chain') || has('velocity'))) ||
      (has('critnova') && (has('crit') || has('headhunter'))) ||
      (has('novadash') && (has('nova') || has('dash') || has('phasedive'))) ||
      (has('vampire') && (has('orbital') || has('lifesteal'))) ||
      (has('twinlink') && has('seeker')) ||
      (has('phoenix') && has('secondwind')) ||
      (has('temporal') && (has('dash') || has('phasedive'))) ||
      (has('midas') && (has('combomaster') || has('xp'))) ||
      (has('hyperrail') && (has('pierce') || has('sniper')))
    );
  }

  /** skip the pick for +20 HP — a strategic valve when nothing fits the build */
  skipUpgrade(): void {
    if (!this.upgradeLock) return;
    this.hp = Math.min(this.stats.maxHp, this.hp + 20);
    this.fx.pickupBurst(this.px, this.py, '#aab3cc');
    this.audio.uiClick();
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
    this.dashKickX = this.dashDx * 26;
    this.dashKickY = this.dashDy * 26;
    this.audio.dash();
    this.fx.shockwave(this.px, this.py, '#00f0ff', 90, 0.3, 3);
    this.hybridDashFx(this.px, this.py);
  }

  /** P2 dash — solo delegates to P1 so ShiftRight keeps working alone. */
  tryDashP2(): void {
    if (!this.coOp) {
      this.tryDash();
      return;
    }
    if (this.paused || this.deathT >= 0) return;
    const q = this.fighters[1];
    if (!q.alive || q.dashCd > 0 || q.dashT > 0) return;
    let dx = q.vx;
    let dy = q.vy;
    if (Math.abs(dx) + Math.abs(dy) < 10) {
      dx = Math.cos(q.aim);
      dy = Math.sin(q.aim);
    }
    const l = Math.hypot(dx, dy) || 1;
    q.dashDx = dx / l;
    q.dashDy = dy / l;
    q.dashT = 0.18;
    q.dashCd = this.stats.dashCooldownMax;
    q.invuln = Math.max(q.invuln, 0.28);
    this.audio.dash();
    this.fx.shockwave(q.x, q.y, '#ffffff', 90, 0.3, 3);
    this.hybridDashFx(q.x, q.y);
  }

  // ---------- setup ----------

  private reset(): void {
    this.stats = statsForShip(this.opts.ship, this.opts.meta);
    this.fighters = [GameEngine.freshFighter(-30), GameEngine.freshFighter(30)];
    this.fighters[0].hp = this.stats.maxHp;
    this.fighters[1].hp = this.stats.maxHp;
    this.time = 0; this.kills = 0; this.elites = 0; this.score = 0;
    this.level = 1; this.xp = 0; this.xpNext = 26;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.wave = 1;
    this.waveKills = 0;
    this.waveQuota = this.quotaFor(1);
    this.intermission = 0;
    this.spawnT = 0.2;
    this.pendingLevels = 0;
    this.taken.clear();
    this.boss = null;
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.gems = [];
    this.powerups = [];
    this.ghosts = [];
    this.grid.clear();
    this.shieldT = 0; this.overdriveT = 0; this.magnetAllT = 0;
    this.greedT = 0; this.phaseT = 0;
    this.powerupsCollected = 0;
    this.announce = null; this.announceT = 0;
    this.announcePrio = 0; this.pendingAnnounce = null;
    this.mutator = null;
    this.bossDamageTaken = false;
    this.announced5min = false;
    this.frostT = 0; this.novaCd = 4; this.seekerCd = 1.5; this.swCd = 0;
    this.shards = 0; this.hives = 0;
    this.hurtFlash = 0; this.recoil = 0;
    this.bossSpiralAnn = false; this.bossEnrageAnn = false;
    this.pityT = 0; this.heartbeatT = 0; this.musicT = 0;
    this.moveTrailAcc = 0; this.rerollsLeft = 1;
    this.victoryT = -1; this.deathBy = null;
    this.dashKickX = 0; this.dashKickY = 0;
    this.endless = false; this.endlessAnn = false;
    this.chainCd = 2; this.stormT = 3; this.stormWarn = null;
    this.frameCount = 0; this.stingerKills = 0;
    this.bomberKills = 0; this.defeatedBosses.clear();
    this.qualityT = 0; this.goodT = 0;
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
    this.accountedKills = 0;
    this.accountedTime = 0;
    // checkpoint resume: rebuild the wave-5/10/15 build on a fresh arena
    const cp: Checkpoint | null | undefined = this.opts.checkpoint;
    if (cp && cp.wave >= 5) {
      this.wave = cp.wave;
      this.waveKills = 0;
      this.waveQuota = this.quotaFor(cp.wave);
      this.score = cp.score;
      this.kills = cp.kills;
      this.elites = cp.elites;
      this.level = cp.level;
      this.xp = 0;
      this.xpNext = cp.xpNext;
      this.time = cp.time;
      this.shards = cp.shards;
      for (const [id, n] of Object.entries(cp.taken)) {
        for (let i = 0; i < n; i++) applyUpgrade(this.stats, id);
        this.taken.set(id, n);
      }
      this.hp = this.stats.maxHp;
      this.intermission = 2.5;
      this.waveBannerT = 2.2;
      this.setAnnounce(`⟳ ادامه از موج ${cp.wave} — بیلدت برگشت!`, 2.6, 2);
    }
  }

  private quotaFor(w: number): number {
    // v7: snappier early waves — faster clears, faster rewards
    return Math.round((5 + w * 4.2) * DIFF[this.opts.difficulty].quota);
  }

  // ---------- v2.1 helpers: spatial grid, pooling, achievements ----------

  private static gridKey(cx: number, cy: number): number {
    return cx * 73856093 ^ cy * 19349663;
  }

  /** rebuild the uniform grid from live enemies (called once per frame) */
  private rebuildGrid(): void {
    const g = this.grid;
    g.clear();
    const C = GameEngine.GRID_CELL;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const k = GameEngine.gridKey(
        Math.floor(e.x / C), Math.floor(e.y / C),
      );
      let cell = g.get(k);
      if (!cell) {
        cell = [];
        g.set(k, cell);
      }
      cell.push(e);
    }
  }

  /** iterate enemies near (x, y) within radius (checks 3x3 cells) */
  private forEachNear(x: number, y: number, radius: number, fn: (e: Enemy) => void): void {
    const C = GameEngine.GRID_CELL;
    const cx = Math.floor(x / C);
    const cy = Math.floor(y / C);
    const reach = Math.ceil(radius / C);
    for (let ix = cx - reach; ix <= cx + reach; ix++) {
      for (let iy = cy - reach; iy <= cy + reach; iy++) {
        const cell = this.grid.get(GameEngine.gridKey(ix, iy));
        if (!cell) continue;
        for (const e of cell) fn(e);
      }
    }
  }

  private allocBullet(friendly: boolean): Bullet {
    const pool = friendly ? this.bulletPool : this.ebulletPool;
    const b = pool.pop();
    if (b) {
      b.dead = false;
      b.hit.length = 0;
      b.homing = false;
      b.tint = null;
      return b;
    }
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 0, pierce: 0,
      life: 0, crit: false, friendly, dead: false, hit: [],
      homing: false, tint: null,
    };
  }

  private freeBullet(b: Bullet): void {
    const pool = b.friendly ? this.bulletPool : this.ebulletPool;
    if (pool.length < 256) pool.push(b);
  }

  private grantAchievement(id: string): void {
    if (!unlockAchievement(id)) return;
    const def = achievementDef(id);
    this.audio.powerup();
    // v3.2: achievements now pay 3 void shards — progression feels rewarding
    this.awardShards(3);
    this.setAnnounce(`🏆 اچیومنت: ${def ? def.nameFa : id} (+3 ◇)`, 2.6, 2);
  }

  /** void shards: permanent meta currency, shown floating at pickup point */
  private awardShards(n: number): void {
    this.shards += n;
    this.fx.text(this.px, this.py - 44, `+${n} ◇`, '#7df9ff', 15);
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
    if (e.code === 'ShiftLeft' || e.code === 'Space') {
      this.tryDash();
    } else if (e.code === 'ShiftRight' || e.code === 'Enter' || e.code === 'Numpad0') {
      // P2 dash (co-op) — harmless solo (fighters[1] is ignored there)
      this.tryDashP2();
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
    for (const t of Array.from(e.changedTouches)) {
      const r = this.canvas.getBoundingClientRect();
      const sx = t.clientX - r.left;
      const sy = t.clientY - r.top;
      if (this.leftStick.active && t.identifier === this.leftStick.id) {
        this.setStick(this.leftStick, sx, sy);
      }
      if (this.rightStick.active && t.identifier === this.rightStick.id) {
        this.setStick(this.rightStick, sx, sy);
      }
    }
  };

  /** circular clamp (radius 70) so diagonals match cardinals */
  private setStick(s: Stick, sx: number, sy: number): void {
    let dx = sx - s.ox;
    let dy = sy - s.oy;
    const l = Math.hypot(dx, dy);
    if (l > 70) {
      dx = (dx / l) * 70;
      dy = (dy / l) * 70;
    }
    s.dx = dx;
    s.dy = dy;
  }

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

  private resizeObserver: ResizeObserver | null = null;

  private attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    // catch parent-layout changes / zoom that window.resize misses
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
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
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
    // DPR cap follows quality: cinematic 2x, balanced 1.5x, performance 1.2x, potato 1x
    // (biggest fill-rate win on weak iGPUs — halves pixels to shade)
    const cap = this.quality === 0 ? 2 : this.quality === 1 ? 1.5 : this.quality === 2 ? 1.2 : 1;
    this.dpr = Math.min(cap, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    // rebuild cached background gradients (was: allocated every frame)
    const ctx = this.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, this.viewH);
    bg.addColorStop(0, '#070713');
    bg.addColorStop(1, '#040410');
    this.bgGrad = bg;
    const vg = ctx.createRadialGradient(
      this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * 0.45,
      this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * 0.78,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    this.vigGrad = vg;
  }

  setAutoQuality(on: boolean): void {
    this.opts.autoQuality = on;
    this.qualityMode = on ? 'auto' : 'high';
    if (!on && this.quality !== 0) {
      this.quality = 0;
      this.applyQuality();
    }
  }

  setQualityMode(m: 'auto' | 'high' | 'balanced' | 'performance' | 'potato'): void {
    this.qualityMode = m;
    this.opts.autoQuality = m === 'auto';
    this.opts.qualityMode = m;
    const target = m === 'auto' ? this.initialQuality() : m === 'high' ? 0 : m === 'balanced' ? 1 : m === 'performance' ? 2 : 3;
    if (target !== this.quality) {
      this.quality = target;
      this.goodT = 0;
      this.qualityT = 0;
      this.applyQuality();
      this.emitHud();
    }
  }

  setGameSpeed(s: number): void {
    this.opts.speed = s === 0.9 || s === 1.25 ? s : 1;
  }

  setShowDamageNumbers(b: boolean): void {
    this.opts.showDamageNumbers = b;
  }

  /** current upgrade stacks for UI (upgrade modal / pause build view) */
  getTakenStacks(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.taken) out[k] = v;
    return out;
  }

  getStatsSnapshot(): PlayerStats {
    return { ...this.stats };
  }

  getRerollsLeft(): number {
    return this.rerollsLeft;
  }

  /** reroll level-up choices once per level (adds risk-free build control) */
  rerollUpgrades(): import('./types').UpgradeDef[] | null {
    if (!this.upgradeLock || this.rerollsLeft <= 0) return null;
    this.rerollsLeft -= 1;
    this.audio.reroll();
    const choices = rollUpgrades(this.taken, 3);
    this.cb.onLevelUp(choices);
    return choices;
  }

  private applyQuality(): void {
    // particle scale steps: 1x / 0.7x / 0.45x / 0.28x of the user's base setting
    // juice survives because core flashes + shockwaves are kept, only satellites shrink
    const dropped = this.quality > this.prevQualityApplied;
    this.prevQualityApplied = this.quality;
    this.fx.scale = this.baseParticleScale * this.qualityParticleMult();
    this.fx.setQuality(this.quality);
    this.resize(); // re-applies DPR cap + gradient cache
    // tell the UI so it can toast "lite mode on" instead of silently degrading
    if (dropped && this.qualityMode === 'auto') {
      try {
        this.cb.onQualityChange?.(this.quality);
      } catch {
        /* ignore */
      }
    }
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
    // fps monitor drives auto-quality (skipped while paused — no meaningful sample)
    if (!this.paused && raw > 0) {
      const fps = 1 / raw;
      this.fpsEMA += (fps - this.fpsEMA) * 0.05;
      this.updateQuality(raw);
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
    // turbo pace: whole simulation runs at the chosen game speed
    // (player + enemies scale together, so relative balance is preserved)
    dt *= this.opts.speed || 1;
    this.update(dt);
    this.render();
    this.hudAcc += raw;
    if (this.hudAcc >= 0.1) {
      this.hudAcc = 0;
      this.emitHud();
    }
  }

  private updateQuality(raw: number): void {
    if (this.qualityMode !== 'auto') return;
    this.qualityT += raw;
    // react fast on drops (1s), recover slowly (8s) — no oscillation on borderline rigs
    if (this.qualityT < 1) return;
    this.qualityT = 0;
    if (this.fpsEMA < 47 && this.quality < 3) {
      this.quality += 1;
      this.goodT = 0;
      this.applyQuality();
      this.emitHud();
    } else if (this.fpsEMA > 57 && this.quality > 0) {
      this.goodT += 1;
      if (this.goodT >= 8) {
        this.goodT = 0;
        this.quality -= 1;
        this.applyQuality();
        this.emitHud();
      }
    } else if (this.fpsEMA <= 57) {
      this.goodT = 0;
    }
  }

  private emitHud(): void {
    const dots: MinimapDot[] = [];
    // boss always gets a dot (never sampled out)
    if (this.boss && this.boss.hp > 0) {
      dots.push({ x: this.boss.x, y: this.boss.y, kind: this.boss.kind });
    }
    const maxDots = 64;
    // v6: no .filter allocation — stride-sample live enemies directly
    const liveCount = this.boss ? this.enemies.length - 1 : this.enemies.length;
    const step = Math.max(1, Math.floor(Math.max(0, liveCount) / maxDots));
    let skipped = 0;
    for (let i = 0; i < this.enemies.length; i += step) {
      const e = this.enemies[i];
      if (e === this.boss) {
        skipped++;
        continue;
      }
      dots.push({ x: e.x, y: e.y, kind: e.kind, elite: e.elite });
      if (dots.length >= maxDots + 1) break;
    }
    void skipped;
    // sampled gem dots so farming is no longer blind
    if (this.gems.length > 0) {
      const gstep = Math.max(1, Math.floor(this.gems.length / 12));
      for (let i = 0; i < this.gems.length; i += gstep) {
        const g = this.gems[i];
        dots.push({ x: g.x, y: g.y, kind: 'gem' });
        if (dots.length >= maxDots + 13) break;
      }
    }
    for (const p of this.powerups.slice(0, 8)) {
      dots.push({ x: p.x, y: p.y, kind: 'powerup' });
    }
    const active: { kind: PowerUpKind; t: number }[] = [];
    if (this.shieldT > 0) active.push({ kind: 'shield', t: this.shieldT });
    if (this.overdriveT > 0) active.push({ kind: 'overdrive', t: this.overdriveT });
    if (this.magnetAllT > 0) active.push({ kind: 'magnet', t: this.magnetAllT });
    if (this.frostT > 0) active.push({ kind: 'frost', t: this.frostT });
    if (this.greedT > 0) active.push({ kind: 'greed', t: this.greedT });
    if (this.phaseT > 0) active.push({ kind: 'phase', t: this.phaseT });
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
      critMult: this.stats.critMult,
      multishot: this.stats.multishot,
      intermission: Math.max(0, this.intermission),
      waveProgress: clamp(this.waveKills / Math.max(1, this.waveQuota), 0, 1),
      waveLeft: Math.max(0, this.waveQuota - this.waveKills),
      announce: this.announceT > 0 ? this.announce : null,
      powerups: active,
      orbitals: this.stats.orbitals,
      mods: {
        nova: this.taken.get('nova') ?? 0,
        seeker: this.taken.get('seeker') ?? 0,
        chain: this.taken.get('chain') ?? 0,
        phasedive: this.taken.get('phasedive') ?? 0,
        secondwind: (this.taken.get('secondwind') ?? 0) > 0,
        swCd: Math.max(0, this.swCd),
      },
      dots,
      fps: Math.round(this.fpsEMA),
      quality: this.quality,
      mutator: this.mutator,
      endless: this.endless,
      p2: this.coOp
        ? {
            hp: Math.max(0, Math.ceil(this.fighters[1].hp)),
            maxHp: Math.round(this.stats.maxHp),
            dashCd: Math.max(0, this.fighters[1].dashCd),
            dashMax: this.stats.dashCooldownMax,
            alive: this.fighters[1].alive,
            x: this.fighters[1].x,
            y: this.fighters[1].y,
          }
        : null,
    };
    this.cb.onHud(snap);
  }

  private setAnnounce(text: string, dur = 2.2, prio = 0): void {
    // priority channel: boss warnings & achievements never get clobbered
    // by routine elite/combo chatter (queued instead and shown next).
    if (this.announceT > 0 && prio < this.announcePrio) {
      if (!this.pendingAnnounce) this.pendingAnnounce = { text, dur, prio };
      return;
    }
    this.announce = text;
    this.announceT = dur;
    this.announcePrio = prio;
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
      if (this.deathT > 1.15 && !this.gameOverSent) {
        this.gameOverSent = true;
        this.sendResult(false);
      }
      return;
    }
    if (this.victoryT >= 0) {
      this.victoryT += dt;
      this.updateBullets(dt);
      this.updateEnemies(dt);
      this.fx.update(dt);
      this.updateCamera(dt);
      // celebratory fireworks while the banner soaks in
      if (Math.random() < dt * 6) {
        this.fx.explosion(
          this.px + rand(-260, 260), this.py + rand(-200, 200),
          ['#a8ecff', '#f2e6c8', '#e8b4c8'][Math.floor(Math.random() * 3)], 12, 300,
        );
      }
      if (this.victoryT > 2.2 && !this.gameOverSent) {
        this.gameOverSent = true;
        this.sendResult(true);
      }
      return;
    }

    this.time += dt;
    this.frameCount++;
    this.score += dt * (2 + this.wave * 0.6) * (this.endless ? 1.5 : 1);
    this.pityT += dt;
    if (this.time >= 300 && !this.announced5min) {
      this.announced5min = true;
      this.grantAchievement('survivor5');
    }
    // v3.2: adaptive music intensity + low-hp heartbeat
    this.musicT += dt;
    if (this.musicT >= 1) {
      this.musicT = 0;
      const inten = Math.max(
        0,
        Math.min(
          1,
          0.12 + this.wave * 0.05 + this.enemies.length * 0.008 + (this.boss ? 0.35 : 0) +
            (this.lowestHpFrac() < 0.3 ? 0.15 : 0),
        ),
      );
      this.audio.setIntensity(inten);
    }
    if (this.lowestHpFrac() < 0.3 && this.lowestHpFrac() > 0) {
      this.heartbeatT -= dt;
      if (this.heartbeatT <= 0) {
        this.heartbeatT = 1.1;
        this.audio.heartbeat();
      }
    }

    // timers
    this.fireCd -= dt;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.coOp) {
      const q = this.fighters[1];
      q.fireCd -= dt;
      q.dashCd = Math.max(0, q.dashCd - dt);
      q.invuln = Math.max(0, q.invuln - dt);
      q.hurtFlash = Math.max(0, q.hurtFlash - dt);
    }
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.swCd = Math.max(0, this.swCd - dt);
    this.frostT = Math.max(0, this.frostT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.overdriveT = Math.max(0, this.overdriveT - dt);
    this.magnetAllT = Math.max(0, this.magnetAllT - dt);
    this.greedT = Math.max(0, this.greedT - dt);
    this.phaseT = Math.max(0, this.phaseT - dt);
    this.waveBannerT = Math.max(0, this.waveBannerT - dt);
    this.announceT = Math.max(0, this.announceT - dt);
    if (this.announceT <= 0) {
      this.announce = null;
      this.announcePrio = 0;
      if (this.pendingAnnounce) {
        const p = this.pendingAnnounce;
        this.pendingAnnounce = null;
        this.setAnnounce(p.text, p.dur, p.prio);
      }
    }
    this.gridPulse = Math.max(0, this.gridPulse - dt * 2.2);
    this.orbitalAngle += dt * 3.4;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    // regen (+ emergency protocol) — shared pool heals both pilots
    let regen = this.stats.regen;
    if ((this.taken.get('emergency') ?? 0) > 0) {
      const low = this.hp < this.stats.maxHp * 0.3 ||
        (this.coOp && this.fighters[1].alive && this.fighters[1].hp < this.stats.maxHp * 0.3);
      if (low) regen += 4 * (this.taken.get('emergency') ?? 0);
    }
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.hp < this.stats.maxHp) {
        f.hp = Math.min(this.stats.maxHp, f.hp + regen * dt);
      }
    }

    this.updatePlayer(dt);
    this.updatePlayer2(dt);
    // co-op pilots softly push apart so they never fully stack
    if (this.coOp) {
      const a = this.fighters[0];
      const b = this.fighters[1];
      if (a.alive && b.alive) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < 40 * 40) {
          const d = Math.sqrt(d2) || 1;
          const push = ((40 - d) / d) * 3;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
    this.updateDirector(dt);
    this.updateBullets(dt);
    // frost powerup: enemies move/act in slow motion (bullets keep speed)
    this.updateEnemies(this.frostT > 0 ? dt * 0.35 : dt);
    this.collide(dt);
    this.updateGems(dt);
    this.updatePowerups(dt);
    this.updateOrbitals(dt);
    this.updateNovaSeeker(dt);
    this.updateCamera(dt);
    this.fx.update(dt);
    for (const g of this.ghosts) g.life -= dt;
    sweep(this.ghosts, (g) => g.life > 0);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  /** lowest living-pilot HP fraction (P1 in solo) — drives heartbeat + vignette */
  private lowestHpFrac(): number {
    let worst = this.fighters[0].alive ? this.fighters[0].hp / this.stats.maxHp : 1;
    if (this.coOp && this.fighters[1].alive) {
      worst = Math.min(worst, this.fighters[1].hp / this.stats.maxHp);
    }
    return worst;
  }

  private calcGrade(): Grade {
    const s = this.score / Math.max(1, this.time) + this.wave * 60 + this.kills * 4 + this.maxCombo * 10;
    if (s > 2600) return 'S';
    if (s > 1700) return 'A';
    if (s > 1000) return 'B';
    if (s > 500) return 'C';
    return 'D';
  }

  /** shared run-end bookkeeping for death AND victory (victory pays a shard bonus) */
  private sendResult(victory: boolean): void {
    const upgrades = [...this.taken.keys()];
    const score = Math.floor(this.score + (victory && !this.endless ? 2500 : 0));
    this.score = score;
    const isBest = saveBest(score) || false;
    pushBoard({
      score, wave: this.wave, kills: this.kills,
      time: Math.floor(this.time), ship: this.opts.ship, date: Date.now(),
      coOp: this.coOp,
    });
    // endless continues after a victory screen — only count the delta,
    // otherwise one run lands in the totals twice.
    addTotals(this.kills - this.accountedKills, this.time - this.accountedTime, this.wave);
    this.accountedKills = this.kills;
    this.accountedTime = this.time;
    if (victory) {
      this.shards += 10;
      clearCheckpoint();
    }
    if (this.endless) this.shards += 5;
    addShards(this.shards);
    try {
      pushRun({
        score, wave: this.wave, kills: this.kills,
        time: Math.floor(this.time), ship: this.opts.ship, date: Date.now(),
        victory, endless: this.endless, coOp: this.coOp,
      });
    } catch {
      /* storage unavailable */
    }
    const result: GameResult = {
      score,
      kills: this.kills,
      elites: this.elites,
      wave: this.wave,
      level: this.level,
      time: this.time,
      maxCombo: this.maxCombo,
      grade: victory ? 'S' : this.calcGrade(),
      isBest,
      upgradesTaken: upgrades,
      ship: this.opts.ship,
      shards: this.shards,
      powerups: this.powerupsCollected,
      victory,
      endless: this.endless,
      coOp: this.coOp,
      deathBy: victory ? null : this.deathBy,
    };
    if (victory) {
      this.audio.duck(1.2);
      this.audio.powerup();
    } else {
      this.audio.gameOver();
    }
    this.cb.onGameOver(result);
  }

  private moveInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    // solo keeps the arrows; co-op gives them to P2
    const arrows = !this.coOp;
    if (this.keys.has('KeyW') || (arrows && this.keys.has('ArrowUp'))) y -= 1;
    if (this.keys.has('KeyS') || (arrows && this.keys.has('ArrowDown'))) y += 1;
    if (this.keys.has('KeyA') || (arrows && this.keys.has('ArrowLeft'))) x -= 1;
    if (this.keys.has('KeyD') || (arrows && this.keys.has('ArrowRight'))) x += 1;
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

  private moveInputP2(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  private updatePlayer(dt: number): void {
    if (!this.fighters[0].alive) return; // co-op ghost waits for the wave clear
    const mv = this.moveInput();
    const berserk = (this.taken.get('emergency') ?? 0) > 0 && this.hp < this.stats.maxHp * 0.3;
    if (this.dashT > 0) {
      this.dashT -= dt;
      const power = 1000;
      this.pvx = this.dashDx * power;
      this.pvy = this.dashDy * power;
      this.fx.trail(this.px, this.py, '#00f0ff');
      this.fx.trail(this.px, this.py, '#ffffff');
      this.fx.trail(this.px, this.py, this.shipColor());
      this.ghostAcc -= dt;
      if (this.ghostAcc <= 0) {
        this.ghostAcc = 0.025;
        this.ghosts.push({ x: this.px, y: this.py, aim: this.aim, life: 0.4 });
      }
    } else {
      const sp = this.stats.moveSpeed * (berserk ? 1.5 : 1) * (this.phaseT > 0 ? 1.3 : 1);
      const tx = mv.x * sp;
      const ty = mv.y * sp;
      const k = Math.min(1, dt * 10);
      this.pvx += (tx - this.pvx) * k;
      this.pvy += (ty - this.pvy) * k;
      // speed trail — moving fast leaves ion sparks in ship color
      const spd = Math.hypot(this.pvx, this.pvy);
      if (spd > 260) {
        this.moveTrailAcc -= dt;
        if (this.moveTrailAcc <= 0) {
          this.moveTrailAcc = 0.03;
          this.fx.trail(this.px, this.py, this.shipColor());
          if (spd > 520) this.fx.trail(this.px, this.py, '#ffffff');
        }
      }
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
      this.fireVolley(this.px, this.py, this.aim, this.pvx, this.pvy);
      const rate = this.stats.fireRate * (this.overdriveT > 0 ? 1.7 : 1);
      this.fireCd += 1 / rate;
      if (this.fireCd < -0.1) this.fireCd = 0;
      // fire recoil: tiny kick opposite aim (game feel)
      this.pvx -= Math.cos(this.aim) * 16;
      this.pvy -= Math.sin(this.aim) * 16;
      this.recoil = 1;
    }
  }

  /** P2 pilot: arrows to move, always auto-aims + auto-fires the shared build. */
  private updatePlayer2(dt: number): void {
    if (!this.coOp) return;
    const q = this.fighters[1];
    if (!q.alive) return;
    const mv = this.moveInputP2();
    const berserk = (this.taken.get('emergency') ?? 0) > 0 && q.hp < this.stats.maxHp * 0.3;
    if (q.dashT > 0) {
      q.dashT -= dt;
      const power = 1000;
      q.vx = q.dashDx * power;
      q.vy = q.dashDy * power;
      this.fx.trail(q.x, q.y, '#ffffff');
      this.fx.trail(q.x, q.y, '#fb7185');
      this.ghostAcc -= dt;
      if (this.ghostAcc <= 0) {
        this.ghostAcc = 0.025;
        this.ghosts.push({ x: q.x, y: q.y, aim: q.aim, life: 0.4 });
      }
    } else {
      const sp = this.stats.moveSpeed * (berserk ? 1.5 : 1) * (this.phaseT > 0 ? 1.3 : 1);
      const k = Math.min(1, dt * 10);
      q.vx += (mv.x * sp - q.vx) * k;
      q.vy += (mv.y * sp - q.vy) * k;
      const spd = Math.hypot(q.vx, q.vy);
      if (spd > 260) {
        this.moveTrailAcc -= dt;
        if (this.moveTrailAcc <= 0) {
          this.moveTrailAcc = 0.03;
          this.fx.trail(q.x, q.y, '#ffffff');
        }
      }
    }
    q.x = clamp(q.x + q.vx * dt, 24, WORLD_W - 24);
    q.y = clamp(q.y + q.vy * dt, 24, WORLD_H - 24);
    // auto-aim the nearest threat, else keep the last heading
    const near = this.nearestEnemyFrom(q.x, q.y, 900);
    if (near) q.aim = angleTo(q.x, q.y, near.x, near.y);
    else if (Math.hypot(mv.x, mv.y) > 0.1) q.aim = Math.atan2(mv.y, mv.x);
    if (q.fireCd <= 0) {
      this.fireVolley(q.x, q.y, q.aim, q.vx, q.vy);
      const rate = this.stats.fireRate * (this.overdriveT > 0 ? 1.7 : 1);
      q.fireCd += 1 / rate;
      if (q.fireCd < -0.1) q.fireCd = 0;
    }
  }

  private nearestEnemy(maxD: number): Enemy | null {
    return this.nearestEnemyFrom(this.px, this.py, maxD);
  }

  private nearestEnemyFrom(x: number, y: number, maxD: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.spawnT > 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private nearestEnemies(x: number, y: number, maxD: number, count: number): Enemy[] {
    const maxD2 = maxD * maxD;
    const out: { e: Enemy; d: number }[] = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.spawnT > 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d > maxD2) continue;
      // tiny insertion sort — count <= 9 so this is cheaper than Array.sort
      let i = out.length;
      out.push({ e, d });
      while (i > 0 && out[i].d < out[i - 1].d) {
        const tmp = out[i];
        out[i] = out[i - 1];
        out[i - 1] = tmp;
        i--;
      }
      if (out.length > count) out.pop();
    }
    return out.map((o) => o.e);
  }

  private fireVolley(x: number, y: number, aim: number, vx: number, vy: number): void {
    const n = this.stats.multishot;
    const base = aim;
    const od = this.overdriveT > 0 ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * this.stats.spread * 2.2;
      const a = base + off + rand(-0.02, 0.02);
      const crit = Math.random() < this.stats.critChance;
      const dmg = this.stats.damage * od * (crit ? this.stats.critMult : 1) * rand(0.92, 1.08);
      const sp = this.stats.bulletSpeed;
      const b = this.allocBullet(true);
      b.x = x + Math.cos(a) * 20;
      b.y = y + Math.sin(a) * 20;
      b.vx = Math.cos(a) * sp + vx * 0.25;
      b.vy = Math.sin(a) * sp + vy * 0.25;
      b.r = crit ? 6.5 : 5;
      b.dmg = dmg;
      b.pierce = this.stats.pierce;
      b.life = 1.4;
      b.crit = crit;
      this.bullets.push(b);
    }
    this.fx.muzzle(x + Math.cos(base) * 22, y + Math.sin(base) * 22, base, '#00f0ff');
    this.fx.muzzle(x + Math.cos(base) * 22, y + Math.sin(base) * 22, base, '#ffffff');
    this.audio.shoot();
  }

  /** v7.5 hybrids fired on every dash: nova blast + temporal slow */
  private hybridDashFx(x: number, y: number): void {
    const nd = this.taken.get('novadash') ?? 0;
    if (nd > 0) {
      const dmg = this.stats.damage * (1.6 + nd * 0.9);
      this.novaBurstAt(x, y, 170 + nd * 30, dmg, '#ff9f1c');
      this.audio.nova();
      if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.15);
    }
    const tp = this.taken.get('temporal') ?? 0;
    if (tp > 0) {
      this.frostT = Math.max(this.frostT, 0.7 + tp * 0.45);
      this.fx.shockwave(x, y, '#7dd3fc', 200, 0.5, 5);
      this.fx.text(x, y - 34, '⏳ زمان کند شد!', '#7dd3fc', 15);
    }
  }

  /** v7.5: radial nova burst shared by Nova Drive + Phoenix rebirth */
  private novaBurstAt(x: number, y: number, radius: number, dmg: number, color: string): void {
    this.fx.shockwave(x, y, color, radius * 1.4, 0.5, 6);
    this.fx.explosion(x, y, color, 24, 420);
    this.forEachNear(x, y, radius + 64, (e) => {
      if (e.hp <= 0 || e.spawnT > 0) return;
      const rr = radius + e.r;
      if (dist2(x, y, e.x, e.y) < rr * rr) {
        this.damageEnemy(e, dmg * (isBossKind(e.kind) ? 0.35 : 1), false, e.x - x, e.y - y);
      }
    });
    this.sweepDeadEnemies();
  }

  /** v7.5 Storm Rounds: bullet impact arcs lightning across nearby enemies */
  private stormZap(x: number, y: number, dmg: number, count: number): void {
    const targets = this.nearestEnemies(x, y, 460, count);
    if (targets.length === 0) return;
    let px = x;
    let py = y;
    for (const tgt of targets) {
      this.fx.shockwave(tgt.x, tgt.y, '#5df2ff', 60, 0.3, 3);
      this.fx.explosion(tgt.x, tgt.y, '#5df2ff', 6, 300);
      this.fx.hitSpark((px + tgt.x) / 2, (py + tgt.y) / 2, Math.atan2(tgt.y - py, tgt.x - px), '#ffffff');
      this.damageEnemy(tgt, dmg, false, tgt.x - px, tgt.y - py);
      px = tgt.x;
      py = tgt.y;
    }
    // throttle: high fire-rate builds would otherwise stack nova noise every frame
    const nowMs = performance.now();
    if (nowMs - this.lastStormSfx > 160) {
      this.lastStormSfx = nowMs;
      this.audio.nova();
    }
  }

  private updateDirector(dt: number): void {
    if (this.victoryT >= 0) return;
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
          this.mutator = null;
          this.setAnnounce(`⚠ موج ${this.wave} — ${ENEMY_FA[bossVariantForWave(this.wave)]} نزدیک است!`, 2.6, 3);
          this.spawnBoss();
        } else {
          this.rollMutator();
        }
        // v7 hook: wave 2 opens with a guaranteed elite + welcome powerup
        if (this.wave === 2) {
          const p = this.spawnPos();
          const e = this.makeEnemy('chaser', p.x, p.y);
          e.spawnT = 0.7;
          e.elite = true;
          e.hp = e.maxHp = Math.round(e.maxHp * 3.2);
          e.xp *= 5;
          e.score *= 4;
          e.r *= 1.22;
          this.enemies.push(e);
          this.fx.text(p.x, p.y - 24, 'ELITE! 🎁', '#ffd319', 16);
          this.dropPowerup(this.px + 120, this.py - 80, false);
          this.setAnnounce('🎁 الیت اول + هدیه — بزنش!', 2.4, 2);
        }
        if (this.wave >= 10) this.grantAchievement('wave10');
      }
      return;
    }
    const d = DIFF[this.opts.difficulty];
    this.spawnT -= dt;
    const aliveWeight = this.enemies.length;
    const cap = this.enemyCap();
    if (this.spawnT <= 0 && aliveWeight < cap && this.waveKills < this.waveQuota) {
      // v3.2: snappier early game — denser spawns from wave 3
      let interval = Math.max(0.1, (rand(0.4, 0.85) - this.wave * 0.055) * d.interval);
      if (this.mutator === 'swarm') interval *= 0.55;
      if (this.mutator === 'frenzy') interval *= 0.7;
      this.spawnT = interval;
      const r = Math.random();
      const batch = this.wave >= 6 && r < 0.22 ? 3 : this.wave >= 3 && r < 0.42 ? 2 : 1;
      for (let i = 0; i < batch; i++) this.spawnEnemy();
    }
    if (this.waveKills >= this.waveQuota && this.enemies.length === 0 && this.deathT < 0 && this.victoryT < 0) {
      // wave cleared — vacuum gems briefly so rewards feel instant
      this.score += 100 * this.wave;
      for (const f of this.fighters) {
        if (!f.alive && this.coOp) {
          // co-op comeback: the fallen pilot drops back in at half health
          f.alive = true;
          f.hp = Math.round(this.stats.maxHp * 0.5);
          f.invuln = 2;
          const anchor = this.fighters[0].alive ? this.fighters[0] : f;
          f.x = clamp(anchor.x + rand(-60, 60), 24, WORLD_W - 24);
          f.y = clamp(anchor.y + rand(-60, 60), 24, WORLD_H - 24);
          this.setAnnounce('💚 هم‌تیمی برگشت!', 2.2, 2);
          this.fx.shockwave(f.x, f.y, '#3dff8e', 160, 0.6, 5);
        }
        if (f.alive) f.hp = Math.min(this.stats.maxHp, f.hp + this.stats.maxHp * 0.12);
      }
      if (this.coOp && this.wave === 10) this.grantAchievement('blood_brothers');
      this.magnetAllT = Math.max(this.magnetAllT, 1.6);
      if (this.wave >= WIN_WAVE && !this.endless) {
        // ★ VICTORY — the void is conquered. Endless continues after the screen.
        this.victoryT = 0;
        this.slowmoT = Math.max(this.slowmoT, 1.2);
        this.trauma = this.reducedMotion ? 0 : Math.min(1, this.trauma + 0.4);
        const vc = this.celebrate();
        this.fx.shockwave(vc.x, vc.y, '#f2e6c8', 420, 1, 7);
        this.fx.explosion(vc.x, vc.y, '#f2e6c8', 60, 520);
        this.setAnnounce(`✦ پیروزی! خلأ در موج ${WIN_WAVE} رام شد (+10 ◇)`, 3, 3);
        this.audio.duck(1.2);
        this.audio.levelup();
        this.emitHud();
        return;
      }
      if (this.endless && !this.endlessAnn) {
        this.endlessAnn = true;
      }
      if (this.mutator === 'voidstorm') this.grantAchievement('stormrider');
      // checkpoint every 5 cleared waves (pre-victory): crash insurance + comeback
      if (this.wave % 5 === 0 && this.wave < WIN_WAVE) {
        const taken: Record<string, number> = {};
        for (const [k, v] of this.taken) taken[k] = v;
        saveCheckpoint({
          v: 1, ship: this.opts.ship, difficulty: this.opts.difficulty,
          wave: this.wave, score: Math.floor(this.score), kills: this.kills,
          elites: this.elites, level: this.level, xpNext: this.xpNext,
          taken, time: Math.floor(this.time), shards: this.shards, date: Date.now(),
        });
      }
      const endlessTag = this.endless ? ' ♾️×۱.۵' : '';
      this.setAnnounce(`موج ${this.wave} پاکسازی شد! +${100 * this.wave}${endlessTag}`, 2, 1);
      if (!this.endless && this.wave === WIN_WAVE - 1) {
        this.setAnnounce(`موج ${this.wave} پاکسازی شد! یک موج تا پیروزی…`, 2.4, 2);
      }
      const wc = this.celebrate();
      this.fx.shockwave(wc.x, wc.y, '#ffd319', 200, 0.6, 5);
      this.audio.levelup();
      this.intermission = 2.0;
      this.emitHud();
    }
    // v6 voidstorm: telegraphed lightning — hurts everyone, dodge the ring
    if (this.mutator === 'voidstorm' && this.deathT < 0 && this.victoryT < 0) {
      this.stormT -= dt;
      if (!this.stormWarn && this.stormT <= 0.8 && this.stormT > 0) {
        const sx = clamp(this.px + rand(-260, 260), 40, WORLD_W - 40);
        const sy = clamp(this.py + rand(-200, 200), 40, WORLD_H - 40);
        this.stormWarn = { x: sx, y: sy, t: 0.8 };
        this.fx.text(sx, sy - 30, '⚡', '#5df2ff', 22);
      }
      if (this.stormWarn) {
        this.stormWarn.t -= dt;
        if (this.stormWarn.t <= 0) {
          const { x: sx, y: sy } = this.stormWarn;
          this.stormWarn = null;
          this.stormT = Math.max(1.6, 3.2 - this.wave * 0.06);
          this.fx.shockwave(sx, sy, '#5df2ff', 150, 0.4, 6);
          this.fx.explosion(sx, sy, '#5df2ff', 26, 480);
          this.audio.nova();
          if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.25);
          // hurts pilots standing in it
          for (let i = 0; i < this.fighters.length; i++) {
            const f = this.fighters[i];
            if (!f.alive) continue;
            if (i === 1 && !this.coOp) continue;
            if (dist2(sx, sy, f.x, f.y) < 95 * 95) {
              this.damageFighter(i, 18 + this.wave, sx, sy, 'طوفان خلأ');
            }
          }
          // and melts enemies too — risk/reward kiting
          for (const e of this.enemies) {
            if (e.hp > 0 && e.spawnT <= 0 && dist2(sx, sy, e.x, e.y) < 130 * 130) {
              this.damageEnemy(e, 60 + this.wave * 4, false, e.x - sx, e.y - sy);
            }
          }
          this.sweepDeadEnemies();
        }
      }
    } else {
      this.stormWarn = null;
    }
  }

  /** v2.1: every 3rd non-boss wave (from wave 3) rolls a mutator */
  private rollMutator(): void {
    if (this.wave < 3 || this.wave % 3 !== 0) {
      this.mutator = null;
      return;
    }
    const kinds: MutatorKind[] = ['swarm', 'snipers', 'elite_hunt', 'surge', 'gold_rush', 'voidstorm', 'frenzy'];
    this.mutator = kinds[Math.floor(Math.random() * kinds.length)];
    const def = MUTATORS[this.mutator];
    this.setAnnounce(`🌀 موتاتور: ${def.nameFa}! (امتیاز ×${def.scoreMult})`, 2.6, 2);
    if (this.mutator === 'elite_hunt') {
      for (let i = 0; i < 3; i++) {
        const p = this.spawnPos();
        const e = this.makeEnemy(this.pickKind(), p.x, p.y);
        e.spawnT = 0.7;
        if (!e.elite) {
          e.elite = true;
          e.hp = e.maxHp = Math.round(e.maxHp * 3.2);
          e.xp *= 5;
          e.score *= 4;
          e.r *= 1.22;
        }
        this.enemies.push(e);
      }
    }
  }

  private spawnPos(margin = 60): { x: number; y: number } {
    // co-op spawns ring the midpoint so neither pilot is farmed
    const focus = this.focusPoint();
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * TAU;
      const rad = Math.max(this.viewW, this.viewH) * 0.62 + rand(0, 220);
      const x = clamp(focus.x + Math.cos(a) * rad, margin, WORLD_W - margin);
      const y = clamp(focus.y + Math.sin(a) * rad, margin, WORLD_H - margin);
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
    return pickKindFor(this.wave, this.mutator);
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    return createEnemy(kind, x, y, {
      id: this.nextId++,
      wave: this.wave,
      time: this.time,
      difficulty: this.opts.difficulty,
      mutator: this.mutator,
      endless: this.endless,
    });
  }

  private spawnEnemy(force?: EnemyKind): void {
    const kind = force ?? this.pickKind();
    const p = this.spawnPos();
    const e = this.makeEnemy(kind, p.x, p.y);
    e.spawnT = 0.7; // phase-in portal: invulnerable + harmless
    this.enemies.push(e);
    this.fx.shockwave(p.x, p.y, ENEMY_COLOR[kind], 40, 0.5, 2);
    if (e.elite) {
      this.fx.text(p.x, p.y - 24, 'ELITE!', '#ffd319', 16);
    }
  }

  private spawnBoss(): void {
    const p = this.spawnPos(140);
    const variant = bossVariantForWave(this.wave);
    const boss = this.makeEnemy(variant, p.x, p.y);
    boss.spawnT = 1.2;
    boss.summonT = 6;
    this.enemies.push(boss);
    this.boss = boss;
    this.bossDamageTaken = false;
    this.bossSpiralAnn = false;
    this.bossEnrageAnn = false;
    this.audio.bossSpawn();
    this.audio.duck(1.0);
    this.trauma = this.reducedMotion ? 0 : Math.min(1, this.trauma + 0.7);
    this.fx.shockwave(p.x, p.y, ENEMY_COLOR[variant], 320, 0.8, 7);
    this.fx.text(p.x, p.y - 60, ENEMY_FA[variant], ENEMY_COLOR[variant], 30);
    this.slowmoT = 0.5;
  }

  /** pooled enemy bullet spawn (no allocation in hot path) */
  private fireEnemyBullet(
    x: number, y: number, vx: number, vy: number,
    r: number, dmg: number, life: number,
  ): void {
    const b = this.allocBullet(false);
    const mult = bulletSpeedMultFor(this.opts.difficulty);
    b.x = x; b.y = y; b.vx = vx * mult; b.vy = vy * mult;
    b.r = r; b.dmg = dmg; b.life = life;
    b.pierce = 0; b.crit = false;
    this.ebullets.push(b);
  }

  private updateBullets(dt: number): void {
    // homing retarget every 3rd frame — 3x fewer O(n) scans, same feel
    const retarget = this.frameCount % 3 === 0;
    for (const b of this.bullets) {
      // seeker missiles steer toward the nearest enemy (limited turn rate)
      if (b.homing && !b.dead && retarget) {
        const tgt = this.nearestEnemyFrom(b.x, b.y, 1100);
        if (tgt) {
          const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let d = want - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          const turn = 6 * dt * 3;
          const na = cur + clamp(d, -turn, turn);
          const sp = Math.hypot(b.vx, b.vy) || 1;
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
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
    // swap-remove + recycle into pools (no per-frame allocation)
    this.sweepDeadBullets(this.bullets);
    this.sweepDeadBullets(this.ebullets);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 5);
      e.fireCd -= dt;
      e.orbHitCd = Math.max(0, e.orbHitCd - dt);
      // spawn phase-in: frozen, harmless, invulnerable (portal effect)
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        e.flash = Math.max(e.flash, 0.4);
        continue;
      }
      // knockback decay
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= 1 - Math.min(1, dt * 8);
      e.ky *= 1 - Math.min(1, dt * 8);

      // co-op: each enemy hunts its nearest living pilot
      const tgt = this.coOp
        ? pickTarget(e.x, e.y, this.fighters[0], this.fighters[1])
        : this.fighters[0];
      const px = tgt.x;
      const py = tgt.y;
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
              e.vx = e.lockDx * 700;
              e.vy = e.lockDy * 700;
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
        case 'lancer': {
          // v3: long-range charger — 0 stalk, 1 aim telegraph, 2 lance dash, 3 recover
          e.stateT -= dt;
          if (e.state === 0) {
            e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 3.5);
            e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 3.5);
            if (dist < 560 && dist > 180 && e.stateT <= 0) {
              e.state = 1;
              e.stateT = 0.5;
            }
          } else if (e.state === 1) {
            e.vx *= 1 - Math.min(1, dt * 5);
            e.vy *= 1 - Math.min(1, dt * 5);
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.5;
              e.vx = e.lockDx * 840;
              e.vy = e.lockDy * 840;
              this.fx.trail(e.x, e.y, '#2dd4bf');
              this.audio.dash();
            }
          } else if (e.state === 2) {
            if (e.stateT <= 0) {
              e.state = 3;
              e.stateT = 1.2;
            }
          } else {
            e.vx *= 1 - Math.min(1, dt * 3);
            e.vy *= 1 - Math.min(1, dt * 3);
            if (e.stateT <= 0) {
              e.state = 0;
              e.stateT = rand(0.6, 1.4);
            }
          }
          break;
        }
        case 'hive': {
          // v3: slow carrier — drifts at player, births a mini every 4.5s
          e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 1.5);
          e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 1.5);
          if (e.fireCd <= 0) {
            e.fireCd = 4.5;
            let minis = 0;
            for (const o of this.enemies) {
              if (o.kind === 'mini' && o.hp > 0 && ++minis >= 12) break;
            }
            if (minis < 12) {
              const m = this.makeEnemy('mini', e.x + rand(-24, 24), e.y + rand(-24, 24));
              m.spawnT = 0.4;
              this.enemies.push(m);
              this.fx.pickupBurst(e.x, e.y, ENEMY_COLOR.hive);
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
            const sp = 330 + this.wave * 8;
            this.fireEnemyBullet(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 6, e.dmg, 3.2);
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
              const sp = 570 + this.wave * 10;
              this.fireEnemyBullet(e.x, e.y, e.lockDx * sp, e.lockDy * sp, 5, e.dmg, 2.6);
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
        case 'stinger': {
          // v6: fast skirmisher — strafes close then unloads a 3-round burst
          const want = 300;
          const dir = dist > want + 60 ? 1 : dist < want - 60 ? -1 : 0;
          const strafeAng = ang + Math.PI / 2 * e.strafe;
          const tx = Math.cos(ang) * dir * e.speed + Math.cos(strafeAng) * e.speed * 0.8;
          const ty = Math.sin(ang) * dir * e.speed + Math.sin(strafeAng) * e.speed * 0.8;
          e.vx += (tx - e.vx) * Math.min(1, dt * 3.5);
          e.vy += (ty - e.vy) * Math.min(1, dt * 3.5);
          if (Math.random() < dt * 0.6) e.strafe *= -1;
          e.stateT -= dt;
          if (e.state === 0 && e.fireCd <= 0 && dist < 560) {
            e.state = 1;
            e.stateT = 0.45;
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
          } else if (e.state === 1) {
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.32;
              // 3-round burst with slight spread
              for (let k = -1; k <= 1; k++) {
                const a = Math.atan2(e.lockDy, e.lockDx) + k * 0.12;
                                const sp = 420 + this.wave * 8;
                this.fireEnemyBullet(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 5, e.dmg, 2.4);
              }
              this.audio.enemyShoot();
              this.fx.muzzle(e.x, e.y, Math.atan2(e.lockDy, e.lockDx), '#5df2ff');
            }
          } else if (e.state === 2) {
            if (e.stateT <= 0) {
              e.state = 0;
              e.fireCd = rand(1.4, 2.2);
            }
          }
          break;
        }
        case 'bomber': {
          // drifts at the player; beeps 0.8s up close, then detonates
          e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 2);
          e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 2);
          e.stateT -= dt;
          if (e.state === 0 && dist < 170) {
            e.state = 1;
            e.stateT = 0.8;
            this.audio.enemyShoot();
          } else if (e.state === 1) {
            e.vx *= 1 - Math.min(1, dt * 6);
            e.vy *= 1 - Math.min(1, dt * 6);
            e.flash = Math.max(e.flash, 0.5);
            if (Math.random() < dt * 20) this.fx.trail(e.x, e.y, '#f43f5e');
            if (e.stateT <= 0) {
              for (let i = 0; i < 10; i++) {
                const a = (i / 10) * TAU + rand(-0.1, 0.1);
                this.fireEnemyBullet(e.x, e.y, Math.cos(a) * 240, Math.sin(a) * 240, 6, e.dmg * 0.7, 3);
              }
              this.fx.shockwave(e.x, e.y, '#f43f5e', 150, 0.45, 6);
              this.fx.explosion(e.x, e.y, '#f43f5e', 30, 420);
              this.audio.nova();
              if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.3);
              if (dist2(e.x, e.y, px, py) < 115 * 115) {
                this.damagePlayer(24 + this.wave * 0.6, e.x, e.y, 'بمب‌افکن');
              }
              e.hp = 0; // dies in its own blast (killEnemy awards the kill)
            }
          }
          break;
        }
        case 'tesla': {
          // turret: holds ~460 range, telegraphs a line, then zaps
          const want = 460;
          const dir = dist > want + 60 ? 1 : dist < want - 60 ? -1 : 0;
          const tx = Math.cos(ang) * dir * e.speed;
          const ty = Math.sin(ang) * dir * e.speed;
          e.vx += (tx - e.vx) * Math.min(1, dt * 2);
          e.vy += (ty - e.vy) * Math.min(1, dt * 2);
          e.stateT -= dt;
          if (e.state === 0 && e.fireCd <= 0 && dist < 600) {
            e.state = 1;
            e.stateT = 0.6;
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            this.audio.sniperShot();
          } else if (e.state === 1) {
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            if (e.stateT <= 0) {
              e.state = 0;
              e.fireCd = rand(2.2, 3);
              const a = Math.atan2(e.lockDy, e.lockDx);
              this.fx.hitSpark((e.x + px) / 2, (e.y + py) / 2, a, '#93c5fd');
              this.fx.shockwave(e.x, e.y, '#93c5fd', 90, 0.3, 4);
              this.audio.nova();
              if (dist < 560) {
                this.damagePlayer(10 + this.wave * 0.5, e.x, e.y, 'تسلا');
              }
            }
          }
          break;
        }
        case 'juggernaut': {
          // slow siege engine: radial fire + telegraphed lane charges
          const enraged = e.hp < e.maxHp * 0.35;
          const tier = Math.max(1, Math.round(this.wave / 5));
          if (!this.bossEnrageAnn && enraged) {
            this.bossEnrageAnn = true;
            this.setAnnounce('🔥 خشم جاگرنات!', 2.2, 3);
            this.audio.bossSpawn();
            this.trauma = Math.min(1, this.trauma + 0.5);
          }
          e.stateT -= dt;
          if (e.state === 0) {
            e.vx += (Math.cos(ang) * e.speed - e.vx) * Math.min(1, dt * 1.6);
            e.vy += (Math.sin(ang) * e.speed - e.vy) * Math.min(1, dt * 1.6);
            if (e.fireCd <= 0) {
              e.fireCd = Math.max(1.4, 2.8 - tier * 0.15);
              const n = enraged ? 14 : 10;
              const off = Math.random() * TAU;
              for (let i = 0; i < n; i++) {
                const a = off + (i / n) * TAU;
                this.fireEnemyBullet(e.x, e.y, Math.cos(a) * 250, Math.sin(a) * 250, 7, e.dmg * 0.65, 4);
              }
              this.audio.enemyShoot();
              this.fx.shockwave(e.x, e.y, '#ff5d00', 170, 0.4, 5);
            }
            if (e.stateT <= 0 && dist < 700) {
              e.state = 1;
              e.stateT = 0.7;
              e.lockDx = Math.cos(ang);
              e.lockDy = Math.sin(ang);
            }
          } else if (e.state === 1) {
            e.vx *= 1 - Math.min(1, dt * 5);
            e.vy *= 1 - Math.min(1, dt * 5);
            e.lockDx = Math.cos(ang);
            e.lockDy = Math.sin(ang);
            e.flash = Math.max(e.flash, 0.4);
            if (e.stateT <= 0) {
              e.state = 2;
              e.stateT = 0.55;
              e.vx = e.lockDx * (enraged ? 780 : 640);
              e.vy = e.lockDy * (enraged ? 780 : 640);
              this.fx.trail(e.x, e.y, '#ff5d00');
              this.audio.dash();
              if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.35);
            }
          } else if (e.state === 2) {
            if (e.stateT <= 0) {
              e.state = 0;
              e.stateT = enraged ? 2.2 : 3.4;
            }
          }
          break;
        }
        case 'tempest': {
          // skirmisher boss: strafes at range, aimed bursts, escorts + lightning
          const enraged = e.hp < e.maxHp * 0.35;
          if (!this.bossEnrageAnn && enraged) {
            this.bossEnrageAnn = true;
            this.setAnnounce('🌩️ خشم تمپست!', 2.2, 3);
            this.audio.bossSpawn();
          }
          const want = 430;
          const dir = dist > want + 60 ? 1 : dist < want - 60 ? -1 : 0;
          const strafeAng = ang + Math.PI / 2 * e.strafe;
          const tx = Math.cos(ang) * dir * e.speed + Math.cos(strafeAng) * e.speed * 0.9;
          const ty = Math.sin(ang) * dir * e.speed + Math.sin(strafeAng) * e.speed * 0.9;
          e.vx += (tx - e.vx) * Math.min(1, dt * 2.5);
          e.vy += (ty - e.vy) * Math.min(1, dt * 2.5);
          if (Math.random() < dt * 0.5) e.strafe *= -1;
          if (e.fireCd <= 0 && dist < 700) {
            e.fireCd = enraged ? 1.3 : 1.8;
            const a0 = angleTo(e.x, e.y, px, py);
            for (let k = -1; k <= 1; k++) {
              const a = a0 + k * 0.14;
              const sp = 460 + this.wave * 8;
              this.fireEnemyBullet(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 5, e.dmg * 0.7, 2.6);
            }
            this.audio.enemyShoot();
            this.fx.muzzle(e.x, e.y, a0, '#d8b4fe');
          }
          e.summonT -= dt;
          if (e.summonT <= 0) {
            e.summonT = enraged ? 7 : 10;
            for (let i = 0; i < 2; i++) {
              const m = this.makeEnemy(i === 0 ? 'stinger' : 'dasher', e.x + rand(-90, 90), e.y + rand(-90, 90));
              m.spawnT = 0.5;
              this.enemies.push(m);
            }
            this.fx.shockwave(e.x, e.y, '#d8b4fe', 150, 0.5, 4);
          }
          e.spiralT -= dt;
          if (e.state === 0 && e.spiralT <= 0) {
            e.state = 1;
            e.stateT = 0.7;
            e.lockDx = px;
            e.lockDy = py;
            this.fx.text(px, py - 30, '⚡', '#d8b4fe', 20);
            this.audio.sniperShot();
          } else if (e.state === 1) {
            if (e.stateT <= 0) {
              e.state = 0;
              e.spiralT = enraged ? 3.2 : 4.5;
              const sx = e.lockDx;
              const sy = e.lockDy;
              this.fx.shockwave(sx, sy, '#d8b4fe', 140, 0.4, 6);
              this.fx.explosion(sx, sy, '#d8b4fe', 22, 440);
              this.audio.nova();
              if (dist2(sx, sy, px, py) < 100 * 100) {
                this.damagePlayer(20 + this.wave * 0.6, sx, sy, 'تمپست');
              }
              for (const o of this.enemies) {
                if (o.hp > 0 && o.spawnT <= 0 && o !== e && dist2(sx, sy, o.x, o.y) < 120 * 120) {
                  this.damageEnemy(o, 50 + this.wave * 3, false, o.x - sx, o.y - sy);
                }
              }
              this.sweepDeadEnemies();
            }
          }
          break;
        }
        case 'boss': {
          const enraged = e.hp < e.maxHp * 0.32;
          // v3: boss tiers — every 5 waves the boss fights dirtier
          const tier = Math.max(1, Math.round(this.wave / 5));
          if (!this.bossSpiralAnn && e.hp < e.maxHp * 0.55) {
            this.bossSpiralAnn = true;
            this.setAnnounce('🌀 باس الگوی مارپیچ را آغاز کرد!', 2.2, 3);
            this.audio.bossSpawn();
          }
          if (!this.bossEnrageAnn && enraged) {
            this.bossEnrageAnn = true;
            this.setAnnounce('🔥 خشم نهایی باس!', 2.2, 3);
            this.audio.bossSpawn();
            this.trauma = Math.min(1, this.trauma + 0.5);
          }
          const sp = e.speed * (enraged ? 1.5 : 1);
          e.vx += (Math.cos(ang) * sp - e.vx) * Math.min(1, dt * 1.6);
          e.vy += (Math.sin(ang) * sp - e.vy) * Math.min(1, dt * 1.6);
          // radial burst (denser at higher tiers)
          if (e.fireCd <= 0) {
            e.fireCd = Math.max(1.1, (enraged ? 1.5 : 2.4) - tier * 0.15);
            const n = (enraged ? 14 : 10) + (tier >= 3 ? 4 : 0);
            const off = Math.random() * TAU;
            for (let i = 0; i < n; i++) {
              const a = off + (i / n) * TAU;
              this.fireEnemyBullet(e.x, e.y, Math.cos(a) * 260, Math.sin(a) * 260, 7, e.dmg * 0.7, 4);
            }
            this.audio.enemyShoot();
            this.fx.shockwave(e.x, e.y, '#ff2244', 160, 0.4, 4);
          }
          // v2.1: spiral pattern below 55% HP (faster when enraged / high tier)
          if (e.hp < e.maxHp * 0.55) {
            e.spiralT -= dt;
            if (e.spiralT <= 0) {
              e.spiralT = (enraged ? 0.14 : 0.22) * (tier >= 3 ? 0.75 : 1);
              e.spiralA += 0.55;
              for (let k = 0; k < 2; k++) {
                const a = e.spiralA + k * Math.PI;
                this.fireEnemyBullet(
                  e.x, e.y, Math.cos(a) * 220, Math.sin(a) * 220,
                  6, e.dmg * 0.55, 4.5,
                );
              }
            }
          }
          // v3: tier 2+ summons dasher escorts
          if (tier >= 2) {
            e.summonT -= dt;
            if (e.summonT <= 0) {
              e.summonT = 9;
              const count = tier >= 3 ? 3 : 2;
              for (let i = 0; i < count; i++) {
                const m = this.makeEnemy('dasher', e.x + rand(-80, 80), e.y + rand(-80, 80));
                m.spawnT = 0.5;
                this.enemies.push(m);
              }
              this.fx.shockwave(e.x, e.y, '#ffcf1c', 150, 0.5, 4);
            }
          }
          // charge
          e.stateT -= dt;
          if (e.stateT <= 0) {
            e.stateT = enraged ? 4 : 6;
            e.state = e.state === 0 ? 1 : 0;
            if (e.state === 1) {
              e.vx = Math.cos(ang) * 560;
              e.vy = Math.sin(ang) * 560;
              this.trauma = Math.min(1, this.trauma + 0.35);
            } else {
              // spawn minis
              for (let i = 0; i < 3; i++) {
                const m = this.makeEnemy('mini', e.x + rand(-60, 60), e.y + rand(-60, 60));
                m.spawnT = 0.35;
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

    // separation (cheap, capped — temporal LOD on low quality: every 2nd frame)
    const n = this.enemies.length;
    const sepSkip = this.quality >= 2 && this.frameCount % 2 === 1;
    if (n > 1 && n <= 170 && !sepSkip) {
      const sepK = Math.min(1, dt * 60);
      for (let i = 0; i < n; i++) {
        const a = this.enemies[i];
        for (let j = i + 1; j < n; j++) {
          const b = this.enemies[j];
          const rr = a.r + b.r;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < rr * rr) {
            const d = Math.sqrt(d2) || 1;
            const push = ((rr - d) / d) * 1.4 * sepK;
            const nx = dx / d;
            const ny = dy / d;
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
    this.rebuildGrid();
    // friendly bullets vs enemies (spatial grid: only nearby cells)
    const stormChance = stormProcChance(this.taken);
    const stormN = stormChance > 0 ? stormTargets(this.taken) : 0;
    const stormDmg = stormChance > 0
      ? this.stats.damage * (0.9 + (this.taken.get('stormrounds') ?? 0) * 0.4) * ((this.taken.get('chain') ?? 0) > 0 ? 1.3 : 1)
      : 0;
    for (const b of this.bullets) {
      if (b.dead) continue;
      this.forEachNear(b.x, b.y, 64, (e) => {
        if (b.dead || e.hp <= 0 || e.spawnT > 0 || b.hit.indexOf(e.id) >= 0) return;
        const rr = b.r + e.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hit.push(e.id);
          this.damageEnemy(e, b.dmg, b.crit, b.vx, b.vy);
          // v7.5 Storm Rounds: impact arcs lightning (once per bullet)
          if (stormChance > 0 && !b.homing && Math.random() < stormChance) {
            this.stormZap(b.x, b.y, stormDmg, stormN);
          }
          if (b.hit.length > b.pierce) b.dead = true;
        }
      });
    }
    // cleanup dead enemies (sweep, no allocation)
    this.sweepDeadEnemies();

    if (this.deathT >= 0) return;

    // enemy bullets vs pilots (each living fighter rolls separately)
    const pr = 13;
    for (const b of this.ebullets) {
      if (b.dead) continue;
      const rr = b.r + pr;
      for (let i = 0; i < this.fighters.length; i++) {
        const f = this.fighters[i];
        if (!f.alive) continue;
        if (i === 1 && !this.coOp) continue;
        if (dist2(b.x, b.y, f.x, f.y) < rr * rr) {
          b.dead = true;
          this.damageFighter(i, b.dmg, b.x, b.y, 'گلوله دشمن');
          break;
        }
      }
    }
    // enemies vs pilots (only nearby cells around each pilot)
    const thorns = thornsDamage(this.taken);
    const diveStacks = this.taken.get('phasedive') ?? 0;
    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];
      if (!f.alive) continue;
      if (i === 1 && !this.coOp) continue;
      const diving = diveStacks > 0 && f.dashT > 0;
      const diveDmg = diving ? this.stats.damage * (2 + diveStacks) : 0;
      this.forEachNear(f.x, f.y, diving ? 130 : 96, (e) => {
        if (e.spawnT > 0) return; // phasing in: harmless
        // v6 phasedive: dash through enemies to shred them (uses orbHitCd as per-enemy gate)
        if (diving && e.hp > 0 && e.orbHitCd <= 0) {
          const drr = e.r + 34;
          if (dist2(e.x, e.y, f.x, f.y) < drr * drr) {
            e.orbHitCd = 0.25;
            this.damageEnemy(e, diveDmg, false, f.dashDx * 500, f.dashDy * 500);
            this.fx.hitSpark(e.x, e.y, Math.atan2(f.dashDy, f.dashDx), '#5df2ff');
          }
        }
        const rr = e.r + pr - 2;
        if (dist2(e.x, e.y, f.x, f.y) < rr * rr) {
          this.damageFighter(i, e.dmg, e.x, e.y, ENEMY_FA[e.kind]);
          if (thorns > 0 && e.hp > 0) {
            this.damageEnemy(e, thorns, false, e.x - f.x, e.y - f.y);
          }
          // push enemy back a bit so it doesn't stick
          const a = angleTo(f.x, f.y, e.x, e.y);
          e.kx += Math.cos(a) * 180;
          e.ky += Math.sin(a) * 180;
        }
      });
    }
    this.sweepDeadBullets(this.ebullets);
    // thorns may have killed enemies — sweep again
    this.sweepDeadEnemies();
  }

  /** swap-remove dead bullets AND recycle them into the pool */
  private sweepDeadBullets(list: Bullet[]): void {
    let i = 0;
    while (i < list.length) {
      if (list[i].dead) {
        const last = list.length - 1;
        const tmp = list[i];
        list[i] = list[last];
        list.pop();
        this.freeBullet(tmp);
      } else {
        i++;
      }
    }
  }

  /** kill + remove dead enemies in place (shared by collide/orbitals) */
  private sweepDeadEnemies(): void {
    let any = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        this.killEnemy(e);
        any = true;
      }
    }
    if (any) sweep(this.enemies, (e) => e.hp > 0);
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, vx: number, vy: number): void {
    // executioner bonus vs wounded
    if ((this.taken.get('executioner') ?? 0) > 0 && e.hp < e.maxHp * 0.3) {
      dmg *= executionerMult(this.taken);
    }
    e.hp -= dmg;
    e.flash = 1;
    const l = Math.hypot(vx, vy) || 1;
    const kb = isBossKind(e.kind) ? 12 : e.kind === 'tank' || e.kind === 'hive' ? 35 : 130;
    e.kx += (vx / l) * kb;
    e.ky += (vy / l) * kb;
    // v7.5 Crit Detonation: crits explode — AoE around the impact (no chain recursion)
    const cn = critNovaMult(this.taken);
    if (crit && cn > 0) {
      const radius = critNovaRadius(this.taken);
      const aoe = dmg * cn;
      this.fx.shockwave(e.x, e.y, '#ffb020', radius * 1.2, 0.4, 5);
      this.fx.explosion(e.x, e.y, '#ffb020', 16, 380);
      this.forEachNear(e.x, e.y, radius + 64, (o) => {
        if (o === e || o.hp <= 0 || o.spawnT > 0) return;
        const rr2 = radius + o.r;
        if (dist2(e.x, e.y, o.x, o.y) < rr2 * rr2) {
          this.damageEnemy(o, aoe * (isBossKind(o.kind) ? 0.35 : 1), false, o.x - e.x, o.y - e.y);
        }
      });
    }
    // potato: hit explosion only on crits — chip hits stay silent for FPS
    if (this.quality <= 2 || crit) {
      this.fx.explosion(e.x, e.y, ENEMY_COLOR[e.kind], crit ? 9 : 4, crit ? 320 : 220);
    }
    if (crit && this.quality <= 2) this.fx.hitSpark(e.x, e.y, Math.atan2(vy, vx), '#ffe9a8');
    const showNums = this.opts.showDamageNumbers !== false;
    if (crit || dmg >= 30) {
      this.fx.text(e.x, e.y - e.r, String(Math.round(dmg)), crit ? '#ffe066' : '#ffffff', crit ? 18 : 13);
    } else if (showNums && this.quality <= 1) {
      // chaos throttle: in heavy fights chip numbers would starve crits from the pool
      const chaos = this.enemies.length > 40 || this.fpsEMA < 50;
      if (!chaos || Math.random() < 0.4) {
        this.fx.text(e.x, e.y - e.r, String(Math.round(dmg)), 'rgba(200,210,230,0.7)', 10);
      }
    }
    if (e.hp <= 0) {
      this.hitstopT = Math.max(this.hitstopT, isBossKind(e.kind) ? 0.16 : e.elite ? 0.09 : 0.028);
    }
  }

  private killEnemy(e: Enemy): void {
    this.kills += 1;
    this.waveKills += 1;
    this.combo += 1;
    this.comboT = comboWindow(this.taken);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo >= 5) this.audio.comboTick(this.combo);
    const comboMult = 1 + Math.min(2 + (this.taken.get('combomaster') ?? 0), this.combo * 0.02 * comboScoreMult(this.taken));
    const mutMult = this.mutator ? MUTATORS[this.mutator].scoreMult : 1;
    const endlessMult = this.endless ? 1.5 : 1;
    const diffMult = diffScoreMultFor(this.opts.difficulty);
    const pts = e.score * (1 + this.wave * 0.08) * comboMult * mutMult * endlessMult * diffMult * midasScoreMult(this.taken);
    this.score += pts;
    if (this.kills === 1) this.grantAchievement('first_blood');
    if (this.combo === 50) this.grantAchievement('combo50');
    if (e.kind === 'stinger') {
      this.stingerKills++;
      if (this.stingerKills === 15) this.grantAchievement('stinger15');
    }
    if (e.kind === 'bomber') {
      this.bomberKills++;
      if (this.bomberKills === 10) this.grantAchievement('bomber10');
    }
    if (e.elite) {
      this.elites += 1;
      if (this.elites === 5) this.grantAchievement('elite5');
      this.awardShards(1);
      this.setAnnounce(`الیت نابود شد! +${Math.round(pts)}`, 1.8);
      // volatile affix: radial burst on death (pooled bullets)
      if (e.affix === 'volatile') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + rand(-0.1, 0.1);
          this.fireEnemyBullet(e.x, e.y, Math.cos(a) * 220, Math.sin(a) * 220, 6, e.dmg * 0.6, 3);
        }
        this.fx.shockwave(e.x, e.y, '#ff7a2a', 130, 0.4, 5);
      }
    }

    const bossNow = isBossKind(e.kind);
    const big = bossNow || e.kind === 'splitter' || e.kind === 'tank' || e.kind === 'hive' || e.elite;
    this.fx.explosion(e.x, e.y, e.elite ? '#ffd319' : ENEMY_COLOR[e.kind], big ? 60 : 24, big ? 620 : 420);
    this.fx.shockwave(e.x, e.y, e.elite ? '#ffd319' : ENEMY_COLOR[e.kind], big ? 230 : 95, 0.5, big ? 8 : 4);
    if (big) this.fx.shockwave(e.x, e.y, '#ffffff', big ? 130 : 55, 0.35, 3);
    if (bossNow) {
      this.fx.confetti(e.x, e.y, 90);
      this.fx.shockwave(e.x, e.y, '#ff2d78', 320, 0.7, 10);
    } else if (e.elite) {
      this.fx.text(e.x, e.y - 14, `+${Math.round(pts)}`, '#ffd319', 18);
    } else if (this.combo >= 10 && this.combo % 10 === 0) {
      this.fx.text(e.x, e.y - 18, `COMBO ×${this.combo}`, '#ff9f1c', 16);
    }
    this.gridPulse = Math.min(1, this.gridPulse + (bossNow ? 1 : e.elite ? 0.65 : 0.18));
    if (e.elite) this.audio.eliteDie();
    else this.audio.enemyDie(big);
    this.trauma = Math.min(1, this.trauma + (bossNow ? 1 : e.elite ? 0.55 : e.kind === 'splitter' ? 0.3 : 0.12));

    if (bossNow) {
      this.slowmoT = 1.0;
      this.audio.duck(1.0);
      this.fx.text(e.x, e.y, `+${Math.round(pts)}`, '#ffd319', 26);
      this.dropPowerup(e.x, e.y, true);
      this.grantAchievement('boss1');
      if (!this.bossDamageTaken) this.grantAchievement('flawless_boss');
      this.defeatedBosses.add(e.kind);
      if (this.defeatedBosses.size >= 3) this.grantAchievement('boss_trio');
      this.awardShards(5);
      // shower of gems
      for (let i = 0; i < 14; i++) {
        this.gems.push({
          x: e.x + rand(-40, 40), y: e.y + rand(-40, 40),
          vx: rand(-220, 220), vy: rand(-220, 220),
          val: 14, t: 0,
        });
      }
      this.boss = null;
    } else {
      // gems (doubled during gold rush; echo elites drop double again; v7 +20% base; v7.5 midas +25%/stack)
      const echoMult = e.affix === 'echo' ? 2 : 1;
      const gemVal = Math.ceil(e.xp * 1.2 * (this.mutator === 'gold_rush' ? 2 : 1) * echoMult * midasGemMult(this.taken));
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
          m.spawnT = 0.35;
          this.enemies.push(m);
        }
      }
      if (e.kind === 'hive') {
        this.hives += 1;
        if (this.hives === 3) this.grantAchievement('hive_cleanser');
      }
      // powerup drop: elites always, others 3% (v7: more toys)
      if (e.elite) {
        this.dropPowerup(e.x, e.y, false);
      } else if (Math.random() < 0.03) {
        this.dropPowerup(e.x, e.y, false);
      }
    }

    if (this.stats.lifesteal > 0) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lifesteal);
    }
    // v7 combo milestones: hype text + real rewards so streaks feel amazing
    if (this.combo > 0 && this.combo % 25 === 0) {
      const bonus = 50 + this.combo * 2;
      this.score += bonus;
      this.hp = Math.min(this.stats.maxHp, this.hp + 8);
      const hype = this.combo >= 100 ? `🔥🔥 کمبو ×${this.combo} افسانه‌ای! +${bonus}` : this.combo >= 50 ? `🔥 کمبو ×${this.combo}! +${bonus}` : `کمبو ×${this.combo}! +${bonus}`;
      this.setAnnounce(hype, 2);
      const cb = this.celebrate();
      this.fx.text(cb.x, cb.y - 34, `COMBO x${this.combo}  +8 HP`, '#ffd319', 22);
      this.fx.shockwave(cb.x, cb.y, '#ffd319', 160, 0.5, 5);
      this.audio.comboTick(this.combo + 10);
    }
  }

  private dropPowerup(x: number, y: number, guaranteed: boolean): void {
    if (this.powerups.length > 6) {
      // never silently drop a boss-guaranteed reward: evict the oldest
      if (!guaranteed) return;
      this.powerups.shift();
    }
    this.pityT = 0;
    const kinds: PowerUpKind[] = ['shield', 'magnet', 'nuke', 'overdrive', 'heal', 'frost', 'greed', 'phase'];
    const kind = guaranteed && Math.random() < 0.5 ? 'heal' : kinds[Math.floor(Math.random() * kinds.length)];
    this.powerups.push({
      x: clamp(x, 40, WORLD_W - 40), y: clamp(y, 40, WORLD_H - 40),
      vx: rand(-60, 60), vy: rand(-60, 60), kind, t: 0, life: 22,
    });
    this.fx.shockwave(x, y, POWERUP_COLOR[kind], 80, 0.4, 3);
  }

  private updatePowerups(dt: number): void {
    // v7 pity: never go 35s without a powerup (was 50s) — the game must keep giving toys
    if (this.pityT > 35 && this.powerups.length < 3 && this.deathT < 0) {
      const a = Math.random() * TAU;
      this.dropPowerup(
        clamp(this.px + Math.cos(a) * 220, 40, WORLD_W - 40),
        clamp(this.py + Math.sin(a) * 220, 40, WORLD_H - 40),
        false,
      );
    }
    for (const p of this.powerups) {
      p.t += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 2);
      p.vy *= 1 - Math.min(1, dt * 2);
      // magnet to / collected by the nearest living pilot
      let bd = Infinity;
      let best: Fighter | null = null;
      for (const f of this.activeFighters()) {
        const d2 = dist2(p.x, p.y, f.x, f.y);
        if (d2 < bd) {
          bd = d2;
          best = f;
        }
      }
      const pullR = this.magnetAllT > 0 ? 1200 : this.stats.magnet;
      if (best && bd < pullR * pullR) {
        const d = Math.sqrt(bd) || 1;
        p.vx += ((best.x - p.x) / d) * 1400 * dt;
        p.vy += ((best.y - p.y) / d) * 1400 * dt;
      }
      if (bd < 30 * 30) {
        p.life = -1;
        this.collectPowerup(p.kind);
      }
    }
    this.powerups = sweep(this.powerups, (p) => p.life > 0);
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
    } else if (kind === 'frost') {
      this.frostT = 5;
      this.audio.frost();
      // frost_king: 25+ enemies frozen at once
      let frozen = 0;
      for (const e of this.enemies) {
        if (e.hp > 0 && !isBossKind(e.kind)) frozen++;
      }
      if (frozen >= 25) this.grantAchievement('frost_king');
    } else if (kind === 'greed') {
      this.greedT = 20;
      this.grantAchievement('greed_is_good');
    } else if (kind === 'phase') {
      this.phaseT = 5;
      this.audio.shieldUp();
      this.grantAchievement('untouchable');
    } else if (kind === 'nuke') {
      this.detonateNuke();
      return;
    }
    this.audio.powerup();
    this.setAnnounce(POWERUP_FA[kind], 1.8, 1);
    this.fx.shockwave(this.px, this.py, POWERUP_COLOR[kind], 170, 0.5, 5);
    this.fx.pickupBurst(this.px, this.py, POWERUP_COLOR[kind]);
    this.emitHud();
  }

  private detonateNuke(): void {
    this.audio.nuke();
    this.audio.duck(0.9);
    this.trauma = 1;
    this.gridPulse = 1;
    this.slowmoT = Math.max(this.slowmoT, 0.45);
    this.fx.shockwave(this.px, this.py, '#ff5d2a', 700, 0.8, 10);
    this.fx.explosion(this.px, this.py, '#ffd319', 60, 600);
    const dead = [...this.enemies];
    let nukeKills = 0;
    for (const e of dead) {
      if (isBossKind(e.kind)) {
        this.damageEnemy(e, e.maxHp * 0.35, false, 0, -1);
      } else {
        e.hp = 0;
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        this.killEnemy(e);
        nukeKills++;
      }
    }
    sweep(this.enemies, (e) => e.hp > 0);
    if (nukeKills >= 20) this.grantAchievement('nuke20');
    this.setAnnounce('انفجار هسته‌ای!', 2, 2);
  }

  /** living pilots for shared auras — P1 alone in solo */
  private activeFighters(): Fighter[] {
    if (!this.coOp) return this.fighters[0].alive ? [this.fighters[0]] : [];
    return this.fighters.filter((f) => f.alive);
  }

  /** celebration fx anchor — first living pilot (P1 in solo) */
  private celebrate(): Fighter {
    const alive = this.activeFighters();
    return alive.length > 0 ? alive[0] : this.fighters[0];
  }

  private updateOrbitals(dt: number): void {
    void dt;
    const n = this.stats.orbitals;
    if (n <= 0 || this.deathT >= 0) return;
    const R = 74;
    const dmg = this.stats.damage * this.stats.orbitalDamage;
    for (const f of this.activeFighters()) {
      for (let i = 0; i < n; i++) {
        const a = this.orbitalAngle + (i / n) * TAU;
        const ox = f.x + Math.cos(a) * R;
        const oy = f.y + Math.sin(a) * R;
        this.forEachNear(ox, oy, 96, (e) => {
          if (e.hp <= 0 || e.spawnT > 0 || e.orbHitCd > 0) return;
          const rr = e.r + 13;
          if (dist2(ox, oy, e.x, e.y) < rr * rr) {
            e.orbHitCd = 0.35;
            const ka = angleTo(e.x, e.y, ox, oy);
            this.damageEnemy(e, dmg, false, Math.cos(ka) * 300, Math.sin(ka) * 300);
            // v7.5 Vampiric Orbit: blades sip life back into their pilot
            const vamp = this.taken.get('vampire') ?? 0;
            if (vamp > 0 && f.alive && f.hp < this.stats.maxHp) {
              f.hp = Math.min(this.stats.maxHp, f.hp + 0.5 * vamp);
              if (Math.random() < 0.25) this.fx.pickupBurst(f.x, f.y, '#ff5d7e');
            }
          }
        });
      }
    }
    // cleanup orbital kills immediately so blades feel responsive
    this.sweepDeadEnemies();
  }

  /** v3 weapon mods: periodic nova blast + homing seeker missiles */
  private updateNovaSeeker(dt: number): void {
    if (this.deathT >= 0) return;
    const novaStacks = this.taken.get('nova') ?? 0;
    if (novaStacks > 0) {
      this.novaCd -= dt;
      if (this.novaCd <= 0) {
        this.novaCd = Math.max(3.2, 7.5 - novaStacks * 1.1);
        const n = 10 + 4 * novaStacks;
        const dmg = this.stats.damage * (1.25 + 0.15 * novaStacks);
        for (const f of this.activeFighters()) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rand(-0.06, 0.06);
            const b = this.allocBullet(true);
            b.x = f.x; b.y = f.y;
            b.vx = Math.cos(a) * 560; b.vy = Math.sin(a) * 560;
            b.r = 5; b.dmg = dmg * rand(0.9, 1.1);
            b.pierce = 2; b.life = 0.9; b.crit = false;
            b.tint = '#ff9f1c';
            this.bullets.push(b);
          }
          this.fx.shockwave(f.x, f.y, '#ff9f1c', 220, 0.5, 6);
          this.fx.explosion(f.x, f.y, '#ff9f1c', 10, 300);
        }
        this.audio.nova();
        this.trauma = Math.min(1, this.trauma + 0.15);
      }
    }
    const twinStacks = this.taken.get('twinlink') ?? 0;
    const seekerStacks = (this.taken.get('seeker') ?? 0) + twinStacks;
    if (seekerStacks > 0) {
      this.seekerCd -= dt;
      if (this.seekerCd <= 0) {
        this.seekerCd = Math.max(1.2, 2.8 - 0.4 * seekerStacks);
        // v3.2: 3+ stacks fire a twin volley — v7.5 Twin Link adds +1 missile per stack
        const volley = (seekerStacks >= 3 ? 2 : 1) + twinStacks;
        for (const f of this.activeFighters()) {
          for (let v = 0; v < volley; v++) {
            const tgt = this.nearestEnemyFrom(f.x, f.y, 1200);
            const a = tgt
              ? angleTo(f.x, f.y, tgt.x, tgt.y) + (volley > 1 ? (v === 0 ? -0.18 : 0.18) : 0)
              : f.aim;
            const b = this.allocBullet(true);
            b.x = f.x; b.y = f.y;
            b.vx = Math.cos(a) * 680; b.vy = Math.sin(a) * 680;
            b.r = 6; b.dmg = this.stats.damage * 1.6 * seekerStacks;
            b.pierce = 0; b.life = 3; b.crit = true;
            b.homing = true; b.tint = '#ff9f1c';
            this.bullets.push(b);
          }
          this.fx.muzzle(f.x, f.y, f.aim, '#ff9f1c');
        }
        this.audio.shoot();
      }
    }
    // v6 chain storm: periodic lightning that arcs between closest enemies
    const chainStacks = this.taken.get('chain') ?? 0;
    if (chainStacks > 0) {
      this.chainCd -= dt;
      if (this.chainCd <= 0) {
        this.chainCd = Math.max(2.2, 4.2 - chainStacks * 0.5);
        let zapped = false;
        for (const f of this.activeFighters()) {
          const targets = this.nearestEnemies(f.x, f.y, 620, 3 + chainStacks * 2);
          if (targets.length === 0) continue;
          zapped = true;
          const dmg = this.stats.damage * (1.6 + chainStacks * 0.7);
          let px = f.x;
          let py = f.y;
          for (const tgt of targets) {
            this.fx.shockwave(tgt.x, tgt.y, '#5df2ff', 70, 0.3, 4);
            this.fx.explosion(tgt.x, tgt.y, '#5df2ff', 8, 320);
            // lightning segment feel: spark line from previous point
            this.fx.hitSpark((px + tgt.x) / 2, (py + tgt.y) / 2, Math.atan2(tgt.y - py, tgt.x - px), '#ffffff');
            this.damageEnemy(tgt, dmg, false, tgt.x - px, tgt.y - py);
            px = tgt.x;
            py = tgt.y;
          }
        }
        if (zapped) {
          this.audio.nova();
          if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.12);
          this.sweepDeadEnemies();
        } else {
          this.chainCd = 0.5;
        }
      }
    }
  }

  /** k nearest live enemies for chain lightning (simple insertion, n is tiny) */

  private damagePlayer(raw: number, fromX: number, fromY: number, source: string | null = null): void {
    this.damageFighter(0, raw, fromX, fromY, source);
  }

  /** damage one pilot; solo always hits index 0 (identical to the old code) */
  private damageFighter(idx: number, raw: number, fromX: number, fromY: number, source: string | null = null): void {
    const f = this.fighters[idx];
    if (!f.alive || f.invuln > 0 || f.dashT > 0 || this.deathT >= 0 || this.victoryT >= 0) return;
    if (this.shieldT > 0 || this.phaseT > 0) {
      // shield / phase ghost absorbs the hit with a spark
      const col = this.phaseT > 0 ? '#e2e8f0' : '#00e5ff';
      f.invuln = 0.4;
      this.fx.shockwave(f.x, f.y, col, 90, 0.3, 3);
      this.fx.pickupBurst(f.x, f.y, col);
      return;
    }
    const dmg = Math.max(1, raw - this.stats.armor);
    f.hp -= dmg;
    if (source) this.deathBy = source;
    if (this.boss) this.bossDamageTaken = true;
    f.invuln = 0.55;
    this.combo = 0;
    this.comboT = 0;
    f.hurtFlash = 0.25;
    this.audio.hurt();
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.fx.explosion(f.x, f.y, '#ff2d78', 14, 300);
    this.fx.text(f.x, f.y - 26, `-${Math.round(dmg)}`, '#ff5d7e', 16);
    const a = angleTo(fromX, fromY, f.x, f.y);
    f.vx += Math.cos(a) * 260;
    f.vy += Math.sin(a) * 260;
    if (f.hp <= 0) {
      // v3 Second Wind: cheat death — 2 stacks = shorter cd + bigger heal
      // v7.5 Phoenix Core: explosive rebirth even without Second Wind
      const sw = this.taken.get('secondwind') ?? 0;
      const ph = this.taken.get('phoenix') ?? 0;
      if ((sw > 0 || ph > 0) && this.swCd <= 0) {
        this.swCd = ph > 0 ? 60 : sw >= 2 ? 60 : 85;
        f.hp = Math.round(this.stats.maxHp * (ph > 0 ? 0.6 : sw >= 2 ? 0.45 : 0.32));
        f.invuln = 2;
        this.trauma = 1;
        this.slowmoT = Math.max(this.slowmoT, 0.8);
        this.fx.shockwave(f.x, f.y, '#ffffff', 320, 0.9, 7);
        this.fx.explosion(f.x, f.y, '#3dff8e', 60, 480);
        if (ph > 0) {
          // the phoenix detonates: everything around burns
          this.novaBurstAt(f.x, f.y, 420, this.stats.damage * 8, '#ff5d2a');
          this.fx.shockwave(f.x, f.y, '#ffd319', 560, 0.8, 8);
          this.audio.nuke();
          this.setAnnounce(`🔥 ققنوس برخاست! (Phoenix)${this.coOp ? ` — بازیکن ${idx + 1}` : ''}`, 2.6, 3);
          this.grantAchievement('phoenix_rise');
        } else {
          this.setAnnounce(`💚 فرصت دوباره! (Second Wind)${this.coOp ? ` — بازیکن ${idx + 1}` : ''}`, 2.4, 3);
        }
        this.audio.secondWind();
        this.grantAchievement('second_wind');
        this.emitHud();
        return;
      }
      f.hp = 0;
      f.alive = false;
      const partnerAlive = this.coOp && this.fighters[1 - idx].alive;
      if (partnerAlive) {
        this.setAnnounce(`💀 بازیکن ${idx + 1} افتاد! موج را تمام کن تا برگردد`, 2.6, 3);
        this.fx.explosion(f.x, f.y, '#ffffff', 40, 420);
        this.emitHud();
        return;
      }
      this.slowmoT = 1.0;
      this.deathT = 0;
      this.trauma = 1;
      this.fx.explosion(f.x, f.y, '#00f0ff', 80, 560);
      this.fx.explosion(f.x, f.y, '#ff2d78', 60, 420);
      this.fx.shockwave(f.x, f.y, '#ffffff', 320, 0.9, 7);
    }
    this.emitHud();
  }

  private addXp(v: number): void {
    this.xp += v * this.stats.xpGainMult;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      // v7: faster early levels — hook in the first 3 minutes
      this.xpNext = Math.floor(this.xpNext * 1.18 + 14);
      this.pendingLevels += 1;
    }
    if (this.pendingLevels > 0 && !this.upgradeLock) {
      this.upgradeLock = true;
      this.paused = true;
      this.rerollsLeft = 1; // fresh reroll every level-up
      this.audio.levelup();
      // v7 level-up celebration: beam + confetti + breather heal
      this.hp = Math.min(this.stats.maxHp, this.hp + 10);
      const lc = this.celebrate();
      this.fx.shockwave(lc.x, lc.y, '#a3ff12', 240, 0.6, 6);
      this.fx.shockwave(lc.x, lc.y, '#ffffff', 130, 0.4, 3);
      this.fx.explosion(lc.x, lc.y, '#a3ff12', 28, 420);
      this.fx.confetti(lc.x, lc.y, 24);
      this.fx.text(lc.x, lc.y - 40, `LEVEL ${this.level}!  +10 HP`, '#a3ff12', 22);
      this.cb.onLevelUp(rollUpgrades(this.taken, 3));
      this.emitHud();
    }
  }

  private updateGems(dt: number): void {
    const magnetR = this.magnetAllT > 0 ? 1200 : this.stats.magnet;
    const magnetR2 = magnetR * magnetR;
    const pilots = this.activeFighters();
    for (const g of this.gems) {
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= 1 - Math.min(1, dt * 3);
      g.vy *= 1 - Math.min(1, dt * 3);
      // co-op: gems magnet to / are collected by the nearest living pilot
      let bd = magnetR2;
      let best: Fighter | null = null;
      for (const f of pilots) {
        const d2 = dist2(g.x, g.y, f.x, f.y);
        if (d2 < bd) {
          bd = d2;
          best = f;
        }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        const pull = 900 * (1 - d / (magnetR + 1)) + 260;
        g.vx += ((best.x - g.x) / d) * pull * dt * 4;
        g.vy += ((best.y - g.y) / d) * pull * dt * 4;
      }
      if (bd < 30 * 30) {
        g.t = -999; // collected marker
        this.addXp(this.greedT > 0 ? g.val * 2 : g.val);
        this.score += this.greedT > 0 ? 10 : 5;
        this.audio.pickup();
        this.fx.pickupBurst(g.x, g.y, this.greedT > 0 ? '#e879f9' : '#a3ff12');
      }
    }
    // overflow: merge oldest gems into mega-gems (never delete player XP)
    // v6: lower cap 280 (was 400) — fewer magnet sqrt checks on weak chips
    while (this.gems.length > 280) {
      const a = this.gems.shift();
      const b = this.gems.shift();
      const c = this.gems.shift();
      const d = this.gems.shift();
      if (!a || !b || !c || !d) break;
      this.gems.push({
        x: (a.x + b.x + c.x + d.x) / 4,
        y: (a.y + b.y + c.y + d.y) / 4,
        vx: rand(-200, 200), vy: rand(-200, 200),
        val: a.val + b.val + c.val + d.val, t: 0,
      });
    }
    sweep(this.gems, (g) => g.t > -100);
  }

  /** camera focus: P1 lookahead solo, living-pilots midpoint in co-op */
  private focusPoint(): { x: number; y: number; lookX: number; lookY: number } {
    if (!this.coOp) {
      return {
        x: this.px, y: this.py,
        lookX: Math.cos(this.aim) * 52 + this.pvx * 0.1 + this.dashKickX,
        lookY: Math.sin(this.aim) * 52 + this.pvy * 0.1 + this.dashKickY,
      };
    }
    const alive = this.fighters.filter((f) => f.alive);
    if (alive.length === 0) return { x: this.px, y: this.py, lookX: 0, lookY: 0 };
    const x = alive.reduce((s, f) => s + f.x, 0) / alive.length;
    const y = alive.reduce((s, f) => s + f.y, 0) / alive.length;
    return { x, y, lookX: 0, lookY: 0 };
  }

  private updateCamera(dt: number): void {
    // v4 lookahead: the camera leans toward aim + velocity + dash kick,
    // so the player sees where they're going instead of where they've been
    this.dashKickX *= 1 - Math.min(1, dt * 5);
    this.dashKickY *= 1 - Math.min(1, dt * 5);
    const focus = this.focusPoint();
    const tx = clamp(focus.x + focus.lookX - this.viewW / 2, 0, Math.max(0, WORLD_W - this.viewW));
    const ty = clamp(focus.y + focus.lookY - this.viewH / 2, 0, Math.max(0, WORLD_H - this.viewH));
    // if world smaller than view, center
    const cx = WORLD_W < this.viewW ? (WORLD_W - this.viewW) / 2 : tx;
    const cy = WORLD_H < this.viewH ? (WORLD_H - this.viewH) / 2 : ty;
    // dt-scaled smoothing (was: fixed 0.2 factor = fps-dependent)
    const k = 1 - Math.pow(0.00001, dt);
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    if (Math.abs(cx - this.camX) < 0.5) this.camX = cx;
    if (Math.abs(cy - this.camY) < 0.5) this.camY = cy;
  }

  // ---------- render ----------

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // bg (cached gradient — was allocated every frame)
    ctx.fillStyle = this.bgGrad ?? '#050514';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    this.renderNow = performance.now();

    let shX = 0;
    let shY = 0;
    if (this.opts.shakeEnabled && this.trauma > 0) {
      // potato softens shake amplitude — feel stays, pixels don't fly
      const amp = this.quality >= 3 ? 16 : 26;
      const s = this.trauma * this.trauma * amp;
      shX = rand(-s, s);
      shY = rand(-s, s);
    }
    const camX = this.camX - shX;
    const camY = this.camY - shY;
    const q = this.quality;

    // stars (screen space parallax)
    this.fx.drawStars(ctx, { x: camX, y: camY }, this.viewW, this.viewH);

    // rich nebula — LOD: 5 blobs cinematic, 1 on potato (cheap, still pretty)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const t = this.renderNow / 1000;
    const heat = q <= 1 ? Math.min(1, this.combo / 40) : 0;
    drawGlow(ctx, '#1b2a7a', this.viewW * 0.22 + Math.sin(t * 0.05) * 26, this.viewH * 0.28, 380, q >= 3 ? 0.4 : 0.5);
    drawGlow(ctx, '#5c1446', this.viewW * 0.8 + Math.cos(t * 0.04) * 34, this.viewH * 0.66, 440, q >= 3 ? 0.34 : 0.44);
    if (q <= 2) {
      drawGlow(ctx, '#0c4256', this.viewW * 0.55, this.viewH * 0.9 + Math.sin(t * 0.045) * 22, 360, 0.42);
    }
    if (q <= 1) {
      drawGlow(ctx, '#3d1a78', this.viewW * 0.1 + Math.cos(t * 0.03) * 30, this.viewH * 0.75, 300, 0.35);
      drawGlow(ctx, '#7a1e2e', this.viewW * 0.92, this.viewH * 0.12 + Math.sin(t * 0.06) * 18, 260, 0.3 + heat * 0.15);
    }
    // combo heat bloom at screen center — cinematic only (fill-rate hog)
    if (heat > 0.05 && q === 0) {
      drawGlow(ctx, '#ff9f1c', this.viewW / 2, this.viewH / 2, 420, heat * 0.12);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-camX, -camY);

    // grid — neon hairline that breathes with combat (wider step on potato)
    const pulse = this.gridPulse;
    const bossPulse = this.boss && q <= 1 ? 0.04 + Math.sin(t * 3.2) * 0.02 : 0;
    ctx.strokeStyle = `rgba(0,240,255,${(0.07 + pulse * 0.22 + bossPulse).toFixed(3)})`;
    ctx.lineWidth = 1;
    const step = q >= 3 ? 140 : 100;
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

    // arena border — electric double hairline, flares on kills
    const borderGlow = 0.12 + pulse * 0.35;
    ctx.strokeStyle = `rgba(0,240,255,${borderGlow.toFixed(3)})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(220,250,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);

    // gems — tiered colors (green/blue/gold), juicy pulse + gold halo
    // potato skips halo glows: sprite alone still reads clearly
    for (const g of this.gems) {
      const tier = gemTierFor(g.val);
      if (q <= 1) {
        if (tier === 2) drawGlow(ctx, '#ffd319', g.x, g.y, 30, 0.55);
        else if (tier === 1) drawGlow(ctx, '#7dd3fc', g.x, g.y, 20, 0.35);
      } else if (tier === 2) {
        drawGlow(ctx, '#ffd319', g.x, g.y, 24, 0.4);
      }
      const pulse = 1 + Math.sin(g.t * 6) * 0.16;
      const s = 26 * pulse * (tier === 2 ? 1.35 : tier === 1 ? 1.15 : 1);
      const spr = gemSpriteTier(tier);
      ctx.drawImage(spr, g.x - s / 2, g.y - s / 2, s, s);
    }

    // powerups — calm bob, rotating dashed halo, soft glow
    const nowMs = this.renderNow;
    // potato: static halo (no lineDashOffset anim) + no per-powerup glow
    for (const p of this.powerups) {
      const bob = q >= 3 ? 0 : Math.sin(nowMs / 420 + p.x * 0.05) * 3;
      const blink = p.life < 5 ? (Math.sin(nowMs / 140) > 0 ? 1 : 0.4) : 1;
      if (q <= 2) drawGlow(ctx, POWERUP_COLOR[p.kind], p.x, p.y + bob, 26, 0.5 * blink);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = POWERUP_COLOR[p.kind];
      ctx.globalAlpha = 0.55 * blink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -nowMs / 400;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = blink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = POWERUP_COLOR[p.kind];
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph: Record<PowerUpKind, string> = {
        shield: '◈', magnet: '◎', nuke: '✸', overdrive: '⚡', heal: '✚', frost: '❄',
        greed: '◆', phase: '◇',
      };
      ctx.fillText(glyph[p.kind], 0, 1);
      ctx.restore();
    }

    // enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // dash ghosts — faint afterimages
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = (g.life / 0.35) * 0.3;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.aim);
      ctx.strokeStyle = '#bdf3ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, 12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, -12);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // orbital blades — blazing gold with motion streaks (streak only on high)
    if (this.stats.orbitals > 0 && this.deathT < 0) {
      for (const f of this.activeFighters()) {
      for (let i = 0; i < this.stats.orbitals; i++) {
        const a = this.orbitalAngle + (i / this.stats.orbitals) * TAU;
        const ox = f.x + Math.cos(a) * 74;
        const oy = f.y + Math.sin(a) * 74;
        if (q <= 2) drawGlow(ctx, '#ffd319', ox, oy, 26, 0.75);
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(a * 3);
        if (q <= 1) {
          // streak
          ctx.fillStyle = 'rgba(255,211,25,0.25)';
          ctx.beginPath();
          ctx.moveTo(-14, 0);
          ctx.lineTo(-2, 4);
          ctx.lineTo(-2, -4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      }
    }

    // friendly bullets — hot neon streaks; glow skipped on potato for non-crits
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const col = b.tint ?? (b.crit ? '#ffe9a8' : '#5df2ff');
      const skipGlow = q >= 2 && !b.crit && !b.tint;
      if (!skipGlow) drawGlow(ctx, col, b.x, b.y, b.crit ? 18 : 14, b.crit ? 0.9 : 0.75);
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.fillRect(-10, -2.2, 20, 4.4);
      if (q <= 2) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6, 0, b.r * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // enemy bullets — hot readable orbs; pulse frozen on potato
    const ebPulse = q >= 3 ? 0.65 : 0.65 + Math.sin(nowMs / 180) * 0.15;
    for (const b of this.ebullets) {
      if (q <= 2) drawGlow(ctx, '#ff2d78', b.x, b.y, b.r + 9, ebPulse);
      ctx.fillStyle = '#ff5d7e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.38, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // pilots (P2 only in co-op)
    if (this.deathT < 0) {
      this.drawPlayer(ctx, 0);
      if (this.coOp && this.fighters[1].alive) this.drawPlayer(ctx, 1);
    }

    // v6 voidstorm telegraph ring (world space, before particles)
    if (this.stormWarn) {
      const w = this.stormWarn;
      const k = 1 - w.t / 0.8;
      ctx.save();
      ctx.globalAlpha = 0.5 + k * 0.4;
      ctx.strokeStyle = '#5df2ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -nowMs / 60;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 30 + k * 65, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.12 + k * 0.12;
      ctx.fillStyle = '#5df2ff';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 95, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // particles (world space, culled to view on low quality)
    if (q >= 2) this.fx.draw(ctx, { x: camX, y: camY }, this.viewW, this.viewH);
    else this.fx.draw(ctx);

    ctx.restore();

    // vignette (cached gradient — skipped on potato for fill-rate)
    if (this.vigGrad && q <= 2) {
      ctx.fillStyle = this.vigGrad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // low hp — urgent red breath + heartbeat pulse (static on potato)
    const hpFrac = this.lowestHpFrac();
    if (hpFrac < 0.35 && this.deathT < 0) {
      const beat = q >= 3 ? 0.5 : Math.sin(nowMs / 300) * 0.5 + 0.5;
      const a = (0.35 - hpFrac) * 1.4 + beat * 0.06;
      ctx.fillStyle = `rgba(255,30,80,${clamp(a, 0, 0.32).toFixed(3)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      // danger edge glow
      ctx.save();
      ctx.strokeStyle = `rgba(255,45,90,${(0.35 + beat * 0.3).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, this.viewW - 6, this.viewH - 6);
      ctx.restore();
    }

    // kill-flash: white-hot frame on boss / elite takedowns (cinematic only)
    if (this.gridPulse > 0.7 && q <= 1) {
      ctx.fillStyle = `rgba(255,255,255,${((this.gridPulse - 0.7) * 0.25).toFixed(3)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // frost overlay — whisper of ice
    if (this.frostT > 0 && this.deathT < 0) {
      ctx.fillStyle = 'rgba(125,211,252,0.045)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.strokeStyle = 'rgba(125,211,252,0.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 2, this.viewW - 4, this.viewH - 4);
    }

    // offscreen threat indicators (elites / boss / shooters / snipers)
    if (this.deathT < 0) {
      this.drawOffscreenIndicators(ctx, camX, camY);
    }

    // wave banner — big cinematic slam (no shadowBlur on low: fake glow via double-draw)
    if (this.waveBannerT > 0) {
      const t = this.waveBannerT;
      const alpha = clamp(t / 0.4, 0, 1) * clamp((2.4 - t) / 0.4 + 0.2, 0, 1);
      const slam = 1 + (t > 1.9 ? (2.4 - t) * 0.12 : 0);
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.textAlign = 'center';
      const fs = Math.min(54, this.viewW / 12) * slam;
      ctx.font = `900 ${fs}px Orbitron, Vazirmatn, sans-serif`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(3,4,12,0.9)';
      const label = this.wave % 5 === 0 ? `WAVE ${this.wave} — BOSS` : `WAVE ${this.wave}`;
      const isBoss = this.wave % 5 === 0;
      ctx.strokeText(label, this.viewW / 2, 120);
      ctx.fillStyle = isBoss ? '#ff5d7e' : '#eafcff';
      if (q <= 1) {
        ctx.shadowColor = isBoss ? 'rgba(255,45,100,0.9)' : 'rgba(0,240,255,0.8)';
        ctx.shadowBlur = 28;
        ctx.fillText(label, this.viewW / 2, 120);
        ctx.shadowBlur = 0;
      } else {
        // cheap glow: offset double-draw instead of shadowBlur (10x faster)
        ctx.fillStyle = isBoss ? 'rgba(255,45,100,0.35)' : 'rgba(0,240,255,0.35)';
        ctx.fillText(label, this.viewW / 2 + 2, 122);
        ctx.fillStyle = isBoss ? '#ff5d7e' : '#eafcff';
        ctx.fillText(label, this.viewW / 2, 120);
      }
      ctx.font = `700 13px Vazirmatn, sans-serif`;
      ctx.fillStyle = isBoss ? '#ffb3c2' : 'rgba(0,240,255,0.85)';
      ctx.fillText(isBoss ? '▲ باس وارد میدان شد ▲' : '✦ موج جدید — بجنگ ✦', this.viewW / 2, 148);
      ctx.restore();
    }

    if (this.intermission > 0 && this.deathT < 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.75;
      ctx.font = '500 13px Vazirmatn, sans-serif';
      ctx.fillStyle = '#aab3cc';
      ctx.fillText(`موج بعدی تا ${this.intermission.toFixed(1)} ثانیه`, this.viewW / 2, 148);
      ctx.restore();
    }

    this.drawSticks(ctx);
  }

  private shipColor(): string {
    if (this.opts.ship === 'phantom') return '#b14bff';
    if (this.opts.ship === 'titan') return '#ffb020';
    if (this.opts.ship === 'warden') return '#3dff8e';
    if (this.opts.ship === 'nomad') return '#fb7185';
    return '#00f0ff';
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, fi: number): void {
    const f = this.fighters[fi];
    const col = fi === 0 ? this.shipColor() : '#ffffff';
    const now = this.renderNow || performance.now();
    const speedGlow = Math.min(0.35, Math.hypot(f.vx, f.vy) / 2200);
    // potato: single glow instead of double (fill-rate)
    if (this.quality >= 3) drawGlow(ctx, col, f.x, f.y, 36, 0.55);
    else {
      drawGlow(ctx, col, f.x, f.y, 44, 0.6 + speedGlow);
      drawGlow(ctx, '#ffffff', f.x, f.y, 18, 0.25);
    }
    ctx.save();
    ctx.translate(f.x, f.y);
    if (this.overdriveT > 0) {
      ctx.fillStyle = 'rgba(255,220,120,0.08)';
      ctx.beginPath();
      ctx.arc(0, 0, 34 + Math.sin(now / 140) * 3, 0, TAU);
      ctx.fill();
    }
    ctx.rotate(f.aim);
    // engine flame — shorter, softer
    const flame = 9 + Math.sin(now / 70) * 2.5 + Math.hypot(f.vx, f.vy) / 90;
    ctx.fillStyle = 'rgba(255,170,80,0.28)';
    ctx.beginPath();
    ctx.moveTo(-11, 8);
    ctx.lineTo(-11 - flame - 4, 0);
    ctx.lineTo(-11, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc46b';
    ctx.beginPath();
    ctx.moveTo(-11, 5.5);
    ctx.lineTo(-11 - flame, 0);
    ctx.lineTo(-11, -5.5);
    ctx.closePath();
    ctx.fill();
    // hull — dark body, crisp 2px stroke, inner highlight
    ctx.fillStyle = '#0c1128';
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-11, 11);
    ctx.lineTo(-5.5, 0);
    ctx.lineTo(-11, -11);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.stroke();
    // spine highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();
    // cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3.5, 0, 2.6, 0, TAU);
    ctx.fill();
    if (f.hurtFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ffffff', 0, 0, 26, Math.min(0.7, f.hurtFlash * 3));
      ctx.restore();
    }
    ctx.restore();

    // energy shield — thin double ring
    if (this.shieldT > 0) {
      if (this.quality <= 2) drawGlow(ctx, '#7deeff', f.x, f.y, 36, 0.35);
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(now / 160) * 0.1;
      ctx.strokeStyle = '#a8ecff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 28, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#a8ecff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 28, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // phase ghost — pale shimmer while untouchable
    if (this.phaseT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(now / 120) * 0.12;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -now / 90;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 30, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // i-frame ring
    if (f.invuln > 0 || f.dashT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(f.invuln * 1.6, 0.12, 0.5);
      ctx.strokeStyle = f.dashT > 0 ? '#ffffff' : '#a8ecff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 21 + Math.sin(now / 100) * 1.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
      // co-op pilot tag
    if (this.coOp) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = '700 11px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = fi === 0 ? '#a8ecff' : '#ffd7e4';
      ctx.fillText(fi === 0 ? '۱' : '۲', f.x, f.y - 26);
      ctx.restore();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const color = e.elite ? '#ffd319' : ENEMY_COLOR[e.kind];
    // spawn portal: converging dashed ring while phasing in
    if (e.spawnT > 0) {
      const k = Math.min(1, e.spawnT / 0.7);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * (1 - k);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -e.t * 60;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 8 + k * 46, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const dim = e.spawnT > 0 ? 0.45 : 1;
    // punchy glow — LOD: potato keeps glow only for elite/boss/flash
    const keepGlow = this.quality <= 1 || e.elite || isBossKind(e.kind) || e.flash > 0.3;
    if (keepGlow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, color, e.x, e.y, e.r + 18, (e.elite ? 0.85 : isBossKind(e.kind) ? 0.9 : 0.55) * dim);
      if (e.flash > 0.3 && this.quality <= 2) drawGlow(ctx, '#ffffff', e.x, e.y, e.r + 10, e.flash * 0.7 * dim);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.translate(e.x, e.y);
    const hunter = this.coOp ? pickTarget(e.x, e.y, this.fighters[0], this.fighters[1]) : this.fighters[0];
    const face = angleTo(e.x, e.y, hunter.x, hunter.y);
    ctx.rotate(e.kind === 'shooter' || isBossKind(e.kind) || e.kind === 'sniper' || e.kind === 'lancer' || e.kind === 'stinger' || e.kind === 'tesla' || e.kind === 'tempest' ? face : face + e.t * 0.6);
    // hit squash — the hull pops on impact, then settles (flash decays 5/s)
    const squash = 1 + Math.min(0.16, e.flash * 0.16);
    ctx.scale(squash, squash);

    const flashing = e.flash > 0.25;
    const enraged = isBossKind(e.kind) && e.hp < e.maxHp * 0.32;
    const body = flashing ? '#ffffff' : enraged ? '#ff8a4c' : color;

    // elite ring — thin, slow
    if (e.elite) {
      ctx.save();
      ctx.rotate(-e.t * 1.2);
      ctx.strokeStyle = e.affix === 'bulwark' ? '#e8b26b' : e.affix === 'echo' ? '#a8ecff' : '#e8e0c8';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = e.affix === 'bulwark' ? 2.5 : 1.5;
      ctx.setLineDash(e.affix === 'bulwark' ? [] : [8, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 4, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // frost tint — frozen enemies shimmer icy blue
    if (this.frostT > 0 && e.spawnT <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#a8d8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // volatile affix warning — smaller, calmer
    if (e.affix === 'volatile' && e.spawnT <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.12 * Math.sin(e.t * 5);
      ctx.strokeStyle = '#e89a6b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#0a0d20';
    ctx.strokeStyle = body;
    ctx.lineWidth = isBossKind(e.kind) ? 3 : 2;

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
    } else if (e.kind === 'lancer') {
      // slim lance head
      ctx.moveTo(e.r + 8, 0);
      ctx.lineTo(-e.r * 0.5, e.r * 0.5);
      ctx.lineTo(-e.r * 0.2, 0);
      ctx.lineTo(-e.r * 0.5, -e.r * 0.5);
      ctx.closePath();
    } else if (e.kind === 'stinger') {
      // v6: triple-fin dart — fast skirmisher silhouette
      ctx.moveTo(e.r + 5, 0);
      ctx.lineTo(-e.r * 0.4, e.r * 0.55);
      ctx.lineTo(-e.r * 0.1, 0);
      ctx.lineTo(-e.r * 0.4, -e.r * 0.55);
      ctx.closePath();
    } else if (e.kind === 'hive') {
      // honeycomb carrier hex
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
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
    } else if (e.kind === 'bomber') {
      // round bomb with a fuse nub
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.moveTo(e.r * 0.5, -e.r * 0.7);
      ctx.lineTo(e.r * 0.9, -e.r * 1.1);
    } else if (e.kind === 'tesla') {
      // double diamond — the turret silhouette
      ctx.moveTo(e.r, 0);
      ctx.lineTo(0, e.r * 0.8);
      ctx.lineTo(-e.r, 0);
      ctx.lineTo(0, -e.r * 0.8);
      ctx.closePath();
      ctx.moveTo(e.r * 0.45, 0);
      ctx.lineTo(0, e.r * 0.36);
      ctx.lineTo(-e.r * 0.45, 0);
      ctx.lineTo(0, -e.r * 0.36);
      ctx.closePath();
    } else if (e.kind === 'juggernaut') {
      // siege hexagon — mass reads before detail does
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (e.kind === 'tempest') {
      // storm eye — outer ring plus inner swirl
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.moveTo(e.r * 0.55, 0);
      ctx.arc(0, 0, e.r * 0.55, 0.6, TAU * 0.85);
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

    // per-kind identity details (local space, facing +x) — cheap strokes only
    ctx.lineWidth = 1.2;
    if (e.kind === 'chaser') {
      ctx.fillStyle = flashing ? '#ffffff' : '#ffd7e4';
      ctx.beginPath();
      ctx.arc(e.r * 0.3, 0, Math.max(1.6, e.r * 0.13), 0, TAU);
      ctx.fill();
    } else if (e.kind === 'weaver') {
      ctx.strokeStyle = body;
      ctx.globalAlpha = 0.7 * dim;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.2, 0);
      ctx.lineTo(-e.r * 0.9, e.r * 0.5);
      ctx.moveTo(-e.r * 0.2, 0);
      ctx.lineTo(-e.r * 0.9, -e.r * 0.5);
      ctx.stroke();
      ctx.globalAlpha = dim;
    } else if (e.kind === 'dasher' && e.state === 1) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, e.r * 0.2), 0, TAU);
      ctx.fill();
    } else if (e.kind === 'shooter') {
      ctx.fillStyle = body;
      ctx.fillRect(e.r * 0.4, -3, e.r * 0.55, 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.r * 0.9, 0, 2, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'sniper') {
      ctx.strokeStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.r * 0.4, 0);
      ctx.lineTo(e.r + 12, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.8 * dim;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.42, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = dim;
    } else if (e.kind === 'lancer') {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(e.r + 6, 0);
      ctx.lineTo(-e.r * 0.4, e.r * 0.42);
      ctx.stroke();
    } else if (e.kind === 'stinger') {
      // triple-dot burst ports that glow when telegraphing
      ctx.fillStyle = e.state === 1 ? '#ffffff' : body;
      ctx.beginPath();
      ctx.arc(e.r * 0.35, -3.5, 2, 0, TAU);
      ctx.arc(e.r * 0.35, 3.5, 2, 0, TAU);
      ctx.arc(e.r * 0.55, 0, 2.2, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'bomber') {
      // beep ring swells as the fuse burns down
      if (e.state === 1) {
        const k = 1 - Math.max(0, e.stateT) / 0.8;
        ctx.save();
        ctx.globalAlpha = 0.4 + k * 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 + k * 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 6 + k * 26, 0, TAU);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, e.r * 0.22), 0, TAU);
        ctx.fill();
      }
    } else if (e.kind === 'tesla') {
      // charge spark in the core, beam guide while telegraphing
      ctx.fillStyle = e.state === 1 ? '#ffffff' : body;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, e.r * 0.2), 0, TAU);
      ctx.fill();
      if (e.state === 1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(e.r, 0);
        ctx.lineTo(e.r + 130, 0);
        ctx.stroke();
        ctx.restore();
      }
    } else if (e.kind === 'juggernaut') {
      // magma cracks + charge lane telegraph
      ctx.strokeStyle = enraged ? '#ffd319' : 'rgba(255,220,150,0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + e.t * 0.2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * e.r * 0.85, Math.sin(a) * e.r * 0.85);
      }
      ctx.stroke();
      if (e.state === 1) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ff5d00';
        ctx.fillRect(e.r, -e.r * 0.3, 130, e.r * 0.6);
        ctx.restore();
      }
    } else if (e.kind === 'tempest') {
      // charging ring while the lightning brews
      if (e.state === 1) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -e.t * 80;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 10, 0, TAU);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, e.r * 0.14), 0, TAU);
        ctx.fill();
      }
    } else if (e.kind === 'tank') {
      ctx.strokeStyle = body;
      ctx.globalAlpha = 0.65 * dim;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        const px = Math.cos(a) * e.r * 0.62;
        const py = Math.sin(a) * e.r * 0.62;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = dim;
    } else if (e.kind === 'splitter') {
      ctx.strokeStyle = body;
      ctx.globalAlpha = 0.55 * dim;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * e.r * 0.9, Math.sin(a) * e.r * 0.9);
      }
      ctx.stroke();
      ctx.globalAlpha = dim;
    } else if (e.kind === 'boss') {
      // rotating tick ring + breathing heart
      ctx.save();
      ctx.rotate(e.t * 0.8);
      ctx.strokeStyle = enraged ? '#ffc46b' : body;
      ctx.globalAlpha = 0.75 * dim;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (e.r + 7), Math.sin(a) * (e.r + 7));
        ctx.lineTo(Math.cos(a) * (e.r + 12), Math.sin(a) * (e.r + 12));
        ctx.stroke();
      }
      ctx.restore();
    }

    // hive honeycomb inner detail (slow-rotating inner hex + breathing core)
    if (e.kind === 'hive') {
      ctx.strokeStyle = body;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + e.t * 0.3;
        const px = Math.cos(a) * e.r * 0.55;
        const py = Math.sin(a) * e.r * 0.55;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.16 + Math.sin(e.t * 3) * 1.6, 0, TAU);
      ctx.fill();
    }

    // core — small, quiet (boss heart beats when enraged)
    ctx.fillStyle = body;
    ctx.beginPath();
    const coreR =
      isBossKind(e.kind) && enraged
        ? Math.max(3, e.r * 0.2 + Math.sin(e.t * 7) * 2.2)
        : Math.max(2, e.r * 0.18);
    ctx.arc(0, 0, coreR, 0, TAU);
    ctx.fill();
    ctx.restore();

    // hp bar — hairline
    if ((e.kind === 'splitter' || e.kind === 'shooter' || e.kind === 'dasher' || isBossKind(e.kind) || e.kind === 'tank' || e.kind === 'sniper' || e.kind === 'lancer' || e.kind === 'hive' || e.kind === 'tesla' || e.kind === 'bomber' || e.elite) && e.hp < e.maxHp) {
      const w = isBossKind(e.kind) ? 96 : e.kind === 'tank' || e.kind === 'hive' ? 48 : 30;
      const frac = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 3.5);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * frac, 3.5);
      ctx.globalAlpha = 1;
    }

    // telegraphs — thin, calm
    if (e.kind === 'dasher' && e.state === 1) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(e.t * 24) * 0.1;
      ctx.strokeStyle = '#d8cfae';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.lockDx * 280, e.y + e.lockDy * 280);
      ctx.stroke();
      ctx.restore();
    }
    // sniper laser telegraph
    if (e.kind === 'sniper' && e.state === 1) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(e.t * 30) * 0.12;
      ctx.strokeStyle = '#d8a8e8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.lockDx * 640, e.y + e.lockDy * 640);
      ctx.stroke();
      ctx.restore();
    }
    // lancer lance telegraph
    if (e.kind === 'lancer' && e.state === 1) {
      ctx.save();
      ctx.globalAlpha = 0.38 + Math.sin(e.t * 28) * 0.12;
      ctx.strokeStyle = '#9ad8cf';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.lockDx * 380, e.y + e.lockDy * 380);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** edge arrows pointing at dangerous offscreen enemies */
  private drawOffscreenIndicators(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const m = 26;
    const x0 = camX + m;
    const y0 = camY + m;
    const x1 = camX + this.viewW - m;
    const y1 = camY + this.viewH - m;
    let drawn = 0;
    const nowMs = performance.now();
    for (const e of this.enemies) {
      if (drawn >= 6 || e.hp <= 0 || e.spawnT > 0) continue;
      const threat =
        isBossKind(e.kind) ? 3 : e.elite ? 2 : e.kind === 'shooter' || e.kind === 'sniper' || e.kind === 'tesla' || e.kind === 'bomber' ? 1 : 0;
      if (threat === 0) continue;
      // onscreen? skip
      if (e.x > camX && e.x < camX + this.viewW && e.y > camY && e.y < camY + this.viewH) continue;
      const cx = clamp(e.x, x0, x1);
      const cy = clamp(e.y, y0, y1);
      const a = Math.atan2(e.y - this.py, e.x - this.px);
      const col = isBossKind(e.kind) ? '#e8949f' : e.elite ? '#e8e0c8' : ENEMY_COLOR[e.kind];
      const pulse = 0.5 + 0.22 * Math.sin(nowMs / 300);
      ctx.save();
      // NOTE: indicator coords are world-space; convert to screen space
      ctx.translate(cx - camX, cy - camY);
      ctx.rotate(a);
      ctx.globalAlpha = pulse;
      const s = threat === 3 ? 10 : threat === 2 ? 8 : 6;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.6, s * 0.7);
      ctx.lineTo(-s * 0.6, -s * 0.7);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
      drawn++;
    }
    // co-op: partner arrow when P2 is offscreen (relative to P1's view center)
    if (this.coOp && this.fighters[1].alive) {
      const q = this.fighters[1];
      if (q.x < camX || q.x > camX + this.viewW || q.y < camY || q.y > camY + this.viewH) {
        const cx = clamp(q.x, x0, x1);
        const cy = clamp(q.y, y0, y1);
        const a = Math.atan2(q.y - this.py, q.x - this.px);
        ctx.save();
        ctx.translate(cx - camX, cy - camY);
        ctx.rotate(a);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 13px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('۲', 0, -12);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, 6);
        ctx.lineTo(-5, -6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawSticks(ctx: CanvasRenderingContext2D): void {
    const draw = (s: Stick, label: string) => {
      if (!s.active) return;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#aab3cc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, 52, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#d9e2f5';
      ctx.beginPath();
      ctx.arc(s.ox + s.dx * 0.6, s.oy + s.dy * 0.6, 20, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#8b93b0';
      ctx.font = '11px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, s.ox, s.oy - 60);
      ctx.restore();
    };
    draw(this.leftStick, 'حرکت');
    draw(this.rightStick, 'شلیک');
  }
}
