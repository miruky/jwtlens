// トークンの有効期間を1本の帯として描くための区間計算。
// 開始は nbf(なければ iat)、終了は exp。現在位置 ratio は 0..1 に収める。
// exp が無い、または開始時刻が無いトークンは帯にできないため null を返す。

export interface Lifetime {
  startS: number;
  endS: number;
  // 開始が nbf 由来なら 'nbf'、iat 由来なら 'iat'。
  startKey: 'iat' | 'nbf';
  totalS: number;
  remainingS: number;
  // 現在位置(0=開始, 1=終了)。範囲外はクランプする。
  ratio: number;
  expired: boolean;
  notYet: boolean;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function lifetime(payload: Record<string, unknown>, nowS: number): Lifetime | null {
  const exp = num(payload['exp']);
  if (exp === null) return null;

  const nbf = num(payload['nbf']);
  const iat = num(payload['iat']);
  const start = nbf ?? iat;
  if (start === null) return null;
  // 開始が終了以降だと帯にならない(壊れたトークン)。
  if (start >= exp) return null;

  const total = exp - start;
  const ratio = Math.min(1, Math.max(0, (nowS - start) / total));
  return {
    startS: start,
    endS: exp,
    startKey: nbf !== null ? 'nbf' : 'iat',
    totalS: total,
    remainingS: exp - nowS,
    ratio,
    expired: nowS >= exp,
    notYet: nowS < start,
  };
}
