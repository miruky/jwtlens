// WebCryptoによる署名検証。鍵も署名対象もブラウザの外に出ない

import { encodeBase64Url } from './base64url';
import type { DecodedJwt } from './jwt';
import { algorithmInfo, KeyError, parseKeyInput } from './keys';

export interface VerifyResult {
  ok: boolean;
  message: string;
}

const ENCODER = new TextEncoder();

async function importKeyFor(
  algName: string,
  keyText: string,
): Promise<{ key: CryptoKey; verifyParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams }> {
  const info = algorithmInfo(algName);
  if (!info) throw new KeyError(`alg「${algName}」は未対応(対応: HS/RS/PS/ES の 256/384/512)`);
  const input = parseKeyInput(keyText);

  if (info.kind === 'hmac') {
    if (input.kind === 'pem') {
      throw new KeyError('HS系は共有シークレットで検証する。公開鍵ではなくシークレットを貼る');
    }
    const material =
      input.kind === 'jwk'
        ? await crypto.subtle.importKey('jwk', input.jwk, info.importParams, false, ['verify'])
        : await crypto.subtle.importKey(
            'raw',
            ENCODER.encode(input.text),
            info.importParams,
            false,
            ['verify'],
          );
    return { key: material, verifyParams: info.verifyParams };
  }

  if (input.kind === 'secret') {
    throw new KeyError(`alg「${algName}」の検証には公開鍵(PEMまたはJWK)を貼る`);
  }
  const key =
    input.kind === 'pem'
      ? await crypto.subtle.importKey(
          'spki',
          input.spki as BufferSource,
          info.importParams,
          false,
          ['verify'],
        )
      : await crypto.subtle.importKey('jwk', input.jwk, info.importParams, false, ['verify']);
  return { key, verifyParams: info.verifyParams };
}

export async function verifyJwt(decoded: DecodedJwt, keyText: string): Promise<VerifyResult> {
  const alg = decoded.header['alg'];
  if (alg === 'none' || alg === undefined) {
    return {
      ok: false,
      message: 'alg=none(署名なし)。検証のしようがなく、受け入れてはいけないトークン',
    };
  }
  if (typeof alg !== 'string') {
    return { ok: false, message: 'ヘッダのalgが文字列でない' };
  }

  let imported: Awaited<ReturnType<typeof importKeyFor>>;
  try {
    imported = await importKeyFor(alg, keyText);
  } catch (cause) {
    if (cause instanceof KeyError) return { ok: false, message: cause.message };
    return { ok: false, message: `鍵の読み込みに失敗: ${(cause as Error).message}` };
  }

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      imported.verifyParams,
      imported.key,
      decoded.signature as BufferSource,
      ENCODER.encode(decoded.signingInput),
    );
  } catch (cause) {
    return { ok: false, message: `検証処理に失敗: ${(cause as Error).message}` };
  }

  return valid
    ? { ok: true, message: `署名は有効(${alg})。この鍵で署名されたまま改ざんされていない` }
    : { ok: false, message: '署名が一致しない。鍵違いか、トークンが改ざんされている' };
}

// HS256でサンプルトークンを作る。動作確認用で、UIの「サンプル生成」とテストが使う
export async function signHs256(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload),
  )}`;
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, ENCODER.encode(signingInput));
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}
