import { useState, useEffect } from 'react';
import {
  getInstallPrompt,
  clearInstallPrompt,
  onInstallPromptChange,
} from '@/services/installPrompt.web';

export type PWAInstallState =
  | { status: 'installed' }
  | { status: 'installable'; prompt: () => Promise<void> }
  | { status: 'ios-manual' }
  | { status: 'unsupported' };

export function usePWAInstall(): PWAInstallState {
  const [state, setState] = useState<PWAInstallState>(() => resolveState());

  useEffect(() => {
    setState(resolveState());
    return onInstallPromptChange(() => setState(resolveState()));
  }, []);

  return state;
}

function resolveState(): PWAInstallState {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) return { status: 'installed' };

  const prompt = getInstallPrompt();
  if (prompt) {
    return {
      status: 'installable',
      prompt: async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') clearInstallPrompt();
      },
    };
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isIOS && isSafari) return { status: 'ios-manual' };

  return { status: 'unsupported' };
}
