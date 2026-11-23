/**
 * Native Mobile Haptic Feedback Engine
 * Leverages the Vibration API on mobile browsers & PWAs
 */
export type HapticTone = 'light' | 'medium' | 'heavy' | 'success' | 'levelup' | 'error';

export function triggerHaptic(tone: HapticTone = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (tone) {
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(28);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 30, 25]); // Double tap pulse
        break;
      case 'levelup':
        navigator.vibrate([30, 50, 40, 60, 50]); // Fanfare burst
        break;
      case 'error':
        navigator.vibrate([50, 40, 50]);
        break;
    }
  } catch {
    // Ignore unsupported browser environments silently
  }
}
