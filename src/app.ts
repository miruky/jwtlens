import { claimViews, tokenTimeStatus, type TokenState } from './lib/claims';
import { JwtError, parseJwt, type DecodedJwt } from './lib/jwt';
import { signHs256, verifyJwt } from './lib/verify';

const SAMPLE_SECRET = 'jwtlens-demo-secret';

const STATE_LABELS: Record<TokenState, string> = {
  valid: '有効期間内',
  expired: '失効済み',
  'not-yet': '有効開始前',
  'no-exp': '失効なし',
};

const LOGO_SVG = `
<svg viewBox="0 0 64 64" width="44" height="44" role="img" aria-label="jwtlensのロゴ">
  <title>jwtlens</title>
  <circle cx="28" cy="28" r="17" fill="none" stroke="currentColor" stroke-width="4"/>
  <path d="M40 40L54 54" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  <path d="M19 28h6m4 0h6" stroke="#e8b04b" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export class App {
  private decoded: DecodedJwt | null = null;
  private readonly el: Record<string, HTMLElement> = {};

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="site-header">
        <span class="logo" aria-hidden="true">${LOGO_SVG}</span>
        <div>
          <h1>jwtlens</h1>
          <p class="tagline">JWTのデコードと署名検証。すべてブラウザ内で完結し、どこにも送信しない</p>
        </div>
      </header>
      <main class="columns">
        <section class="pane">
          <div class="pane-head">
            <h2>トークン</h2>
            <button type="button" class="ghost-btn" data-id="sample">HS256サンプルを生成</button>
          </div>
          <textarea data-id="token" class="token-input" rows="7" spellcheck="false"
            placeholder="eyJhbGciOi... をここに貼る(Bearer接頭辞ごとでも可)"></textarea>
          <p class="parse-error" data-id="parse-error" hidden></p>
          <div class="token-colored" data-id="colored" hidden></div>
          <div class="status-banner" data-id="status" hidden></div>
        </section>
        <section class="pane">
          <h2>ヘッダ</h2>
          <pre class="json-view" data-id="header">(トークンを貼ると表示)</pre>
          <h2>ペイロード</h2>
          <pre class="json-view" data-id="payload">(トークンを貼ると表示)</pre>
          <div data-id="claims"></div>
          <h2>署名の検証</h2>
          <p class="hint" data-id="verify-hint">トークンを貼ると、algに応じて必要な鍵を案内する</p>
          <textarea data-id="key" class="key-input" rows="5" spellcheck="false"
            placeholder="HS系: 共有シークレット / RS・PS・ES系: 公開鍵(PEMまたはJWK)"></textarea>
          <button type="button" class="primary-btn" data-id="verify" disabled>検証する</button>
          <div class="verify-result" data-id="verify-result" hidden></div>
        </section>
      </main>
      <footer class="site-footer">
        <p>対応アルゴリズム: HS256/384/512、RS256/384/512、PS256/384/512、ES256/384/512。JWE(暗号化トークン)とEdDSAは未対応。</p>
      </footer>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private wire(): void {
    const tokenInput = this.el['token'] as HTMLTextAreaElement;
    tokenInput.addEventListener('input', () => this.decode(tokenInput.value));

    this.el['sample']!.addEventListener('click', () => {
      void this.fillSample(tokenInput);
    });

    this.el['verify']!.addEventListener('click', () => {
      void this.verify();
    });
  }

  private async fillSample(tokenInput: HTMLTextAreaElement): Promise<void> {
    const nowS = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: 'user-1024',
        name: '山田 太郎',
        scope: 'read write',
        iat: nowS,
        exp: nowS + 3600,
      },
      SAMPLE_SECRET,
    );
    tokenInput.value = token;
    (this.el['key'] as HTMLTextAreaElement).value = SAMPLE_SECRET;
    this.decode(token);
  }

  private decode(value: string): void {
    const parseError = this.el['parse-error']!;
    const colored = this.el['colored']!;
    const status = this.el['status']!;
    const verifyButton = this.el['verify'] as HTMLButtonElement;
    this.el['verify-result']!.hidden = true;

    if (value.trim() === '') {
      this.decoded = null;
      parseError.hidden = true;
      colored.hidden = true;
      status.hidden = true;
      verifyButton.disabled = true;
      this.el['header']!.textContent = '(トークンを貼ると表示)';
      this.el['payload']!.textContent = '(トークンを貼ると表示)';
      this.el['claims']!.innerHTML = '';
      this.el['verify-hint']!.textContent = 'トークンを貼ると、algに応じて必要な鍵を案内する';
      return;
    }

    try {
      this.decoded = parseJwt(value);
    } catch (cause) {
      this.decoded = null;
      parseError.textContent = cause instanceof JwtError ? cause.message : '解析に失敗した';
      parseError.hidden = false;
      colored.hidden = true;
      status.hidden = true;
      verifyButton.disabled = true;
      return;
    }

    parseError.hidden = true;
    verifyButton.disabled = false;
    this.renderColored(this.decoded);
    this.renderStatus(this.decoded);
    this.renderBody(this.decoded);
    this.renderVerifyHint(this.decoded);
  }

  private renderColored(decoded: DecodedJwt): void {
    const colored = this.el['colored']!;
    colored.hidden = false;
    colored.innerHTML = '';
    const segments: Array<[string, string]> = [
      [decoded.raw.header, 'seg-header'],
      [decoded.raw.payload, 'seg-payload'],
      [decoded.raw.signature, 'seg-signature'],
    ];
    segments.forEach(([text, className], index) => {
      if (index > 0) colored.append('.');
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      colored.appendChild(span);
    });
  }

  private renderStatus(decoded: DecodedJwt): void {
    const status = this.el['status']!;
    const nowS = Math.floor(Date.now() / 1000);
    const time = tokenTimeStatus(decoded.payload, nowS);
    status.hidden = false;
    status.className = `status-banner status-${time.state}`;
    status.textContent = `${STATE_LABELS[time.state]} - ${time.detail}`;
  }

  private renderBody(decoded: DecodedJwt): void {
    this.el['header']!.textContent = JSON.stringify(decoded.header, null, 2);
    this.el['payload']!.textContent = JSON.stringify(decoded.payload, null, 2);

    const nowS = Math.floor(Date.now() / 1000);
    const views = claimViews(decoded.payload, nowS);
    const annotated = views.filter((view) => view.label !== null || view.note !== null);
    const claims = this.el['claims']!;
    claims.innerHTML = '';
    if (annotated.length === 0) return;

    const table = document.createElement('table');
    table.className = 'claims-table';
    table.innerHTML = '<thead><tr><th>クレーム</th><th>意味</th><th>解釈</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const view of annotated) {
      const row = document.createElement('tr');
      if (view.warn) row.className = 'claim-warn';
      const key = document.createElement('td');
      key.textContent = view.key;
      const label = document.createElement('td');
      label.textContent = view.label ?? '-';
      const note = document.createElement('td');
      note.textContent = view.note ?? String(view.value);
      row.append(key, label, note);
      body.appendChild(row);
    }
    table.appendChild(body);
    claims.appendChild(table);
  }

  private renderVerifyHint(decoded: DecodedJwt): void {
    const alg = decoded.header['alg'];
    const hint = this.el['verify-hint']!;
    if (typeof alg !== 'string' || alg === 'none') {
      hint.textContent = 'このトークンは署名を持たない(alg=none)。検証はできない';
      return;
    }
    hint.textContent = alg.startsWith('HS')
      ? `alg=${alg}: 発行側と共有しているシークレット文字列を貼る`
      : `alg=${alg}: 発行者の公開鍵をPEM(BEGIN PUBLIC KEY)またはJWKで貼る`;
  }

  private async verify(): Promise<void> {
    if (!this.decoded) return;
    const keyText = (this.el['key'] as HTMLTextAreaElement).value;
    const resultBox = this.el['verify-result']!;
    resultBox.hidden = false;
    resultBox.className = 'verify-result';
    resultBox.textContent = '検証中…';
    const result = await verifyJwt(this.decoded, keyText);
    resultBox.className = result.ok ? 'verify-result verify-ok' : 'verify-result verify-ng';
    resultBox.textContent = result.message;
  }
}
