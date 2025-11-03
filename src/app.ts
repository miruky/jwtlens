import { COPY_ICON, CHECK_ICON, EMPTY_ICON, LENS_MARK, STATE_ICONS, THEME_ICONS } from './icons';
import { claimViews, formatEpoch, tokenTimeStatus, type TokenState } from './lib/claims';
import { tokenizeJson } from './lib/highlight';
import { JwtError, parseJwt, type DecodedJwt } from './lib/jwt';
import { algorithmStatus, describeAlgorithm } from './lib/keys';
import { lifetime } from './lib/lifetime';
import { signHs256, verifyJwt } from './lib/verify';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL, type ThemeMode } from './theme';

const SAMPLE_SECRET = 'jwtlens-demo-secret';

// 失効状態ごとの短い見出しと、判定行の色・アイコンの対応。
const VERDICT: Record<TokenState, { head: string; cls: string; icon: string }> = {
  valid: { head: '有効期間内のトークン', cls: 'is-ok', icon: STATE_ICONS.ok },
  expired: { head: '失効済みのトークン', cls: 'is-danger', icon: STATE_ICONS.warn },
  'not-yet': { head: 'まだ有効になっていない', cls: 'is-accent', icon: STATE_ICONS.clock },
  'no-exp': { head: '失効しないトークン', cls: 'is-accent', icon: STATE_ICONS.info },
};

export class App {
  private decoded: DecodedJwt | null = null;
  private lastState: TokenState | null = null;
  private tickTimer: number | null = null;
  private theme: ThemeMode = loadTheme();
  private readonly el: Record<string, HTMLElement> = {};

  constructor(private readonly root: HTMLElement) {
    applyTheme(this.theme);
    this.render();
    this.wire();
  }

  private render(): void {
    this.root.innerHTML = `
      <a class="skip-link" href="#main">本文へスキップ</a>
      <header class="site-header">
        <div class="header-inner">
          <span class="brand">
            <span class="brand-mark">${LENS_MARK}</span>
            <span class="brand-name">jwt<b>lens</b></span>
          </span>
          <p class="brand-tag">トークンも鍵も送信しない、ブラウザ内のJWT検査盤</p>
          <button type="button" class="theme-toggle" data-id="theme"></button>
        </div>
      </header>
      <main id="main" class="shell" tabindex="-1">
        <section class="block block-token" aria-labelledby="k-token">
          <div class="block-head">
            <span class="kicker" id="k-token">Token</span>
            <button type="button" class="ghost-btn" data-id="sample">HS256サンプルを生成</button>
          </div>
          <label class="sr-only" for="token">JWTを貼り付ける</label>
          <textarea id="token" data-id="token" class="token-input" rows="6" spellcheck="false"
            autocapitalize="off" autocomplete="off"
            placeholder="eyJhbGciOi... をここに貼る(Bearer 接頭辞ごとでも可)"></textarea>
          <p class="parse-error" data-id="parse-error" role="alert" hidden></p>
          <div class="token-colored" data-id="colored" hidden>
            <button type="button" class="icon-btn copy-floating" data-id="copy-token"
              aria-label="トークンをコピー">${COPY_ICON}</button>
            <span data-id="colored-body"></span>
          </div>
        </section>

        <div class="verdict" data-id="verdict" hidden>
          <span class="verdict-icon" data-id="verdict-icon"></span>
          <span class="verdict-text">
            <span class="verdict-head" data-id="verdict-head" aria-live="polite"></span>
            <span class="verdict-detail" data-id="verdict-detail"></span>
          </span>
        </div>

        <div class="lifetime" data-id="lifetime" hidden>
          <div class="life-track" role="img" data-id="life-track">
            <span class="life-fill" data-id="life-fill"></span>
            <span class="life-now" data-id="life-now"></span>
          </div>
          <div class="life-legend">
            <span class="life-start" data-id="life-start"></span>
            <span class="life-remain" data-id="life-remain"></span>
            <span class="life-end" data-id="life-end"></span>
          </div>
        </div>

        <section class="block block-body" data-id="body" hidden aria-labelledby="k-header">
          <div class="panes">
            <div class="pane">
              <div class="pane-head">
                <span class="kicker" id="k-header">Header</span>
                <button type="button" class="icon-btn" data-id="copy-header">${COPY_ICON}<span>コピー</span></button>
              </div>
              <pre class="json-view" data-id="header"></pre>
            </div>
            <div class="pane">
              <div class="pane-head">
                <span class="kicker">Payload</span>
                <button type="button" class="icon-btn" data-id="copy-payload">${COPY_ICON}<span>コピー</span></button>
              </div>
              <pre class="json-view" data-id="payload"></pre>
            </div>
          </div>
        </section>

        <section class="block block-claims" data-id="claims-block" hidden aria-labelledby="k-claims">
          <div class="block-head"><span class="kicker" id="k-claims">Claims</span></div>
          <div data-id="claims"></div>
        </section>

        <section class="block block-empty" data-id="empty">
          <div class="empty-state">
            <span class="empty-state-art">${EMPTY_ICON}</span>
            <p class="empty-state-text">JWTを貼り付けると、ヘッダとペイロードを色分けし、登録済みクレームを日本語の解釈つきで読み解きます。すべての処理はこの画面の中だけで完結します。</p>
          </div>
        </section>

        <section class="block block-verify" aria-labelledby="k-verify">
          <div class="block-head"><span class="kicker" id="k-verify">Signature</span></div>
          <div class="alg-card" data-id="alg" hidden></div>
          <p class="hint" data-id="verify-hint">トークンを貼ると、algに応じて必要な鍵を案内します。</p>
          <label class="sr-only" for="key">検証用の鍵</label>
          <textarea id="key" data-id="key" class="key-input" rows="4" spellcheck="false"
            autocapitalize="off" autocomplete="off"
            placeholder="HS系: 共有シークレット / RS・PS・ES系: 公開鍵(PEMまたはJWK)"></textarea>
          <button type="button" class="primary-btn" data-id="verify" disabled>署名を検証</button>
          <div class="verify-result" data-id="verify-result" role="status" aria-live="polite" hidden></div>
        </section>
      </main>
      <footer class="site-footer">
        <div class="footer-inner">
          <p>対応: HS / RS / PS / ES の 256・384・512。JWE(暗号化トークン)とEdDSAは未対応。</p>
          <p><a href="https://github.com/miruky/jwtlens">ソースコード</a></p>
        </div>
      </footer>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
    this.updateThemeButton();
  }

  private wire(): void {
    const tokenInput = this.el['token'] as HTMLTextAreaElement;
    tokenInput.addEventListener('input', () => this.decode(tokenInput.value));

    this.el['sample']!.addEventListener('click', () => void this.fillSample(tokenInput));
    this.el['verify']!.addEventListener('click', () => void this.verify());

    this.el['theme']!.addEventListener('click', () => {
      this.theme = nextTheme(this.theme);
      applyTheme(this.theme);
      this.updateThemeButton();
    });

    this.el['copy-token']!.addEventListener('click', (e) =>
      this.copy(e.currentTarget as HTMLElement, this.decoded ? rawToken(this.decoded) : ''),
    );
    this.el['copy-header']!.addEventListener('click', (e) =>
      this.copy(e.currentTarget as HTMLElement, this.el['header']!.textContent ?? ''),
    );
    this.el['copy-payload']!.addEventListener('click', (e) =>
      this.copy(e.currentTarget as HTMLElement, this.el['payload']!.textContent ?? ''),
    );

    // システム配色が変わったとき、自動モードの表示を追従させる。
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme === 'auto') this.updateThemeButton();
    });
  }

  private updateThemeButton(): void {
    const button = this.el['theme']!;
    button.innerHTML = THEME_ICONS[this.theme];
    const label = `テーマ切替(現在: ${THEME_LABEL[this.theme]})`;
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  private async fillSample(tokenInput: HTMLTextAreaElement): Promise<void> {
    const nowS = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'user-1024', name: '山田 太郎', scope: 'read write', iat: nowS, exp: nowS + 3600 },
      SAMPLE_SECRET,
    );
    tokenInput.value = token;
    (this.el['key'] as HTMLTextAreaElement).value = SAMPLE_SECRET;
    this.decode(token);
  }

  private decode(value: string): void {
    const verifyButton = this.el['verify'] as HTMLButtonElement;
    this.el['verify-result']!.hidden = true;

    if (value.trim() === '') {
      this.reset();
      return;
    }

    let decoded: DecodedJwt;
    try {
      decoded = parseJwt(value);
    } catch (cause) {
      this.decoded = null;
      this.stopTick();
      const error = this.el['parse-error']!;
      error.innerHTML = STATE_ICONS.warn;
      error.append(cause instanceof JwtError ? cause.message : '解析に失敗しました');
      error.hidden = false;
      this.el['colored']!.hidden = true;
      this.el['verdict']!.hidden = true;
      this.el['lifetime']!.hidden = true;
      this.el['body']!.hidden = true;
      this.el['claims-block']!.hidden = true;
      this.el['empty']!.hidden = true;
      this.el['alg']!.hidden = true;
      verifyButton.disabled = true;
      return;
    }

    this.decoded = decoded;
    this.el['parse-error']!.hidden = true;
    this.el['empty']!.hidden = true;
    // alg=none は検証する署名を持たないので、検証ボタンを無効にする。
    const algName = typeof decoded.header['alg'] === 'string' ? decoded.header['alg'] : undefined;
    verifyButton.disabled = algorithmStatus(algName) === 'none';
    this.renderColored(decoded);
    this.renderJson(decoded);
    this.renderAlg(decoded);
    this.renderVerifyHint(decoded);
    this.lastState = null;
    this.tick();
    this.startTick();
  }

  private reset(): void {
    this.decoded = null;
    this.stopTick();
    this.el['parse-error']!.hidden = true;
    this.el['colored']!.hidden = true;
    this.el['verdict']!.hidden = true;
    this.el['lifetime']!.hidden = true;
    this.el['body']!.hidden = true;
    this.el['claims-block']!.hidden = true;
    this.el['alg']!.hidden = true;
    this.el['empty']!.hidden = false;
    (this.el['verify'] as HTMLButtonElement).disabled = true;
    this.el['verify-hint']!.textContent = 'トークンを貼ると、algに応じて必要な鍵を案内します。';
  }

  private renderColored(decoded: DecodedJwt): void {
    const body = this.el['colored-body']!;
    this.el['colored']!.hidden = false;
    body.innerHTML = '';
    const segments: Array<[string, string]> = [
      [decoded.raw.header, 'seg-header'],
      [decoded.raw.payload, 'seg-payload'],
      [decoded.raw.signature, 'seg-signature'],
    ];
    segments.forEach(([text, className], index) => {
      if (index > 0) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.textContent = '.';
        body.appendChild(dot);
      }
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      body.appendChild(span);
    });
  }

  private renderJson(decoded: DecodedJwt): void {
    this.el['body']!.hidden = false;
    paintJson(this.el['header']!, decoded.header);
    paintJson(this.el['payload']!, decoded.payload);
  }

  // 失効状態の判定行とクレーム表を、現在時刻に対して描き直す。毎秒呼ばれる。
  private tick(): void {
    if (!this.decoded) return;
    const nowS = Math.floor(Date.now() / 1000);
    const time = tokenTimeStatus(this.decoded.payload, nowS);
    const verdict = this.el['verdict']!;
    verdict.hidden = false;

    if (time.state !== this.lastState) {
      const v = VERDICT[time.state];
      verdict.className = `verdict ${v.cls}`;
      this.el['verdict-icon']!.innerHTML = v.icon;
      this.el['verdict-head']!.textContent = v.head;
      this.lastState = time.state;
    }
    this.el['verdict-detail']!.textContent = time.detail;
    this.renderLifetime(nowS);
    this.renderClaims(nowS);
  }

  // 有効期間を1本の帯で描く。iat/nbf〜exp の区間に対する現在位置を毎秒更新する。
  private renderLifetime(nowS: number): void {
    const box = this.el['lifetime']!;
    const life = this.decoded ? lifetime(this.decoded.payload, nowS) : null;
    if (!life) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle('is-expired', life.expired);
    box.classList.toggle('is-notyet', life.notYet);
    const pct = `${(life.ratio * 100).toFixed(2)}%`;
    (this.el['life-fill'] as HTMLElement).style.width = pct;
    (this.el['life-now'] as HTMLElement).style.left = pct;
    const startLabel = life.startKey === 'nbf' ? '有効開始' : '発行';
    this.el['life-start']!.textContent = `${startLabel} ${formatEpoch(life.startS)}`;
    this.el['life-end']!.textContent = `失効 ${formatEpoch(life.endS)}`;
    this.el['life-remain']!.textContent = life.expired
      ? '失効済み'
      : life.notYet
        ? '開始前'
        : `経過 ${Math.round(life.ratio * 100)}%`;
    this.el['life-track']!.setAttribute(
      'aria-label',
      `有効期間の経過 ${Math.round(life.ratio * 100)} パーセント`,
    );
  }

  private renderClaims(nowS: number): void {
    const views = claimViews(this.decoded!.payload, nowS);
    const annotated = views.filter((view) => view.label !== null || view.note !== null);
    const block = this.el['claims-block']!;
    const host = this.el['claims']!;
    host.innerHTML = '';
    if (annotated.length === 0) {
      block.hidden = true;
      return;
    }
    block.hidden = false;

    const table = document.createElement('table');
    table.className = 'claims-table';
    table.innerHTML = '<thead><tr><th>クレーム</th><th>意味</th><th>解釈</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const view of annotated) {
      const row = document.createElement('tr');
      if (view.warn) row.className = 'claim-warn';
      const key = document.createElement('td');
      key.className = 'claim-key';
      key.textContent = view.key;
      const label = document.createElement('td');
      label.textContent = view.label ?? '—';
      const note = document.createElement('td');
      note.className = 'claim-note';
      note.textContent = view.note ?? formatValue(view.value);
      row.append(key, label, note);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    host.appendChild(table);
  }

  private renderAlg(decoded: DecodedJwt): void {
    const alg = decoded.header['alg'];
    const card = this.el['alg']!;
    card.innerHTML = '';
    card.classList.remove('is-danger');
    if (typeof alg !== 'string') {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const name = document.createElement('span');
    name.className = 'alg-name';
    name.textContent = alg;
    card.appendChild(name);

    const status = algorithmStatus(alg);
    if (status === 'none') {
      // alg=none は古典的な脆弱性。未対応ではなく危険として強く示す。
      card.classList.add('is-danger');
      const family = document.createElement('span');
      family.className = 'alg-family';
      family.textContent = '署名のない非セキュアトークン';
      const summary = document.createElement('span');
      summary.className = 'alg-summary';
      summary.textContent =
        '検証する署名がありません。alg=none を受け入れる実装は署名を回避され得る重大な脆弱性で、本番では必ず拒否します。';
      card.append(family, summary);
      return;
    }

    const info = describeAlgorithm(alg);
    const family = document.createElement('span');
    family.className = 'alg-family';
    if (!info) {
      family.textContent = '未対応のアルゴリズム';
      card.appendChild(family);
      return;
    }
    family.textContent = `${info.family} ・ ${info.hash}`;
    const summary = document.createElement('span');
    summary.className = 'alg-summary';
    summary.textContent = info.summary;
    card.append(family, summary);
  }

  private renderVerifyHint(decoded: DecodedJwt): void {
    const alg = decoded.header['alg'];
    const hint = this.el['verify-hint']!;
    if (typeof alg !== 'string' || alg === 'none') {
      hint.textContent = 'このトークンは署名を持ちません(alg=none)。検証はできません。';
      return;
    }
    hint.textContent = alg.startsWith('HS')
      ? `alg=${alg}: 発行側と共有しているシークレット文字列を貼ります。`
      : `alg=${alg}: 発行者の公開鍵をPEM(BEGIN PUBLIC KEY)またはJWKで貼ります。`;
  }

  private async verify(): Promise<void> {
    if (!this.decoded) return;
    const keyText = (this.el['key'] as HTMLTextAreaElement).value;
    const box = this.el['verify-result']!;
    box.hidden = false;
    box.className = 'verify-result verify-pending';
    box.textContent = '検証中…';
    const result = await verifyJwt(this.decoded, keyText);
    box.className = `verify-result ${result.ok ? 'verify-ok' : 'verify-ng'}`;
    box.innerHTML = result.ok ? STATE_ICONS.ok : STATE_ICONS.warn;
    box.append(result.message);
  }

  private async copy(button: HTMLElement, text: string): Promise<void> {
    if (text === '') return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    const label = button.querySelector('span');
    button.classList.add('is-copied');
    const original = button.innerHTML;
    button.innerHTML = label ? `${CHECK_ICON}<span>コピーしました</span>` : CHECK_ICON;
    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.innerHTML = original;
    }, 1400);
  }

  private startTick(): void {
    this.stopTick();
    this.tickTimer = window.setInterval(() => this.tick(), 1000);
  }

  private stopTick(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

function rawToken(decoded: DecodedJwt): string {
  return `${decoded.raw.header}.${decoded.raw.payload}.${decoded.raw.signature}`;
}

// 整形済みJSONを構文ハイライトしてhostへ描く。textContentは元のJSONに一致するので、
// コピー機能はそのまま使える。
function paintJson(host: HTMLElement, value: unknown): void {
  const pretty = JSON.stringify(value, null, 2);
  host.textContent = '';
  for (const token of tokenizeJson(pretty)) {
    if (token.type === 'punct') {
      host.appendChild(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `j-${token.type}`;
    span.textContent = token.text;
    host.appendChild(span);
  }
}

// クレーム値の表示用。配列・オブジェクトはJSONで、文字列はそのまま見せる。
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return String(value);
  return JSON.stringify(value);
}
