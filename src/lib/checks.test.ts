import { describe, expect, it } from 'vitest';
import { securityChecks } from './checks';

const NOW = 1_700_000_000;

function titles(header: Record<string, unknown>, payload: Record<string, unknown>): string[] {
  return securityChecks(header, payload, NOW).map((c) => c.title);
}

describe('securityChecks', () => {
  it('alg=none を danger として最上位に挙げる', () => {
    const checks = securityChecks({ alg: 'none' }, {}, NOW);
    expect(checks[0]!.severity).toBe('danger');
    expect(checks[0]!.title).toContain('alg=none');
  });

  it('HS系は対称鍵の注意を info で出す', () => {
    expect(titles({ alg: 'HS256' }, { exp: NOW + 3600, iat: NOW })).toContain(
      '対称鍵アルゴリズム(HS系)',
    );
  });

  it('exp が無ければ失効しない警告を出す', () => {
    expect(titles({ alg: 'RS256' }, {})).toContain('exp(失効時刻)がない');
  });

  it('失効済みは danger', () => {
    const checks = securityChecks({ alg: 'RS256' }, { exp: NOW - 100, iat: NOW - 3600 }, NOW);
    expect(checks.some((c) => c.severity === 'danger' && c.title === '失効済み')).toBe(true);
  });

  it('有効期間が24時間を超えると警告する', () => {
    expect(titles({ alg: 'RS256' }, { iat: NOW, exp: NOW + 48 * 3600 })).toContain(
      '有効期間が長い',
    );
  });

  it('短い有効期間では長期警告を出さない', () => {
    expect(titles({ alg: 'RS256' }, { iat: NOW, exp: NOW + 600 })).not.toContain('有効期間が長い');
  });

  it('iat が未来なら警告する', () => {
    expect(titles({ alg: 'RS256' }, { iat: NOW + 3600, exp: NOW + 7200 })).toContain(
      '発行時刻(iat)が未来',
    );
  });

  it('nbf が未来なら info を出す', () => {
    expect(titles({ alg: 'RS256' }, { nbf: NOW + 3600, exp: NOW + 7200 })).toContain(
      'まだ有効になっていない',
    );
  });

  it('問題が無ければ ok を1件だけ返す', () => {
    const checks = securityChecks({ alg: 'RS256' }, { iat: NOW, exp: NOW + 600 }, NOW);
    expect(checks).toHaveLength(1);
    expect(checks[0]!.severity).toBe('ok');
  });

  it('重大度の高い順に並ぶ', () => {
    const checks = securityChecks({ alg: 'HS256' }, { exp: NOW - 100, iat: NOW - 48 * 3600 }, NOW);
    const ranks = checks.map((c) => c.severity);
    expect(ranks.indexOf('danger')).toBeLessThan(ranks.indexOf('info'));
  });
});
