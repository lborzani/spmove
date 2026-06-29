interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let _prompt: BeforeInstallPromptEvent | null = null;
const _listeners: (() => void)[] = [];

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _prompt = e as BeforeInstallPromptEvent;
    _listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    _prompt = null;
    _listeners.forEach((fn) => fn());
  });
}

export function getInstallPrompt() {
  return _prompt;
}
export function clearInstallPrompt() {
  _prompt = null;
}
export function onInstallPromptChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}
