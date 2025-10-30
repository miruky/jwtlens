import { describe, expect, it } from 'vitest';
import { decodeBase64Url, decodeBase64UrlToText, encodeBase64Url } from './base64url';

describe('encodeBase64Url / decodeBase64Url', () => {
  it('文字列の往復で値が保たれる', () => {
    const original = '{"alg":"HS256","typ":"JWT"}';
    expect(decodeBase64UrlToText(encodeBase64Url(original))).toBe(original);
  });

  it('日本語を含むUTF-8の往復で値が保たれる', () => {
    const original = '{"name":"山田 太郎","role":"管理者"}';
    expect(decodeBase64UrlToText(encodeBase64Url(original))).toBe(original);
  });

  it('パディングなしで出力し+/を使わない', () => {
    // 0xfb 0xff は標準base64で +/ を生む並び
    const encoded = encodeBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(encoded)).toEqual(new Uint8Array([0xfb, 0xff, 0xbf]));
  });

  it('長さ1〜3の全バイト境界で往復できる', () => {
    for (const bytes of [[1], [1, 2], [1, 2, 3]]) {
      const data = new Uint8Array(bytes);
      expect(decodeBase64Url(encodeBase64Url(data))).toEqual(data);
    }
  });

  it('base64url以外の文字を拒否する', () => {
    expect(() => decodeBase64Url('abc+')).toThrow('使えない文字');
    expect(() => decodeBase64Url('abc=')).toThrow('使えない文字');
    expect(() => decodeBase64Url('あいう')).toThrow('使えない文字');
  });

  it('不正な長さを拒否する', () => {
    expect(() => decodeBase64Url('abcde')).toThrow('不正な長さ');
  });

  it('不正なUTF-8列のテキスト化を拒否する', () => {
    const broken = encodeBase64Url(new Uint8Array([0xff, 0xfe]));
    expect(() => decodeBase64UrlToText(broken)).toThrow();
  });
});
