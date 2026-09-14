import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementDef } from './achievements';

describe('achievements catalog', () => {
  it('has unique ids and resolvable defs', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(a.nameFa.length).toBeGreaterThan(0);
      expect(a.nameEn.length).toBeGreaterThan(0);
      expect(achievementDef(a.id)).toEqual(a);
    }
  });

  it('covers the v6/v7 systems', () => {
    for (const id of ['endless1', 'chainlord', 'stinger15', 'stormrider', 'greed_is_good', 'untouchable', 'blood_brothers']) {
      expect(achievementDef(id)).toBeDefined();
    }
  });

  it('returns undefined for unknown ids', () => {
    expect(achievementDef('nope-not-real')).toBeUndefined();
  });
});
