import { describe, expect, it } from 'vitest';
import { lifetime } from './lifetime';

describe('lifetime', () => {
  it('iat と exp から区間と現在位置を出す', () => {
    const life = lifetime({ iat: 1000, exp: 2000 }, 1500);
    expect(life).not.toBeNull();
    expect(life!.startS).toBe(1000);
    expect(life!.endS).toBe(2000);
    expect(life!.totalS).toBe(1000);
    expect(life!.ratio).toBeCloseTo(0.5);
    expect(life!.remainingS).toBe(500);
    expect(life!.expired).toBe(false);
    expect(life!.notYet).toBe(false);
  });

  it('開始は nbf を iat より優先する', () => {
    const life = lifetime({ iat: 1000, nbf: 1200, exp: 2000 }, 1600);
    expect(life!.startS).toBe(1200);
    expect(life!.startKey).toBe('nbf');
  });

  it('失効後は ratio を 1 に丸め expired を立てる', () => {
    const life = lifetime({ iat: 1000, exp: 2000 }, 3000);
    expect(life!.ratio).toBe(1);
    expect(life!.expired).toBe(true);
    expect(life!.remainingS).toBe(-1000);
  });

  it('開始前は ratio を 0 に丸め notYet を立てる', () => {
    const life = lifetime({ nbf: 1000, exp: 2000 }, 500);
    expect(life!.ratio).toBe(0);
    expect(life!.notYet).toBe(true);
  });

  it('exp が無ければ null', () => {
    expect(lifetime({ iat: 1000 }, 1500)).toBeNull();
  });

  it('開始時刻(iat/nbf)が無ければ null', () => {
    expect(lifetime({ exp: 2000 }, 1500)).toBeNull();
  });

  it('開始が終了以降の壊れた区間は null', () => {
    expect(lifetime({ iat: 2000, exp: 1000 }, 1500)).toBeNull();
  });

  it('数値でない時刻は無視する', () => {
    expect(lifetime({ iat: 'x', exp: 2000 }, 1500)).toBeNull();
  });
});
