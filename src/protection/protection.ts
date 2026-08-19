import { showShield, addCreditBadge, initShieldBasics } from './shield';

function isFieldTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function blockEvent(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

function keyShield(e: KeyboardEvent): void {
  const key = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;

  if (key === 'F12') {
    blockEvent(e);
    showShield('Developer tools are blocked on HISAB.');
    return;
  }

  if (ctrl && shift && /^[IJCKS]$/i.test(key)) {
    blockEvent(e);
    showShield('Developer tools shortcut is blocked on HISAB.');
    return;
  }

  if (ctrl && !shift && /^[US]$/i.test(key)) {
    if (/^u$/i.test(key)) {
      blockEvent(e);
      showShield('Viewing the page source is blocked on HISAB.');
    } else {
      blockEvent(e);
      showShield('Saving this page is blocked on HISAB.');
    }
    return;
  }

  if (ctrl && key.toLowerCase() === 'p') {
    blockEvent(e);
    showShield('Printing is blocked on HISAB.');
    return;
  }

  if (ctrl && /^[ACX]$/i.test(key)) {
    if (isFieldTarget(e.target)) return;
    blockEvent(e);
    showShield('Copying or cutting content from HISAB is blocked.');
  }
}

function initKeyGuard(): void {
  window.addEventListener('keydown', keyShield, true);
}

function initContextGuard(): void {
  document.addEventListener(
    'contextmenu',
    (e) => {
      blockEvent(e);
      showShield('Right-click is disabled on HISAB.');
    },
    true
  );
}

function initClipboardGuards(): void {
  const guard = (e: Event): void => {
    if (isFieldTarget(e.target)) return;
    showShield('Copying or cutting content from HISAB is blocked.');
    blockEvent(e);
  };
  document.addEventListener('copy', guard, true);
  document.addEventListener('cut', guard, true);

  document.addEventListener(
    'selectstart',
    (e) => {
      if (isFieldTarget(e.target)) return;
      blockEvent(e);
    },
    true
  );

  document.addEventListener(
    'dragstart',
    (e) => {
      if (isFieldTarget(e.target)) return;
      blockEvent(e);
    },
    true
  );
}

function initPrintGuard(): void {
  window.addEventListener('beforeprint', () => showShield('Printing is blocked on HISAB.'));
  window.addEventListener('afterprint', () => {});
}

function initFrameBust(): void {
  try {
    if (window.top && window.top !== window.self) {
      showShield('HISAB is protected against embedding in other websites.');
      window.top.location.href = window.location.href;
    }
  } catch {
    /* cross-origin top frame — the shield remains visible */
  }
}

function initDevToolsDetection(): void {
  const SIZE_THRESHOLD = 160;
  const PAUSE_THRESHOLD_MS = 120;

  setInterval(() => {
    try {
      const widthDiff = window.outerWidth - window.innerWidth;
      if (widthDiff > SIZE_THRESHOLD) {
        showShield('Developer tools were detected on HISAB (window-size check).');
        return;
      }
    } catch {
      /* ignore cross-browser quirks */
    }

    try {
      const before = Date.now();
      (function probe() {
        debugger;
      })();
      if (Date.now() - before > PAUSE_THRESHOLD_MS) {
        showShield('Developer tools were detected on HISAB (debugger probe).');
      }
    } catch {
      /* debugger statement unavailable */
    }
  }, 1200);
}

export function initProtection(): void {
  initShieldBasics();
  addCreditBadge();
  initKeyGuard();
  initContextGuard();
  initClipboardGuards();
  initPrintGuard();
  initFrameBust();
  initDevToolsDetection();
}

initProtection();