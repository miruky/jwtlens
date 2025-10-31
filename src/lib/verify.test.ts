import { describe, expect, it } from 'vitest';
import { encodeBase64Url } from './base64url';
import { parseJwt } from './jwt';
import { signHs256, verifyJwt } from './verify';

const ENCODER = new TextEncoder();

// 公開鍵をPEM(SPKI)に書き出す。テスト内でWebCryptoの実鍵を使った往復を行う
async function publicKeyToPem(key: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', key));
  let binary = '';
  for (const byte of spki) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/(.{64})/g, '$1\n');
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

async function signToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  params: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
  privateKey: CryptoKey,
): Promise<string> {
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload),
  )}`;
  const signature = await crypto.subtle.sign(params, privateKey, ENCODER.encode(signingInput));
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

describe('verifyJwt: HS256', () => {
  it('正しいシークレットで検証が通る', async () => {
    const token = await signHs256({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-1' }, 'top-secret');
    const result = await verifyJwt(parseJwt(token), 'top-secret');
    expect(result.ok).toBe(true);
  });

  it('シークレット違いを検出する', async () => {
    const token = await signHs256({ alg: 'HS256' }, { sub: 'user-1' }, 'top-secret');
    const result = await verifyJwt(parseJwt(token), 'wrong-secret');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('一致しない');
  });

  it('ペイロード改ざんを検出する', async () => {
    const token = await signHs256({ alg: 'HS256' }, { role: 'user' }, 'top-secret');
    const [h, , s] = token.split('.') as [string, string, string];
    const forged = `${h}.${encodeBase64Url(JSON.stringify({ role: 'admin' }))}.${s}`;
    const result = await verifyJwt(parseJwt(forged), 'top-secret');
    expect(result.ok).toBe(false);
  });

  it('HS系に公開鍵を貼った場合は使い方を案内する', async () => {
    const token = await signHs256({ alg: 'HS256' }, { sub: 'a' }, 'secret');
    const pem = '-----BEGIN PUBLIC KEY-----\nAAEC\n-----END PUBLIC KEY-----';
    const result = await verifyJwt(parseJwt(token), pem);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('シークレット');
  });
});

describe('verifyJwt: RS256', () => {
  it('PEM公開鍵で検証が通り、別鍵では落ちる', async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const token = await signToken(
      { alg: 'RS256', typ: 'JWT' },
      { sub: 'user-1' },
      { name: 'RSASSA-PKCS1-v1_5' },
      pair.privateKey,
    );
    const pem = await publicKeyToPem(pair.publicKey);
    expect((await verifyJwt(parseJwt(token), pem)).ok).toBe(true);

    const other = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const otherPem = await publicKeyToPem(other.publicKey);
    expect((await verifyJwt(parseJwt(token), otherPem)).ok).toBe(false);
  });
});

describe('verifyJwt: ES256', () => {
  it('JWK公開鍵で検証が通る', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    const token = await signToken(
      { alg: 'ES256' },
      { sub: 'user-1' },
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
    );
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const result = await verifyJwt(parseJwt(token), JSON.stringify(jwk));
    expect(result.ok).toBe(true);
  });
});

describe('verifyJwt: 異常系', () => {
  it('alg=noneは検証不能として警告する', async () => {
    const token = `${encodeBase64Url(JSON.stringify({ alg: 'none' }))}.${encodeBase64Url(
      JSON.stringify({ sub: 'a' }),
    )}.`;
    const result = await verifyJwt(parseJwt(token), 'any');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('none');
  });

  it('未対応アルゴリズムを明示する', async () => {
    const token = `${encodeBase64Url(JSON.stringify({ alg: 'EdDSA' }))}.${encodeBase64Url(
      JSON.stringify({ sub: 'a' }),
    )}.${encodeBase64Url('sig')}`;
    const result = await verifyJwt(parseJwt(token), 'any');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('未対応');
  });

  it('RS系にシークレットを貼った場合は公開鍵を求める', async () => {
    const token = `${encodeBase64Url(JSON.stringify({ alg: 'RS256' }))}.${encodeBase64Url(
      JSON.stringify({ sub: 'a' }),
    )}.${encodeBase64Url('sig')}`;
    const result = await verifyJwt(parseJwt(token), 'shared-secret');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('公開鍵');
  });
});
