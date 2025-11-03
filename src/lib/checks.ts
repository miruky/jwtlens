// トークンを読み解くうえで気をつけたい点を、ヘッダ・ペイロードから機械的に拾う。
// 失効や時刻の異常といった安全性に関わる観察を、重大度つきで列挙する。
// 表示順は重大度の高い順。問題が無ければ ok を1件だけ返す。

export type Severity = 'danger' | 'warn' | 'info' | 'ok';

export interface Check {
  severity: Severity;
  title: string;
  detail: string;
}

// 既定で「長すぎる」とみなす有効期間(24時間)。短命なアクセストークンが望ましい。
const LONG_LIFETIME_S = 24 * 3600;
const RANK: Record<Severity, number> = { danger: 0, warn: 1, info: 2, ok: 3 };

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// 秒数を「2日3時間」「45分」のように上位2単位で表す(符号なしの長さ)。
function humanizeDuration(totalS: number): string {
  let rest = Math.max(0, Math.round(totalS));
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
  return parts.join('') || '0秒';
}

export function securityChecks(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  nowS: number,
): Check[] {
  const checks: Check[] = [];
  const alg = typeof header['alg'] === 'string' ? (header['alg'] as string) : undefined;

  if (alg && alg.toLowerCase() === 'none') {
    checks.push({
      severity: 'danger',
      title: 'alg=none(署名なし)',
      detail:
        '署名が無く、改ざんを検出できません。alg=none を受け入れる実装は署名検証を回避され得る重大な脆弱性です。',
    });
  } else if (alg && alg.startsWith('HS')) {
    checks.push({
      severity: 'info',
      title: '対称鍵アルゴリズム(HS系)',
      detail:
        '署名と検証で同じシークレットを使います。検証側にも秘密の共有が必要で、公開鍵方式より鍵の管理範囲が広がります。',
    });
  }

  const exp = num(payload['exp']);
  const nbf = num(payload['nbf']);
  const iat = num(payload['iat']);

  if (exp === null) {
    if (alg?.toLowerCase() !== 'none') {
      checks.push({
        severity: 'warn',
        title: 'exp(失効時刻)がない',
        detail: '失効時刻が無く、無期限に有効なトークンです。漏洩したときの被害が大きくなります。',
      });
    }
  } else if (exp <= nowS) {
    checks.push({
      severity: 'danger',
      title: '失効済み',
      detail: `失効時刻を ${humanizeDuration(nowS - exp)} 過ぎています。`,
    });
  } else {
    const start = nbf ?? iat;
    if (start !== null && exp - start > LONG_LIFETIME_S) {
      checks.push({
        severity: 'warn',
        title: '有効期間が長い',
        detail: `発行から失効まで ${humanizeDuration(exp - start)} あります。アクセストークンは短命が推奨されます。`,
      });
    }
  }

  if (iat !== null && iat > nowS + 60) {
    checks.push({
      severity: 'warn',
      title: '発行時刻(iat)が未来',
      detail: '発行時刻が現在より先です。時計のずれか、改ざんの疑いがあります。',
    });
  }

  if (nbf !== null && nbf > nowS) {
    checks.push({
      severity: 'info',
      title: 'まだ有効になっていない',
      detail: `有効開始(nbf)まで ${humanizeDuration(nbf - nowS)} あります。`,
    });
  }

  if (checks.length === 0) {
    checks.push({
      severity: 'ok',
      title: '目立った問題は見つかりませんでした',
      detail: '失効・時刻・署名方式の観点で、注意すべき点は検出されませんでした。',
    });
  }

  return checks.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
