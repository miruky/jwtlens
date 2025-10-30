import { describe, expect, it } from 'vitest';
import { claimViews, relativeTime, tokenTimeStatus } from './claims';

const NOW = 1_750_000_000;

describe('relativeTime', () => {
  it('未来は「後」、過去は「前」', () => {
    expect(relativeTime(NOW + 30, NOW)).toBe('30秒後');
    expect(relativeTime(NOW - 30, NOW)).toBe('30秒前');
  });

  it('上位2単位までに丸める', () => {
    expect(relativeTime(NOW + 86400 * 2 + 3600 * 3 + 60 * 5, NOW)).toBe('2日3時間後');
    expect(relativeTime(NOW + 3600 + 60 * 12 + 40, NOW)).toBe('1時間12分後');
  });

  it('同時刻は「ちょうど今」', () => {
    expect(relativeTime(NOW, NOW)).toBe('ちょうど今');
  });
});

describe('tokenTimeStatus', () => {
  it('期限内はvalid', () => {
    expect(tokenTimeStatus({ exp: NOW + 3600 }, NOW).state).toBe('valid');
  });

  it('期限切れはexpired', () => {
    const status = tokenTimeStatus({ exp: NOW - 60 }, NOW);
    expect(status.state).toBe('expired');
    expect(status.detail).toContain('失効');
  });

  it('nbf前はnot-yetでexpより優先される', () => {
    expect(tokenTimeStatus({ nbf: NOW + 600, exp: NOW + 3600 }, NOW).state).toBe('not-yet');
  });

  it('expなしはno-exp', () => {
    expect(tokenTimeStatus({ sub: 'a' }, NOW).state).toBe('no-exp');
  });
});

describe('claimViews', () => {
  it('既知クレームに日本語ラベルが付く', () => {
    const views = claimViews({ iss: 'https://issuer.example', custom: 1 }, NOW);
    expect(views.find((v) => v.key === 'iss')?.label).toBe('発行者');
    expect(views.find((v) => v.key === 'custom')?.label).toBeNull();
  });

  it('時刻クレームに絶対時刻と相対時刻の注記が付く', () => {
    const views = claimViews({ exp: NOW + 3600 }, NOW);
    const exp = views.find((v) => v.key === 'exp');
    expect(exp?.note).toContain('1時間後');
    expect(exp?.warn).toBe(false);
  });

  it('失効済みexpと未来のiatに警告が付く', () => {
    const views = claimViews({ exp: NOW - 10, iat: NOW + 3600 }, NOW);
    expect(views.find((v) => v.key === 'exp')?.warn).toBe(true);
    expect(views.find((v) => v.key === 'iat')?.warn).toBe(true);
    expect(views.find((v) => v.key === 'iat')?.note).toContain('時計ずれ');
  });

  it('数値でない時刻クレームには注記を付けない', () => {
    const views = claimViews({ exp: 'tomorrow' }, NOW);
    expect(views.find((v) => v.key === 'exp')?.note).toBeNull();
  });
});
