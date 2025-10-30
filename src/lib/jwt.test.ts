import { describe, expect, it } from 'vitest';
import { encodeBase64Url } from './base64url';
import { JwtError, parseJwt } from './jwt';

function buildToken(header: unknown, payload: unknown, signature = 'sig'): string {
  return [
    encodeBase64Url(JSON.stringify(header)),
    encodeBase64Url(JSON.stringify(payload)),
    encodeBase64Url(signature),
  ].join('.');
}

describe('parseJwt', () => {
  it('ヘッダとペイロードを取り出せる', () => {
    const token = buildToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-1', exp: 1700000000 });
    const decoded = parseJwt(token);
    expect(decoded.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decoded.payload).toEqual({ sub: 'user-1', exp: 1700000000 });
    expect(decoded.signingInput).toBe(token.slice(0, token.lastIndexOf('.')));
  });

  it('前後の空白とBearer接頭辞を無視する', () => {
    const token = buildToken({ alg: 'none' }, { sub: 'a' }, '');
    expect(parseJwt(`  Bearer ${token}\n`).payload).toEqual({ sub: 'a' });
  });

  it('セグメント数の誤りを明確に伝える', () => {
    expect(() => parseJwt('a.b')).toThrow('セグメント数が2個');
    expect(() => parseJwt('a.b.c.d')).toThrow('セグメント数が4個');
  });

  it('JWEを区別して伝える', () => {
    expect(() => parseJwt('a.b.c.d.e')).toThrow('JWE');
  });

  it('壊れたbase64urlをセグメント名つきで伝える', () => {
    const token = buildToken({ alg: 'HS256' }, { sub: 'a' });
    const [h, p] = token.split('.');
    expect(() => parseJwt(`+bad.${p}.sig`)).toThrow('ヘッダ');
    expect(() => parseJwt(`${h}.+bad.sig`)).toThrow('ペイロード');
    expect(() => parseJwt(`${h}.${p}.+bad`)).toThrow(JwtError);
  });

  it('JSONオブジェクトでないペイロードを拒否する', () => {
    const token = [
      encodeBase64Url(JSON.stringify({ alg: 'HS256' })),
      encodeBase64Url('"just a string"'),
      'sig',
    ].join('.');
    expect(() => parseJwt(token)).toThrow('JSONオブジェクトではない');
  });

  it('空文字列を拒否する', () => {
    expect(() => parseJwt('   ')).toThrow('トークンが空');
  });
});
