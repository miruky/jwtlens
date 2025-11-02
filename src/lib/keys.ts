// JWSアルゴリズム名からWebCryptoのパラメータへの対応と、鍵入力の解釈

export interface AlgorithmInfo {
  kind: 'hmac' | 'rsa' | 'ec';
  importParams: HmacImportParams | RsaHashedImportParams | EcKeyImportParams;
  verifyParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
}

const HASHES: Record<string, string> = { '256': 'SHA-256', '384': 'SHA-384', '512': 'SHA-512' };
const CURVES: Record<string, string> = { '256': 'P-256', '384': 'P-384', '512': 'P-521' };

export function algorithmInfo(alg: string): AlgorithmInfo | null {
  const match = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg);
  if (!match) return null;
  const [, family, bits] = match as unknown as [string, string, string];
  const hash = HASHES[bits]!;
  switch (family) {
    case 'HS':
      return {
        kind: 'hmac',
        importParams: { name: 'HMAC', hash },
        verifyParams: { name: 'HMAC' },
      };
    case 'RS':
      return {
        kind: 'rsa',
        importParams: { name: 'RSASSA-PKCS1-v1_5', hash },
        verifyParams: { name: 'RSASSA-PKCS1-v1_5' },
      };
    case 'PS':
      return {
        kind: 'rsa',
        importParams: { name: 'RSA-PSS', hash },
        // RFC 7518はソルト長をハッシュ長と同じに定める
        verifyParams: { name: 'RSA-PSS', saltLength: Number(bits) / 8 },
      };
    case 'ES':
      return {
        kind: 'ec',
        importParams: { name: 'ECDSA', namedCurve: CURVES[bits]! },
        verifyParams: { name: 'ECDSA', hash },
      };
    default:
      return null;
  }
}

// algの対応状況。none は署名のない非セキュアトークン(検証する署名が無い)、
// unsupported は当ツールが扱わない署名方式。supported は検証できる。
export type AlgStatus = 'none' | 'supported' | 'unsupported';

export function algorithmStatus(alg: string | undefined): AlgStatus {
  if (typeof alg === 'string' && alg.toLowerCase() === 'none') return 'none';
  return alg && algorithmInfo(alg) ? 'supported' : 'unsupported';
}

export interface AlgorithmDescription {
  alg: string;
  // 署名方式の通称
  family: 'HMAC' | 'RSA PKCS#1 v1.5' | 'RSA-PSS' | 'ECDSA';
  hash: string;
  kind: 'hmac' | 'rsa' | 'ec';
  // 検証時に鍵欄へ貼るもの
  keyNeeded: 'secret' | 'public';
  // 一行の日本語解説
  summary: string;
}

const FAMILY_SUMMARY: Record<AlgorithmInfo['kind'], (hash: string) => string> = {
  hmac: (hash) => `共通鍵(HMAC-${hash})。発行と検証で同じシークレットを使う対称署名`,
  rsa: (hash) => `RSA公開鍵署名(${hash})。秘密鍵で署名し、公開鍵で検証する`,
  ec: (hash) => `楕円曲線署名(ECDSA, ${hash})。RSAより短い鍵で同等の強度`,
};

// alg名を、UIで提示できる人間向けの説明に展開する。未知のalgはnull。
export function describeAlgorithm(alg: string): AlgorithmDescription | null {
  const info = algorithmInfo(alg);
  if (!info) return null;
  const match = /^(HS|RS|PS|ES)(256|384|512)$/.exec(alg)!;
  const bits = match[2]!;
  const hash = HASHES[bits]!;
  const family =
    info.kind === 'hmac'
      ? 'HMAC'
      : info.kind === 'ec'
        ? 'ECDSA'
        : alg.startsWith('PS')
          ? 'RSA-PSS'
          : 'RSA PKCS#1 v1.5';
  return {
    alg,
    family,
    hash,
    kind: info.kind,
    keyNeeded: info.kind === 'hmac' ? 'secret' : 'public',
    summary: FAMILY_SUMMARY[info.kind](hash),
  };
}

export type KeyInput =
  | { kind: 'secret'; text: string }
  | { kind: 'pem'; spki: Uint8Array }
  | { kind: 'jwk'; jwk: JsonWebKey };

export class KeyError extends Error {}

// 鍵入力欄のテキストを判別する。PEM・JWK・それ以外(HMACシークレット)
export function parseKeyInput(text: string): KeyInput {
  const trimmed = text.trim();
  if (trimmed === '') throw new KeyError('鍵が空');

  if (trimmed.includes('-----BEGIN')) {
    if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(trimmed)) {
      throw new KeyError('秘密鍵が貼られている。検証に必要なのは公開鍵だけ。秘密鍵は共有しない');
    }
    if (trimmed.includes('-----BEGIN RSA PUBLIC KEY-----')) {
      throw new KeyError(
        'PKCS#1形式(BEGIN RSA PUBLIC KEY)は未対応。SPKI形式(BEGIN PUBLIC KEY)に変換して貼る',
      );
    }
    if (trimmed.includes('-----BEGIN CERTIFICATE-----')) {
      throw new KeyError('証明書は未対応。openssl x509 -pubkey -noout で公開鍵を取り出して貼る');
    }
    const match = /-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/.exec(trimmed);
    if (!match) throw new KeyError('PEMの形式が崩れている(BEGIN/ENDの対応を確認)');
    const base64 = match[1]!.replace(/\s+/g, '');
    let binary: string;
    try {
      binary = atob(base64);
    } catch {
      throw new KeyError('PEM本体がbase64として読めない');
    }
    const spki = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) spki[i] = binary.charCodeAt(i);
    return { kind: 'pem', spki };
  }

  if (trimmed.startsWith('{')) {
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new KeyError('JWKがJSONとして読めない');
    }
    if (typeof value !== 'object' || value === null) throw new KeyError('JWKがオブジェクトでない');
    const jwk = value as JsonWebKey & { keys?: unknown };
    // JWK Set(keys配列)なら先頭の鍵を使う
    if (Array.isArray(jwk.keys)) {
      const first: unknown = jwk.keys[0];
      if (typeof first !== 'object' || first === null) {
        throw new KeyError('JWK Setに鍵が入っていない');
      }
      return { kind: 'jwk', jwk: first as JsonWebKey };
    }
    if (typeof jwk.kty !== 'string') throw new KeyError('JWKにktyがない');
    return { kind: 'jwk', jwk };
  }

  return { kind: 'secret', text: trimmed };
}
