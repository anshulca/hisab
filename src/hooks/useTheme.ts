import { useCallback, useEffect, useRef, useState } from 'react';

export type Theme = 'dark' | 'light';

function getIstHour(): number {
  try {
    if (typeof window === 'undefined') return 12;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const num = hour ? Number(hour) : NaN;
    return Number.isFinite(num) ? num : 12;
  } catch {
    return new Date().getHours();
  }
}

function themeForHour(hour: number): Theme {
  return hour >= 20 || hour < 6 ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem('hisab-theme');
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const overrideRef = useRef<{ autoAtOverride: Theme } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? themeForHour(getIstHour()));

  useEffect(() => {
    const tick = () => {
      const auto = themeForHour(getIstHour());
      if (overrideRef.current) {
        if (auto !== overrideRef.current.autoAtOverride) {
          overrideRef.current = null;
          setTheme(auto);
        }
      } else {
        setTheme(auto);
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('hisab-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      overrideRef.current = { autoAtOverride: themeForHour(getIstHour()) };
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}