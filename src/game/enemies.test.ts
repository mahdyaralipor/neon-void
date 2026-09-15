import { describe, expect, it } from 'vitest';
import {
  BOSS_KINDS,
  DIFF,
  ENEMY_COLOR,
  ENEMY_FA,
  ENEMY_LORE,
  ENEMY_ROLE,
  ENEMY_TIP,
  ENEMY_UNLOCK,
  bossMultFor,
  bossVariantForWave,
  bulletSpeedMultFor,
  createEnemy,
  diffScoreMultFor,
  eliteChanceFor,
  isBossKind,
  pickKindFor,
  pickTarget,
  type SpawnContext,
} from './enemies';

const ctx: SpawnContext = {
  id: 1, wave: 5, time: 60, difficulty: 'normal', mutator: null, endless: false,
};

describe('roster integrity', () => {
  it('every kind has color, name, lore, role, tip and unlock wave', () => {
    const kinds = Object.keys(ENEMY_COLOR);
    expect(kinds.length).toBe(20);
    for (const k of kinds) {
      const key = k as keyof typeof ENEMY_FA;
      expect(ENEMY_FA[key]).toBeTruthy();
      expect(ENEMY_LORE[key]).toBeTruthy();
      expect(ENEMY_ROLE[key]).toBeTruthy();
      expect(ENEMY_TIP[key]).toBeTruthy();
      expect(ENEMY_UNLOCK[key]).toBeGreaterThan(0);
    }
  });

  it('knows the four bosses', () => {
    expect(BOSS_KINDS).toEqual(['boss', 'juggernaut', 'tempest', 'voidborn']);
    for (const b of BOSS_KINDS) expect(isBossKind(b)).toBe(true);
    expect(isBossKind('chaser')).toBe(false);
    expect(isBossKind('tesla')).toBe(false);
    expect(isBossKind('mender')).toBe(false);
  });
});

describe('bossVariantForWave', () => {
  it('rotates the quartet across boss waves', () => {
    expect(bossVariantForWave(5)).toBe('boss');
    expect(bossVariantForWave(10)).toBe('juggernaut');
    expect(bossVariantForWave(15)).toBe('tempest');
  });

  it('reserves the Voidborn for the wave-20 finale', () => {
    expect(bossVariantForWave(20)).toBe('voidborn');
  });

  it('keeps cycling the quartet in endless', () => {
    expect(bossVariantForWave(25)).toBe('boss');
    expect(bossVariantForWave(30)).toBe('juggernaut');
    expect(bossVariantForWave(35)).toBe('tempest');
    expect(bossVariantForWave(40)).toBe('voidborn');
  });

  it('scales the boss ladder with waves', () => {
    expect(bossMultFor(5)).toBeCloseTo(1, 6);
    expect(bossMultFor(10)).toBeCloseTo(1.9, 6);
    expect(bossMultFor(10)).toBeGreaterThan(bossMultFor(5));
  });
});

describe('createEnemy', () => {
  it('builds bombers that threaten up close', () => {
    const e = createEnemy('bomber', 100, 100, ctx);
    expect(e.hp).toBeGreaterThan(0);
    expect(e.r).toBe(16);
    expect(e.xp).toBe(12);
  });

  it('builds tesla turrets with a fire timer', () => {
    const e = createEnemy('tesla', 100, 100, ctx);
    expect(e.fireCd).toBeGreaterThan(0);
    expect(e.speed).toBeLessThan(120);
  });

  it('builds the v7.6 roster additions with sane stats', () => {
    const mortar = createEnemy('mortar', 0, 0, ctx);
    expect(mortar.r).toBe(17);
    expect(mortar.fireCd).toBeGreaterThan(0);
    const mender = createEnemy('mender', 0, 0, ctx);
    expect(mender.r).toBe(16);
    expect(mender.dmg).toBeLessThan(createEnemy('chaser', 0, 0, ctx).dmg);
    const mirage = createEnemy('mirage', 0, 0, ctx);
    expect(mirage.speed).toBeGreaterThan(200);
    expect(mirage.stateT).toBeGreaterThan(0);
    const over = createEnemy('boss', 0, 0, ctx);
    const vb = createEnemy('voidborn', 0, 0, { ...ctx, wave: 20 });
    expect(vb.maxHp).toBeGreaterThan(over.maxHp);
    expect(vb.score).toBeGreaterThan(over.score);
    expect(vb.r).toBe(60);
    expect(vb.summonT).toBeGreaterThan(0);
  });

  it('unlocks the new blood on schedule', () => {
    const seen6 = new Set<string>();
    for (let i = 0; i < 500; i++) seen6.add(pickKindFor(6, null));
    expect(seen6.has('mortar')).toBe(true);
    const seen8 = new Set<string>();
    for (let i = 0; i < 500; i++) seen8.add(pickKindFor(8, null));
    expect(seen8.has('mirage')).toBe(true);
    const seen10 = new Set<string>();
    for (let i = 0; i < 500; i++) seen10.add(pickKindFor(10, null));
    expect(seen10.has('mender')).toBe(true);
    // newcomers stay locked early
    const seen3 = new Set<string>();
    for (let i = 0; i < 300; i++) seen3.add(pickKindFor(3, null));
    expect(seen3.has('mortar')).toBe(false);
    expect(seen3.has('mirage')).toBe(false);
    expect(seen3.has('mender')).toBe(false);
  });

  it('builds a juggernaut heavier than the overlord', () => {
    const over = createEnemy('boss', 0, 0, ctx);
    const jug = createEnemy('juggernaut', 0, 0, ctx);
    const tem = createEnemy('tempest', 0, 0, ctx);
    expect(jug.maxHp).toBeGreaterThan(over.maxHp);
    expect(jug.speed).toBeLessThan(over.speed);
    expect(tem.speed).toBeGreaterThan(over.speed);
    expect(tem.maxHp).toBeLessThan(over.maxHp);
    expect(tem.summonT).toBeGreaterThan(0);
  });

  it('scales with waves and endless', () => {
    // elites roll randomly — compare plain (non-elite) samples only
    const plain = (wave: number, endless: boolean) => {
      for (let i = 0; i < 50; i++) {
        const e = createEnemy('chaser', 0, 0, { ...ctx, wave, endless });
        if (!e.elite) return e;
      }
      throw new Error('no plain enemy sampled');
    };
    expect(plain(15, false).maxHp).toBeGreaterThan(plain(1, false).maxHp);
    expect(plain(25, true).maxHp).toBeGreaterThan(plain(25, false).maxHp);
  });

  it('never makes bosses or minis elite', () => {
    for (let i = 0; i < 50; i++) {
      expect(createEnemy('boss', 0, 0, { ...ctx, wave: 20 }).elite).toBe(false);
      expect(createEnemy('juggernaut', 0, 0, { ...ctx, wave: 20 }).elite).toBe(false);
      expect(createEnemy('tempest', 0, 0, { ...ctx, wave: 20 }).elite).toBe(false);
      expect(createEnemy('voidborn', 0, 0, { ...ctx, wave: 20 }).elite).toBe(false);
      expect(createEnemy('mini', 0, 0, ctx).elite).toBe(false);
    }
  });
});

describe('difficulty', () => {
  it('insane is a real hell', () => {
    expect(DIFF.insane.hp).toBeGreaterThan(DIFF.hard.hp);
    expect(DIFF.insane.dmg).toBeGreaterThan(DIFF.hard.dmg);
    expect(DIFF.insane.interval).toBeLessThan(DIFF.hard.interval);
  });

  it('pays score for suffering', () => {
    expect(diffScoreMultFor('insane')).toBe(1.25);
    expect(diffScoreMultFor('hard')).toBe(1.1);
    expect(diffScoreMultFor('normal')).toBe(1);
    expect(diffScoreMultFor('easy')).toBe(1);
  });

  it('speeds up hell bullets and elites', () => {
    expect(bulletSpeedMultFor('insane')).toBeGreaterThan(1);
    expect(bulletSpeedMultFor('normal')).toBe(1);
    expect(eliteChanceFor(10, null, 'insane')).toBeGreaterThan(eliteChanceFor(10, null, 'normal'));
  });

  it('draws new blood from the mid-game bag', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pickKindFor(10, null));
    expect(seen.has('bomber')).toBe(true);
    expect(seen.has('tesla')).toBe(true);
  });

  it('knows the frenzy mutator', () => {
    const f = createEnemy('chaser', 0, 0, { ...ctx, mutator: 'frenzy' });
    const calm = createEnemy('chaser', 0, 0, { ...ctx, mutator: null });
    expect(f.speed).toBeGreaterThan(calm.speed);
    expect(f.score).toBeGreaterThan(calm.score);
  });
});

describe('pickTarget', () => {
  const p1 = { x: 0, y: 0, alive: true };
  const p2 = { x: 100, y: 0, alive: true };

  it('hunts the nearest living pilot', () => {
    expect(pickTarget(90, 0, p1, p2)).toBe(p2);
    expect(pickTarget(10, 0, p1, p2)).toBe(p1);
  });

  it('falls back to whoever is alive', () => {
    expect(pickTarget(90, 0, p1, { ...p2, alive: false })).toBe(p1);
    expect(pickTarget(10, 0, { ...p1, alive: false }, p2)).toBe(p2);
  });

  it('is solo-identical with no P2', () => {
    expect(pickTarget(90, 0, p1, null)).toBe(p1);
  });
});
