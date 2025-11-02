import { describe, expect, it } from 'vitest';
import {
  algorithmInfo,
  algorithmStatus,
  describeAlgorithm,
  KeyError,
  parseKeyInput,
} from './keys';

describe('algorithmInfo', () => {
  it('HS256はHMAC+SHA-256', () => {
    const info = algorithmInfo('HS256');
    expect(info?.kind).toBe('hmac');
    expect(info?.importParams).toEqual({ name: 'HMAC', hash: 'SHA-256' });
  });

  it('PS384はソルト長48のRSA-PSS', () => {
    const info = algorithmInfo('PS384');
    expect(info?.verifyParams).toEqual({ name: 'RSA-PSS', saltLength: 48 });
  });

  it('ES512はP-521曲線', () => {
    const info = algorithmInfo('ES512');
    expect(info?.importParams).toEqual({ name: 'ECDSA', namedCurve: 'P-521' });
  });

  it('未対応アルゴリズムはnull', () => {
    expect(algorithmInfo('none')).toBeNull();
    expect(algorithmInfo('HS128')).toBeNull();
    expect(algorithmInfo('EdDSA')).toBeNull();
  });
});

describe('describeAlgorithm', () => {
  it('HS256は共通鍵で、シークレットを要求する', () => {
    const d = describeAlgorithm('HS256');
    expect(d?.family).toBe('HMAC');
    expect(d?.hash).toBe('SHA-256');
    expect(d?.keyNeeded).toBe('secret');
  });

  it('RS/PS/ESは公開鍵を要求し、系統を区別する', () => {
    expect(describeAlgorithm('RS256')?.family).toBe('RSA PKCS#1 v1.5');
    expect(describeAlgorithm('PS512')?.family).toBe('RSA-PSS');
    expect(describeAlgorithm('ES384')?.family).toBe('ECDSA');
    expect(describeAlgorithm('ES384')?.keyNeeded).toBe('public');
  });

  it('未対応アルゴリズムはnull', () => {
    expect(describeAlgorithm('none')).toBeNull();
    expect(describeAlgorithm('EdDSA')).toBeNull();
  });
});

describe('algorithmStatus', () => {
  it('noneは大小によらず none と判定する', () => {
    expect(algorithmStatus('none')).toBe('none');
    expect(algorithmStatus('None')).toBe('none');
    expect(algorithmStatus('NONE')).toBe('none');
  });

  it('対応する署名方式は supported', () => {
    expect(algorithmStatus('HS256')).toBe('supported');
    expect(algorithmStatus('RS512')).toBe('supported');
    expect(algorithmStatus('ES256')).toBe('supported');
  });

  it('未対応・未指定は unsupported', () => {
    expect(algorithmStatus('EdDSA')).toBe('unsupported');
    expect(algorithmStatus('HS128')).toBe('unsupported');
    expect(algorithmStatus(undefined)).toBe('unsupported');
  });
});

describe('parseKeyInput', () => {
  it('PEM公開鍵をSPKIバイト列に起こす', () => {
    // 中身はダミーのbase64(構文の検証のみ。鍵としての妥当性はWebCrypto側が見る)
    const pem = '-----BEGIN PUBLIC KEY-----\nAAEC\nAwQF\n-----END PUBLIC KEY-----';
    const parsed = parseKeyInput(pem);
    expect(parsed.kind).toBe('pem');
    if (parsed.kind === 'pem') {
      expect(parsed.spki).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5]));
    }
  });

  it('JWKをそのまま受け取る', () => {
    const parsed = parseKeyInput('{"kty":"oct","k":"c2VjcmV0"}');
    expect(parsed.kind).toBe('jwk');
  });

  it('JWK Setは先頭の鍵を使う', () => {
    const parsed = parseKeyInput('{"keys":[{"kty":"RSA","n":"abc","e":"AQAB"}]}');
    expect(parsed.kind).toBe('jwk');
    if (parsed.kind === 'jwk') expect(parsed.jwk.kty).toBe('RSA');
  });

  it('PEMでもJWKでもなければHMACシークレット扱い', () => {
    const parsed = parseKeyInput('my-shared-secret');
    expect(parsed).toEqual({ kind: 'secret', text: 'my-shared-secret' });
  });

  it('秘密鍵の貼り付けを拒否して注意を促す', () => {
    expect(() =>
      parseKeyInput('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'),
    ).toThrow('秘密鍵');
  });

  it('PKCS#1と証明書は変換方法を案内する', () => {
    expect(() =>
      parseKeyInput('-----BEGIN RSA PUBLIC KEY-----\nAAAA\n-----END RSA PUBLIC KEY-----'),
    ).toThrow('SPKI');
    expect(() =>
      parseKeyInput('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'),
    ).toThrow('openssl');
  });

  it('空入力と壊れたPEMを拒否する', () => {
    expect(() => parseKeyInput('  ')).toThrow(KeyError);
    expect(() => parseKeyInput('-----BEGIN PUBLIC KEY-----')).toThrow('崩れている');
  });
});
