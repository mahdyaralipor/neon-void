import { describe, expect, it } from 'vitest';
import { clamp, lerp, dist2, angleTo, sweep, TAU } from './utils';

describe('math utils', () => {
  it('TAU is a full turn', () => {
    expect(TAU).toBeCloseTo(Math.PI * 2, 10);
  });

  it('clamp pins both ends', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('dist2 is squared euclidean', () => {
    expect(dist2(0, 0, 3, 4)).toBe(25);
    expect(dist2(1, 1, 1, 1)).toBe(0);
  });

  it('angleTo points at the target', () => {
    expect(angleTo(0, 0, 1, 0)).toBeCloseTo(0, 10);
    expect(angleTo(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('sweep', () => {
  it('removes rejected elements in place without allocating', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = sweep(arr, (v) => v % 2 === 1);
    expect(out).toEqual([1, 3, 5]);
    expect(out).toBe(arr);
  });

  it('handles empty and all-rejected arrays', () => {
    expect(sweep([], () => true)).toEqual([]);
    expect(sweep([1, 2], () => false)).toEqual([]);
  });
});
