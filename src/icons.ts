// 画面で使うモダンSVGアイコン群。currentColorで描き、テーマと配色に追従する。
// 装飾アイコンには aria-hidden を付け、意味を担うものは利用側で aria-label を補う。

// ブランドマーク。レンズ(ルーペ)の円の中に、JWTの三分割を示す三本のティックを置く。
export const LENS_MARK = `<svg class="lens-mark" viewBox="0 0 32 32" width="30" height="30" role="img" aria-label="jwtlens">
  <title>jwtlens</title>
  <circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M19.6 19.6 27 27" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
  <path d="M9.5 13h2" stroke="var(--seg-header)" stroke-width="2" stroke-linecap="round" />
  <path d="M14 13h1.6" stroke="var(--seg-payload)" stroke-width="2" stroke-linecap="round" />
  <path d="M18 13h0.4" stroke="var(--seg-signature)" stroke-width="2" stroke-linecap="round" />
</svg>`;

// テーマ切替ボタンのアイコン(自動=半月・ライト=太陽・ダーク=月)。
export const THEME_ICONS: Record<'auto' | 'light' | 'dark', string> = {
  auto: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
  light:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/></svg>',
};

// コピー(2枚の紙片)。
export const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15.5A2 2 0 0 1 3.5 13.6V5.5A2 2 0 0 1 5.5 3.5h8.1A2 2 0 0 1 15.5 5"/></svg>';

// コピー完了のチェック。
export const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';

// 状態アイコン。検証結果や失効状態の見出しに添える。
export const STATE_ICONS = {
  // 有効・成立(円のチェック)
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.6 2.6L16 9"/></svg>',
  // 警告・不成立(三角の感嘆符)
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.4" r="0.4" fill="currentColor" stroke="none"/></svg>',
  // 時刻・期限(時計)
  clock:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  // 未署名・注意(丸のi)
  info: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="0.5" fill="currentColor" stroke="none"/></svg>',
} as const;

// 空状態に添える、点線のトークン枠。
export const EMPTY_ICON =
  '<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="58" height="22" rx="4" stroke-dasharray="3 5"/><path d="M22 20h0.3M32 20h0.3M42 20h0.3"/></svg>';
