import { decodeBase64Url, decodeBase64UrlToText } from './base64url';

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: Uint8Array;
  // 署名対象となる「ヘッダ.ペイロード」の生文字列。検証はこのバイト列に対して行う
  signingInput: string;
  raw: { header: string; payload: string; signature: string };
}

export class JwtError extends Error {}

function parseJsonObject(text: string, segment: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new JwtError(`${segment}がJSONとして読めない`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new JwtError(`${segment}がJSONオブジェクトではない`);
  }
  return value as Record<string, unknown>;
}

export function parseJwt(token: string): DecodedJwt {
  const trimmed = token.trim().replace(/^Bearer\s+/i, '');
  if (trimmed === '') throw new JwtError('トークンが空');

  const parts = trimmed.split('.');
  if (parts.length === 5) {
    throw new JwtError('5セグメントはJWE(暗号化トークン)。このツールはJWS(署名トークン)専用');
  }
  if (parts.length !== 3) {
    throw new JwtError(`セグメント数が${parts.length}個。JWTは「ヘッダ.ペイロード.署名」の3個`);
  }
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  let headerText: string;
  try {
    headerText = decodeBase64UrlToText(headerPart);
  } catch (cause) {
    throw new JwtError(`ヘッダをデコードできない: ${(cause as Error).message}`);
  }
  const header = parseJsonObject(headerText, 'ヘッダ');

  let payloadText: string;
  try {
    payloadText = decodeBase64UrlToText(payloadPart);
  } catch (cause) {
    throw new JwtError(`ペイロードをデコードできない: ${(cause as Error).message}`);
  }
  const payload = parseJsonObject(payloadText, 'ペイロード');

  let signature: Uint8Array;
  try {
    signature = decodeBase64Url(signaturePart);
  } catch (cause) {
    throw new JwtError(`署名をデコードできない: ${(cause as Error).message}`);
  }

  return {
    header,
    payload,
    signature,
    signingInput: `${headerPart}.${payloadPart}`,
    raw: { header: headerPart, payload: payloadPart, signature: signaturePart },
  };
}
