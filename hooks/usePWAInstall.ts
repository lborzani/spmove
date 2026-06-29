export type PWAInstallState =
  | { status: 'installed' }
  | { status: 'installable'; prompt: () => Promise<void> }
  | { status: 'ios-manual' }
  | { status: 'unsupported' };

export function usePWAInstall(): PWAInstallState {
  return { status: 'unsupported' };
}
