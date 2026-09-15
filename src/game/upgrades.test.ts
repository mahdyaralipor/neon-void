import { describe, expect, it } from 'vitest';
import { BASE_STATS, statsForShip } from './types';
import {
  UPGRADE_POOL,
  UPGRADE_MAP,
  applyUpgrade,
  executionerMult,
  comboScoreMult,
  comboWindow,
  thornsDamage,
  rollUpgrades,
  stormProcChance,
  stormTargets,
  critNovaMult,
  critNovaRadius,
  midasGemMult,
  midasScoreMult,
} from './upgrades';

describe('upgrade pool integrity', () => {
  it('has unique ids and valid tiers/stacks', () => {
    const ids = new Set<string>();
    for (const u of UPGRADE_POOL) {
      expect(ids.has(u.id)).toBe(false);
      ids.add(u.id);
      expect(['common', 'rare', 'epic']).toContain(u.tier);
      expect(u.maxStacks).toBeGreaterThan(0);
      expect(UPGRADE_MAP[u.id]).toBe(u);
    }
  });
});

describe('applyUpgrade', () => {
  it('scales damage multiplicatively', () => {
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'damage');
    expect(s.damage).toBeCloseTo(BASE_STATS.damage * 1.25, 6);
  });

  it('caps multishot at 5', () => {
    const s = { ...BASE_STATS };
    for (let i = 0; i < 10; i++) applyUpgrade(s, 'multishot');
    expect(s.multishot).toBe(5);
  });

  it('caps crit chance', () => {
    const s = { ...BASE_STATS };
    for (let i = 0; i < 10; i++) applyUpgrade(s, 'crit');
    expect(s.critChance).toBeLessThanOrEqual(0.75);
  });

  it('floors dash cooldown', () => {
    const s = { ...BASE_STATS };
    for (let i = 0; i < 10; i++) applyUpgrade(s, 'dash');
    expect(s.dashCooldownMax).toBeGreaterThanOrEqual(0.7);
  });

  it('headhunter raises crit multiplier', () => {
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'headhunter');
    expect(s.critMult).toBeCloseTo(BASE_STATS.critMult + 0.4, 6);
  });

  it('sniper trades rate for heavy rounds', () => {
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'sniper');
    expect(s.damage).toBeCloseTo(BASE_STATS.damage * 1.35, 6);
    expect(s.bulletSpeed).toBeCloseTo(BASE_STATS.bulletSpeed * 1.3, 6);
    expect(s.fireRate).toBeCloseTo(BASE_STATS.fireRate * 0.9, 6);
  });

  it('fortress tanks up and slows down', () => {
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'fortress');
    expect(s.maxHp).toBe(BASE_STATS.maxHp + 40);
    expect(s.armor).toBe(BASE_STATS.armor + 2);
    expect(s.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 0.92, 6);
  });
});

describe('dynamic multipliers', () => {
  it('executioner scales with stacks', () => {
    expect(executionerMult(new Map())).toBe(1);
    expect(executionerMult(new Map([['executioner', 2]]))).toBeCloseTo(2.2, 6);
  });

  it('combo window grows with combomaster', () => {
    expect(comboWindow(new Map())).toBe(4);
    expect(comboWindow(new Map([['combomaster', 2]]))).toBe(7);
  });

  it('combo score multiplier grows', () => {
    expect(comboScoreMult(new Map())).toBe(1);
    expect(comboScoreMult(new Map([['combomaster', 1]]))).toBe(2);
  });

  it('thorns damage is 12 per stack', () => {
    expect(thornsDamage(new Map())).toBe(0);
    expect(thornsDamage(new Map([['thorns', 3]]))).toBe(36);
  });
});

describe('v7.5 hybrids', () => {
  it('pool has 38 upgrades including all 9 fusions', () => {
    expect(UPGRADE_POOL.length).toBe(38);
    for (const id of ['stormrounds', 'critnova', 'novadash', 'vampire', 'twinlink', 'phoenix', 'temporal', 'midas', 'hyperrail']) {
      expect(UPGRADE_MAP[id]).toBeDefined();
    }
  });

  it('vampire grants a first orbital blade', () => {
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'vampire');
    expect(s.orbitals).toBe(1);
  });

  it('hyperrail adds pierce capped at 6', () => {
    const s = { ...BASE_STATS };
    for (let i = 0; i < 10; i++) applyUpgrade(s, 'hyperrail');
    expect(s.pierce).toBeLessThanOrEqual(6);
    expect(s.damage).toBeGreaterThan(BASE_STATS.damage);
  });

  it('phoenix is single-stack and adds max HP', () => {
    expect(UPGRADE_MAP['phoenix'].maxStacks).toBe(1);
    const s = { ...BASE_STATS };
    applyUpgrade(s, 'phoenix');
    expect(s.maxHp).toBe(BASE_STATS.maxHp + 20);
  });

  it('storm helpers scale with stacks and chain synergy', () => {
    expect(stormProcChance(new Map())).toBe(0);
    expect(stormProcChance(new Map([['stormrounds', 2]]))).toBeCloseTo(0.5, 6);
    expect(stormTargets(new Map([['stormrounds', 1]]))).toBe(3);
    expect(stormTargets(new Map([['stormrounds', 1], ['chain', 1]]))).toBe(5);
  });

  it('crit nova and midas helpers scale', () => {
    expect(critNovaMult(new Map([['critnova', 2]]))).toBeCloseTo(1.8, 6);
    expect(critNovaRadius(new Map([['critnova', 1]]))).toBe(135);
    expect(midasGemMult(new Map([['midas', 2]]))).toBeCloseTo(1.5, 6);
    expect(midasScoreMult(new Map([['midas', 1]]))).toBeCloseTo(1.1, 6);
  });
});

describe('rollUpgrades', () => {
  it('returns 3 distinct available upgrades', () => {
    const picks = rollUpgrades(new Map(), 3);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });

  it('never offers maxed-out upgrades', () => {
    const taken = new Map<string, number>();
    for (const u of UPGRADE_POOL) taken.set(u.id, u.maxStacks);
    // leave one available
    taken.set('damage', 0);
    const picks = rollUpgrades(taken, 3);
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect((taken.get(p.id) ?? 0) < p.maxStacks).toBe(true);
    }
  });

  it('ships keep their identity bonuses', () => {
    expect(statsForShip('titan').armor).toBeGreaterThanOrEqual(3);
    expect(statsForShip('warden').orbitals).toBe(1);
    expect(statsForShip('phantom').critChance).toBeGreaterThan(BASE_STATS.critChance);
  });

  it('nomad farms faster and hits softer', () => {
    const n = statsForShip('nomad');
    expect(n.magnet).toBeGreaterThan(BASE_STATS.magnet);
    expect(n.xpGainMult).toBeGreaterThan(1);
    expect(n.damage).toBeLessThan(BASE_STATS.damage);
  });
});
