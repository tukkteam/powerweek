/**
 * Speech-to-text behind one small interface, so the same web code works everywhere:
 *
 *  1. Native bridge — native shells (Capacitor on Android/iOS, Tauri on desktop) can expose
 *     `window.PowerWeekNative.speech` backed by the OS recogniser or on-device Whisper.
 *  2. Web Speech API — Chrome, Edge and Safari in the browser.
 *
 * Without either, the Voice Dock falls back to typing.
 */

export type SpeechErrorCode = "not-allowed" | "no-speech" | "network" | "unsupported" | "other";

export interface SpeechCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: SpeechErrorCode) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  /** Stop listening and deliver what was heard through onFinal. */
  stop: () => void;
  /** Stop listening and discard the transcript. */
  abort: () => void;
}

/** Contract for native shells. Documented in docs/native-strategy.md. */
export interface NativeSpeechBridge {
  start(options: { lang: string }, callbacks: SpeechCallbacks): SpeechSession;
}

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

declare global {
  interface Window {
    PowerWeekNative?: { speech?: NativeSpeechBridge };
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.PowerWeekNative?.speech || recognitionCtor());
}

function mapError(error: string): SpeechErrorCode {
  if (error === "not-allowed" || error === "service-not-allowed") return "not-allowed";
  if (error === "no-speech") return "no-speech";
  if (error === "network") return "network";
  return "other";
}

export function startSpeech(lang: string, callbacks: SpeechCallbacks): SpeechSession | null {
  const native = typeof window !== "undefined" ? window.PowerWeekNative?.speech : undefined;
  if (native) return native.start({ lang }, callbacks);

  const Ctor = recognitionCtor();
  if (!Ctor) {
    callbacks.onError("unsupported");
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";
  let interimText = "";
  let discarded = false;
  let delivered = false;

  recognition.onresult = (event) => {
    interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      const text = result[0].transcript;
      if (result.isFinal) finalText += text;
      else interimText += text;
    }
    callbacks.onPartial(`${finalText}${interimText}`.trim());
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted") return;
    callbacks.onError(mapError(event.error));
  };
  recognition.onend = () => {
    const text = `${finalText}${interimText}`.trim();
    if (!discarded && !delivered && text) {
      delivered = true;
      callbacks.onFinal(text);
    }
    callbacks.onEnd();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError("other");
    return null;
  }

  return {
    stop: () => recognition.stop(),
    abort: () => {
      discarded = true;
      recognition.abort();
    },
  };
}
