const LINKEDIN_URL = 'https://www.linkedin.com/';
const DEVELOPER = 'CA Anshul Karwa';
const SHIELD_ID = 'hisab-shield-layer';

let shieldEl: HTMLElement | null = null;

function injectGlobalStyles(): void {
  const style = document.createElement('style');
  style.textContent = [
    'body, body * { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }',
    'input, textarea, [contenteditable="true"], [data-protected-input] { user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; -webkit-user-drag: none; }',
    'img { -webkit-user-drag: none; }',
    '@media print { body { display: none !important; visibility: hidden !important; } }'
  ].join('\n');
  document.head.appendChild(style);
}

function createShield(): HTMLElement {
  const el = document.createElement('div');
  el.id = SHIELD_ID;
  el.style.cssText =
    'display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(6,8,14,0.88);' +
    'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);align-items:center;justify-content:center;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';

  const card = document.createElement('div');
  card.style.cssText =
    'max-width:540px;margin:24px;padding:44px 40px;border-radius:18px;background:#0f1220;' +
    'border:1px solid rgba(212,168,84,0.45);color:#e9e7e2;text-align:center;' +
    'box-shadow:0 24px 90px rgba(0,0,0,0.65);';

  card.innerHTML =
    '<div style="font-size:52px;line-height:1">&#128683;</div>' +
    '<h2 style="margin:14px 0 8px;font-size:26px;letter-spacing:0.4px;color:#f0c96b">Protected Content</h2>' +
    '<p data-shield-reason style="font-size:12.5px;color:#9aa0ab;margin:0 0 12px">Access attempt blocked</p>' +
    `<p style="font-size:15px;line-height:1.75;color:#cfd3da;margin:0 0 26px">HISAB is the original work of ${DEVELOPER}. ` +
    'For permission to inspect, copy or reuse, contact the developer.</p>' +
    '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
    `<a href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" style="background:#0a66c2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">LinkedIn</a>` +
    '<button type="button" data-shield-reload style="background:transparent;color:#e9e7e2;border:1px solid rgba(212,168,84,0.55);padding:11px 23px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Reload</button>' +
    '</div>';

  el.appendChild(card);
  document.documentElement.appendChild(el);

  const reload = card.querySelector('[data-shield-reload]') as HTMLButtonElement | null;
  if (reload) reload.addEventListener('click', () => window.location.reload());

  return el;
}

export function showShield(reason: string): void {
  if (!shieldEl) shieldEl = createShield();
  const reasonEl = shieldEl.querySelector('[data-shield-reason]') as HTMLElement | null;
  if (reasonEl) reasonEl.textContent = reason;
  shieldEl.style.display = 'flex';
}

export function addCreditBadge(): void {
  const badge = document.createElement('div');
  badge.setAttribute('data-hisab-badge', '');
  badge.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:9990;display:flex;align-items:center;gap:8px;' +
    'padding:8px 14px;border-radius:999px;background:rgba(13,16,26,0.92);border:1px solid rgba(212,168,84,0.35);' +
    'box-shadow:0 6px 22px rgba(0,0,0,0.45);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
    'font-size:12px;color:#cfd3da;white-space:nowrap;';

  const heart = document.createElement('span');
  heart.textContent = 'Made with ♥ by CA Anshul Karwa';
  heart.style.cssText = 'color:#e9e7e2';

  const divider = document.createElement('span');
  divider.textContent = '·';
  divider.style.cssText = 'color:#6b7280';

  const contact = document.createElement('a');
  contact.textContent = 'Contact the developer';
  contact.href = LINKEDIN_URL;
  contact.target = '_blank';
  contact.rel = 'noopener noreferrer';
  contact.style.cssText = 'color:#f0c96b;text-decoration:none;font-weight:600';

  badge.appendChild(heart);
  badge.appendChild(divider);
  badge.appendChild(contact);
  document.body.appendChild(badge);
}

export function initShieldBasics(): void {
  injectGlobalStyles();
}