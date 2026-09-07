/**
 * Light and dark, chosen by the user.
 *
 * The class lives on <html> rather than on a React root, because the page's own
 * background is painted from `body` before React has rendered anything. It is applied
 * twice: once by a small script in index.html that runs before first paint, and again
 * from here whenever the choice changes — without the first, the app would flash the
 * light theme on every load for anyone who picked dark.
 */
export type Theme = 'light' | 'dark';

const KEY = 'taskr.theme';

/** What the operating system asks for, when the user has expressed no preference. */
export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private browsing, or storage disabled. The theme still works for this visit.
    return null;
  }
}

export function currentTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/**
 * What the browser tints its own chrome with on a phone — the address bar in Chrome,
 * the area behind the status bar once the app is installed to a home screen. Left
 * unchanged it would keep the light value through a switch to dark, which reads as a
 * white bar sitting above a black app.
 *
 * These two are `--background` from index.css. They are repeated rather than read from
 * the custom property because the same pair is inlined in index.html's pre-paint
 * script, which has no stylesheet to read from yet.
 */
const CHROME_COLOR: Record<Theme, string> = { light: '#ffffff', dark: '#09090b' };

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME_COLOR[theme]);
  try { localStorage.setItem(KEY, theme); } catch { /* nothing to do */ }
}
