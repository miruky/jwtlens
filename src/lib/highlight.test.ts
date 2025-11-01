import { describe, expect, it } from 'vitest';
import { tokenizeJson, type JsonTokenType } from './highlight';

function typesOf(json: string, want: JsonTokenType): string[] {
  return tokenizeJson(json)
    .filter((t) => t.type === want)
    .map((t) => t.text);
}

describe('tokenizeJson', () => {
  it('キーと文字列値を区別する', () => {
    const json = JSON.stringify({ sub: 'user-1', name: '山田' }, null, 2);
    expect(typesOf(json, 'key')).toEqual(['"sub"', '"name"']);
    expect(typesOf(json, 'string')).toEqual(['"user-1"', '"山田"']);
  });

  it('数値・真偽・nullを型ごとに分類する', () => {
    const json = JSON.stringify({ iat: 1700000000, ok: true, off: false, none: null }, null, 2);
    expect(typesOf(json, 'number')).toEqual(['1700000000']);
    expect(typesOf(json, 'boolean')).toEqual(['true', 'false']);
    expect(typesOf(json, 'null')).toEqual(['null']);
  });

  it('コロンを含む文字列値はキーと誤認しない', () => {
    const json = JSON.stringify({ iss: 'https://issuer.example' }, null, 2);
    expect(typesOf(json, 'key')).toEqual(['"iss"']);
    expect(typesOf(json, 'string')).toEqual(['"https://issuer.example"']);
  });

  it('エスケープを含む文字列を1トークンとして扱う', () => {
    const json = JSON.stringify({ q: 'a"b\\c' }, null, 2);
    expect(typesOf(json, 'string')).toEqual(['"a\\"b\\\\c"']);
  });

  it('トークンを連結すると元の文字列に戻る', () => {
    const json = JSON.stringify(
      { sub: 'x', roles: ['a', 'b'], n: 3, deep: { y: false } },
      null,
      2,
    );
    expect(tokenizeJson(json).map((t) => t.text).join('')).toBe(json);
  });
});
