/* Enemy data, factory and boss-variant tables — extracted from the engine
 * so balance, roster and spawn rules live in one testable place.
 * Pure functions (no canvas, no audio) → covered by enemies.test.ts. */

import type { Difficulty, EnemyKind, MutatorKind } from './types';
import { MUTATORS, WIN_WAVE } from './types';
import { rand, TAU } from './utils';

export interface Enemy {
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
  affix: 'none' | 'volatile' | 'swift' | 'bulwark' | 'echo';
  orbHitCd: number;
  spiralT: number; // boss spiral pattern timer
  spiralA: number; // boss spiral angle accumulator
  spawnT: number; // spawn phase-in timer (invulnerable + harmless while > 0)
  summonT: number; // boss minion-summon timer
}

export const ENEMY_COLOR: Record<EnemyKind, string> = {
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
  boss: '#ff2244',
  juggernaut: '#ff5d00',
  tempest: '#d8b4fe',
};

export const ENEMY_FA: Record<EnemyKind, string> = {
  chaser: 'تعقیب‌کننده',
  weaver: 'بافنده',
  dasher: 'جهنده',
  shooter: 'تیرانداز',
  splitter: 'تقسیم‌شونده',
  mini: 'مینی',
  sniper: 'اسنایپر',
  tank: 'تانک',
  lancer: 'نیزه‌دار',
  hive: 'کندو',
  stinger: 'نیش‌دار',
  bomber: 'بمب‌افکن',
  tesla: 'تسلا',
  boss: 'باس',
  juggernaut: 'جاگرنات',
  tempest: 'تمپست',
};

export const ENEMY_LORE: Record<EnemyKind, string> = {
  chaser: 'ساده و سمج — همیشه دنبالت می‌کند',
  weaver: 'مارپیچ می‌آید، aim گرفتن سخت است',
  dasher: 'تلگراف می‌زند بعد جهش مرگبار',
  shooter: 'فاصله می‌گیرد و شلیک می‌کند',
  splitter: 'می‌ترکد و مینی‌ها بیرون می‌ریزند',
  mini: 'سریع و ضعیف — غذای کمبو',
  sniper: 'لیزر دوربرد با دمیج سنگین',
  tank: 'گوشت دم توپ — دیر می‌میرد',
  lancer: 'شارژ خطی با تلگراف باریک',
  hive: 'مینی‌فکتوری — زود بزنش',
  stinger: 'جدید: ۳تیر پشت‌سرهم + سرعت بالا',
  bomber: 'سوت که کشید فرار کن — انفجار شعاعی',
  tesla: 'برجک برق — خط تلگراف = برق گرفتگی',
  boss: 'اورلرد — اسپیرال و احضار',
  juggernaut: 'کند ولی ویرانگر — شارژ + موج آتش',
  tempest: 'سریع و دور — رگبار هدف‌دار + صاعقه',
};

/** Difficulty tuning. Insane is a real hell now: brutal stats, denser
 *  spawns, meaner elites — paid back with +25% score. */
export const DIFF: Record<Difficulty, { hp: number; dmg: number; speed: number; quota: number; interval: number }> = {
  easy: { hp: 0.7, dmg: 0.7, speed: 0.92, quota: 0.8, interval: 1.25 },
  normal: { hp: 1, dmg: 1, speed: 1, quota: 1, interval: 1 },
  hard: { hp: 1.38, dmg: 1.28, speed: 1.06, quota: 1.25, interval: 0.82 },
  insane: { hp: 2.15, dmg: 1.95, speed: 1.18, quota: 1.6, interval: 0.58 },
};

/** Score reward per difficulty — suffering pays. */
export function diffScoreMultFor(d: Difficulty): number {
  if (d === 'insane') return 1.25;
  if (d === 'hard') return 1.1;
  return 1;
}

/** Enemy bullets fly 12% faster in hell. */
export function bulletSpeedMultFor(d: Difficulty): number {
  return d === 'insane' ? 1.12 : 1;
}

export const BOSS_KINDS: readonly EnemyKind[] = ['boss', 'juggernaut', 'tempest'];

export function isBossKind(kind: EnemyKind): boolean {
  return kind === 'boss' || kind === 'juggernaut' || kind === 'tempest';
}

/** Which boss guards a boss wave. Wave 20 is always the Overlord finale;
 *  endless waves keep cycling the trio. */
export function bossVariantForWave(wave: number): EnemyKind {
  if (wave === WIN_WAVE) return 'boss';
  const cycle: EnemyKind[] = ['boss', 'juggernaut', 'tempest'];
  const tier = Math.max(1, Math.round(wave / 5));
  return cycle[(((tier - 1) % 3) + 3) % 3];
}

/** Shared boss HP ladder — every 5 waves the bosses get meaner. */
export function bossMultFor(wave: number): number {
  return 1 + (wave / 5 - 1) * 0.9;
}

export interface Targetable {
  x: number;
  y: number;
  alive: boolean;
}

/** Nearest living pilot for enemy AI. Solo passes p2=null and behaves
 *  exactly like the old always-chase-P1 code. */
export function pickTarget(ax: number, ay: number, p1: Targetable, p2: Targetable | null): Targetable {
  if (!p2 || !p2.alive) return p1;
  if (!p1.alive) return p2;
  const d1 = (ax - p1.x) * (ax - p1.x) + (ay - p1.y) * (ay - p1.y);
  const d2 = (ax - p2.x) * (ax - p2.x) + (ay - p2.y) * (ay - p2.y);
  return d2 < d1 ? p2 : p1;
}

export function eliteChanceFor(wave: number, mutator: MutatorKind | null, difficulty: Difficulty): number {
  const base = Math.min(0.16, 0.03 + wave * 0.008);
  const gold = mutator === 'gold_rush' ? 0.12 : 0;
  const hell = difficulty === 'insane' ? 0.05 : 0;
  return Math.min(0.32, base + gold + hell);
}

/** Wave spawn bag — unlocks as the run progresses. */
export function pickKindFor(wave: number, mutator: MutatorKind | null): EnemyKind {
  if (mutator === 'snipers' && wave >= 6 && Math.random() < 0.45) {
    return 'sniper';
  }
  const w = wave;
  const bag: EnemyKind[] = ['chaser', 'chaser', 'chaser'];
  if (w >= 2) bag.push('weaver', 'weaver');
  if (w >= 3) bag.push('dasher', 'dasher');
  if (w >= 4) bag.push('shooter', 'lancer', 'bomber');
  if (w >= 5) bag.push('splitter', 'stinger');
  if (w >= 6) bag.push('shooter', 'dasher', 'sniper', 'hive', 'stinger');
  if (w >= 7) bag.push('tank', 'lancer', 'stinger', 'tesla');
  if (w >= 8) bag.push('splitter', 'weaver', 'sniper', 'bomber');
  if (w >= 10) bag.push('tank', 'shooter', 'stinger', 'tesla');
  return bag[Math.floor(Math.random() * bag.length)];
}

export interface SpawnContext {
  id: number;
  wave: number;
  time: number;
  difficulty: Difficulty;
  mutator: MutatorKind | null;
  endless: boolean;
}

/** Full enemy factory (stats + elite roll). Movement AI lives in the engine. */
export function createEnemy(kind: EnemyKind, x: number, y: number, ctx: SpawnContext): Enemy {
  const d = DIFF[ctx.difficulty];
  const endlessMult = ctx.endless ? 1 + Math.max(0, ctx.wave - WIN_WAVE) * 0.16 : 1;
  // v7: gentler early scaling so the player feels strong fast
  const wScale = (1 + (ctx.wave - 1) * 0.115 + Math.max(0, ctx.time / 240) * 0.25) * endlessMult;
  const base: Enemy = {
    id: ctx.id, kind, x, y, vx: 0, vy: 0,
    r: 16, hp: 30, maxHp: 30, speed: 130, dmg: 12,
    xp: 6, score: 25, t: 0, flash: 0, fireCd: rand(1, 2.5),
    state: 0, stateT: 0, lockDx: 0, lockDy: 0, strafe: Math.random() < 0.5 ? -1 : 1,
    kx: 0, ky: 0, elite: false, affix: 'none', orbHitCd: 0,
    spiralT: 0, spiralA: Math.random() * TAU,
    spawnT: 0, summonT: 0,
  };
  switch (kind) {
    case 'chaser':
      base.hp = base.maxHp = 30 * wScale * d.hp;
      base.speed = 148 * d.speed;
      base.dmg = 12 * d.dmg;
      base.xp = 6; base.score = 25; base.r = 16;
      break;
    case 'weaver':
      base.hp = base.maxHp = 22 * wScale * d.hp;
      base.speed = 190 * d.speed;
      base.dmg = 10 * d.dmg;
      base.xp = 7; base.score = 35; base.r = 14;
      break;
    case 'dasher':
      base.hp = base.maxHp = 40 * wScale * d.hp;
      base.speed = 132 * d.speed;
      base.dmg = 16 * d.dmg;
      base.xp = 10; base.score = 50; base.r = 15;
      break;
    case 'shooter':
      base.hp = base.maxHp = 34 * wScale * d.hp;
      base.speed = 112 * d.speed;
      base.dmg = 10 * d.dmg;
      base.xp = 11; base.score = 60; base.r = 16;
      break;
    case 'splitter':
      base.hp = base.maxHp = 70 * wScale * d.hp;
      base.speed = 92 * d.speed;
      base.dmg = 14 * d.dmg;
      base.xp = 8; base.score = 55; base.r = 22;
      break;
    case 'mini':
      base.hp = base.maxHp = 12 * wScale * d.hp;
      base.speed = 225 * d.speed;
      base.dmg = 7 * d.dmg;
      base.xp = 3; base.score = 12; base.r = 9;
      break;
    case 'sniper':
      base.hp = base.maxHp = 46 * wScale * d.hp;
      base.speed = 102 * d.speed;
      base.dmg = 18 * d.dmg;
      base.xp = 14; base.score = 80; base.r = 15;
      base.fireCd = rand(1.2, 2);
      break;
    case 'tank':
      base.hp = base.maxHp = 150 * wScale * d.hp;
      base.speed = 68 * d.speed;
      base.dmg = 20 * d.dmg;
      base.xp = 18; base.score = 110; base.r = 26;
      break;
    case 'lancer':
      base.hp = base.maxHp = 34 * wScale * d.hp;
      base.speed = 215 * d.speed;
      base.dmg = 14 * d.dmg;
      base.xp = 12; base.score = 65; base.r = 14;
      base.stateT = rand(0.5, 1.2);
      break;
    case 'hive':
      base.hp = base.maxHp = 130 * wScale * d.hp;
      base.speed = 48 * d.speed;
      base.dmg = 16 * d.dmg;
      base.xp = 30; base.score = 150; base.r = 30;
      base.fireCd = 2.5; // doubles as mini-spawn timer
      break;
    case 'stinger':
      base.hp = base.maxHp = 28 * wScale * d.hp;
      base.speed = 235 * d.speed;
      base.dmg = 9 * d.dmg;
      base.xp = 12; base.score = 70; base.r = 13;
      base.fireCd = rand(0.8, 1.4);
      break;
    case 'bomber':
      base.hp = base.maxHp = 46 * wScale * d.hp;
      base.speed = 82 * d.speed;
      base.dmg = 10 * d.dmg;
      base.xp = 12; base.score = 70; base.r = 16;
      break;
    case 'tesla':
      base.hp = base.maxHp = 52 * wScale * d.hp;
      base.speed = 88 * d.speed;
      base.dmg = 10 * d.dmg;
      base.xp = 14; base.score = 85; base.r = 15;
      base.fireCd = rand(1.6, 2.4);
      break;
    case 'boss': {
      const mult = bossMultFor(ctx.wave);
      base.hp = base.maxHp = 950 * mult * d.hp;
      base.speed = 98 * d.speed;
      base.dmg = 24 * d.dmg;
      base.xp = 120; base.score = 1500; base.r = 52;
      break;
    }
    case 'juggernaut': {
      const mult = bossMultFor(ctx.wave);
      base.hp = base.maxHp = 1400 * mult * d.hp;
      base.speed = 62 * d.speed;
      base.dmg = 27 * d.dmg;
      base.xp = 150; base.score = 2200; base.r = 56;
      base.stateT = rand(1, 2);
      break;
    }
    case 'tempest': {
      const mult = bossMultFor(ctx.wave);
      base.hp = base.maxHp = 800 * mult * d.hp;
      base.speed = 152 * d.speed;
      base.dmg = 20 * d.dmg;
      base.xp = 150; base.score = 2200; base.r = 44;
      base.fireCd = rand(1, 1.8);
      base.summonT = 7;
      break;
    }
  }
  base.hp = base.maxHp = Math.round(base.hp);
  // surge mutator: faster enemies (frenzy: slightly faster + meaner handled by spawn rate)
  if ((ctx.mutator === 'surge' || ctx.mutator === 'frenzy') && !isBossKind(kind)) {
    base.speed *= ctx.mutator === 'surge' ? 1.25 : 1.1;
    base.score = Math.round(base.score * (ctx.mutator === 'surge' ? MUTATORS.surge.scoreMult : MUTATORS.frenzy.scoreMult));
  }
  // elite roll (not for minis or bosses)
  if (!isBossKind(kind) && kind !== 'mini' && Math.random() < eliteChanceFor(ctx.wave, ctx.mutator, ctx.difficulty)) {
    base.elite = true;
    base.hp = base.maxHp = Math.round(base.maxHp * 3.2);
    base.dmg = Math.round(base.dmg * 1.4);
    base.xp *= 5;
    base.score *= 4;
    base.r *= 1.22;
    base.speed *= 1.06;
    const roll = Math.random();
    if (roll < 0.28) {
      base.affix = 'volatile';
      base.score = Math.round(base.score * 1.25);
    } else if (roll < 0.5) {
      base.affix = 'swift';
      base.speed *= 1.3;
    } else if (roll < 0.68) {
      base.affix = 'bulwark';
      base.hp = base.maxHp = Math.round(base.maxHp * 1.45);
      base.speed *= 0.86;
      base.score = Math.round(base.score * 1.5);
      base.r *= 1.1;
    } else if (roll < 0.84) {
      base.affix = 'echo';
      base.xp *= 2;
      base.score = Math.round(base.score * 1.5);
    }
  }
  return base;
}
