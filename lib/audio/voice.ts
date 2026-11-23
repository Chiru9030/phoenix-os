/**
 * Web Speech API Voice Narration Engine
 * Synthesizes deep, resonant voice narration for Dungeon Master briefings with zero external API cost.
 */
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
): void {
  if (!isSpeechSupported()) return;

  stopSpeaking();

  const cleaned = text.replace(/[*_#`~]/g, '').trim();
  if (!cleaned) return;

  const utterance = new SpeechSynthesisUtterance(cleaned);
  currentUtterance = utterance;

  // Find best atmospheric voice (prefer deep English voices)
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Daniel') || v.name.includes('Google UK English Male') || v.name.includes('Natural') || v.name.includes('Guy'))) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Slightly lower pitch and steady cadence for dramatic Dungeon Master presence
  utterance.pitch = 0.95;
  utterance.rate = 0.98;

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    currentUtterance = null;
    callbacks?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}
