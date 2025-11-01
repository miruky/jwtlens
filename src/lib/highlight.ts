// 整形済みJSON文字列を意味単位に分け、構文ハイライト用のトークン列にする。
// 入力は JSON.stringify(value, null, 2) の出力を想定し、DOMはトークンから組み立てる
// (innerHTMLを使わないのでエスケープ漏れが起きない)。

export type JsonTokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct';

export interface JsonToken {
  text: string;
  type: JsonTokenType;
}

const STRING = '"(?:[^"\\\\]|\\\\.)*"';
const NUMBER = '-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';
const KEYWORD = 'true|false|null';
// 文字列・数値・キーワードのいずれか。残りは1文字ずつ punct として通す。
const TOKEN = new RegExp(`(${STRING})|(${NUMBER})|(${KEYWORD})|([\\s\\S])`, 'g');

export function tokenizeJson(pretty: string): JsonToken[] {
  const raw: JsonToken[] = [];
  for (const m of pretty.matchAll(TOKEN)) {
    if (m[1] !== undefined) raw.push({ text: m[1], type: 'string' });
    else if (m[2] !== undefined) raw.push({ text: m[2], type: 'number' });
    else if (m[3] !== undefined)
      raw.push({ text: m[3], type: m[3] === 'null' ? 'null' : 'boolean' });
    else raw.push({ text: m[4]!, type: 'punct' });
  }

  // 文字列のうち、直後の非空白が ':' のものはキーとして色を分ける。
  const tokens = mergePunct(raw);
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.type !== 'string') continue;
    const next = tokens[i + 1]?.text ?? '';
    if (next.trimStart().startsWith(':')) tokens[i]!.type = 'key';
  }
  return tokens;
}

// 連続する punct(空白や記号)を1つにまとめ、DOMノード数を抑える。
function mergePunct(tokens: JsonToken[]): JsonToken[] {
  const out: JsonToken[] = [];
  for (const token of tokens) {
    const last = out[out.length - 1];
    if (token.type === 'punct' && last?.type === 'punct') last.text += token.text;
    else out.push({ ...token });
  }
  return out;
}
