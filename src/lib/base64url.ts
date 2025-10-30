// RFC 7515のbase64url。JWTの各セグメントはパディングなしで運ばれるため、
// デコード時に補い、エンコード時に取り除く

const ENCODER = new TextEncoder();
// fatal: 不正なUTF-8列を黙って置換せず例外にする
const DECODER = new TextDecoder('utf-8', { fatal: true });

export function decodeBase64Url(input: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) {
    throw new Error('base64urlに使えない文字が含まれている');
  }
  if (input.length % 4 === 1) {
    throw new Error('base64urlとして不正な長さ');
  }
  const base64 = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeBase64UrlToText(input: string): string {
  return DECODER.decode(decodeBase64Url(input));
}

export function encodeBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? ENCODER.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
