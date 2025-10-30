// 登録済みクレーム(RFC 7519)とOIDC等でよく使われるクレームの解釈

export interface ClaimView {
  key: string;
  value: unknown;
  label: string | null;
  note: string | null;
  warn: boolean;
}

export type TokenState = 'valid' | 'expired' | 'not-yet' | 'no-exp';

export interface TokenTimeStatus {
  state: TokenState;
  detail: string;
}

const KNOWN_CLAIMS: Record<string, string> = {
  iss: '発行者',
  sub: '主体(ユーザー識別子)',
  aud: '想定受信者',
  exp: '失効時刻',
  nbf: '有効開始時刻',
  iat: '発行時刻',
  jti: 'トークンID',
  name: '表示名',
  email: 'メールアドレス',
  email_verified: 'メール確認済みか',
  scope: 'スコープ',
  azp: '認可された提示者',
  nonce: 'リプレイ防止ナンス',
  auth_time: '認証時刻',
  sid: 'セッションID',
  client_id: 'クライアントID',
  token_use: 'トークン用途',
  roles: 'ロール',
  groups: '所属グループ',
};

const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time']);

// "3時間12分後" / "2日前" のような相対表記。上位2単位までに丸める
export function relativeTime(epochS: number, nowS: number): string {
  const diff = Math.round(epochS - nowS);
  if (diff === 0) return 'ちょうど今';
  const suffix = diff > 0 ? '後' : '前';
  let rest = Math.abs(diff);
  const units: Array<[number, string]> = [
    [86400, '日'],
    [3600, '時間'],
    [60, '分'],
    [1, '秒'],
  ];
  const parts: string[] = [];
  for (const [seconds, label] of units) {
    const amount = Math.floor(rest / seconds);
    if (amount > 0) {
      parts.push(`${amount}${label}`);
      rest -= amount * seconds;
    }
    if (parts.length === 2) break;
  }
  return `${parts.join('')}${suffix}`;
}

export function formatEpoch(epochS: number): string {
  const date = new Date(epochS * 1000);
  if (Number.isNaN(date.getTime())) return '(不正な時刻)';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function timeNote(key: string, epochS: number, nowS: number): { note: string; warn: boolean } {
  const base = `${formatEpoch(epochS)}(${relativeTime(epochS, nowS)})`;
  if (key === 'exp' && epochS <= nowS) return { note: `${base} 失効済み`, warn: true };
  if (key === 'nbf' && epochS > nowS) return { note: `${base} まだ有効でない`, warn: true };
  if (key === 'iat' && epochS > nowS + 60) {
    return { note: `${base} 発行時刻が未来。時計ずれか改ざんの疑い`, warn: true };
  }
  return { note: base, warn: false };
}

export function claimViews(payload: Record<string, unknown>, nowS: number): ClaimView[] {
  return Object.entries(payload).map(([key, value]) => {
    const label = KNOWN_CLAIMS[key] ?? null;
    if (TIME_CLAIMS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
      const { note, warn } = timeNote(key, value, nowS);
      return { key, value, label, note, warn };
    }
    return { key, value, label, note: null, warn: false };
  });
}

export function tokenTimeStatus(payload: Record<string, unknown>, nowS: number): TokenTimeStatus {
  const nbf = payload['nbf'];
  if (typeof nbf === 'number' && nbf > nowS) {
    return { state: 'not-yet', detail: `有効開始前。${relativeTime(nbf, nowS)}に有効になる` };
  }
  const exp = payload['exp'];
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return { state: 'no-exp', detail: 'expクレームがなく、失効しないトークン' };
  }
  if (exp <= nowS) {
    return { state: 'expired', detail: `${relativeTime(exp, nowS)}に失効した` };
  }
  return { state: 'valid', detail: `${relativeTime(exp, nowS)}に失効する` };
}
