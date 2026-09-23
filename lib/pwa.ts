import Constants from 'expo-constants';

export function getPublicBase(): string {
  const fromExpo = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl;
  if (fromExpo && fromExpo !== '/') {
    return fromExpo.replace(/\/$/, '');
  }
  return '';
}

export function publicAsset(path: string): string {
  const file = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicBase()}${file}`;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)');
  const iosStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return media.matches || iosStandalone;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1024px)').matches;
}

export function shouldUseFullScreenWeb(): boolean {
  return isStandaloneDisplay() || isIosDevice() || isMobileViewport();
}

export function ensurePwaHead(): void {
  if (typeof document === 'undefined') return;

  setMeta('theme-color', '#F5C400');
  setMeta('mobile-web-app-capable', 'yes');
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('apple-mobile-web-app-title', 'Ewidencja');
  setMeta('apple-mobile-web-app-status-bar-style', 'default');
  setMeta('application-name', 'Ewidencja');
  setLink('manifest', publicAsset('manifest.webmanifest'));
  setLink('icon', publicAsset('icon.png'));
  setLink('apple-touch-icon', publicAsset('apple-touch-icon.png'));

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
    );
  }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  ensurePwaHead();
  const protocol = window.location.protocol;
  if (protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }
  const base = getPublicBase();
  const script = publicAsset('sw.js');
  const scope = base ? `${base}/` : '/';
  void navigator.serviceWorker.register(script, { scope }).catch((error) => {
    console.warn('Nie udało się zarejestrować PWA', error);
  });
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}
