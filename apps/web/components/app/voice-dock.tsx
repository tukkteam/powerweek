"use client";

import { ArrowUp, LoaderCircle, Mic, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useApp } from "@/components/app/app-provider";
import { MicLevel } from "@/components/app/mic-level";
import { useLocale } from "@/components/i18n/locale-provider";
import { speechLocale } from "@/lib/i18n";
import { readMicChoice } from "@/lib/voice/microphone";
import {
  speechSupported,
  startSpeech,
  type SpeechErrorCode,
  type SpeechSession,
} from "@/lib/voice/speech";

const subscribeNothing = () => () => {};

/**
 * The primary input: microphone orb + text field. One per screen, pinned to the bottom on
 * mobile and centred at 640px on desktop. Voice and text both go to the assistant.
 */
export function VoiceDock() {
  const { ask, thinking, notify, listening, setListening } = useApp();
  const { lang, dict } = useLocale();
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [pending, setPending] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const session = useRef<SpeechSession | null>(null);
  /** Bumped on every start and cancel, so a start that resolves late knows it is stale. */
  const attempt = useRef(0);
  const heardRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSpeak = useSyncExternalStore(subscribeNothing, speechSupported, () => false);

  const submit = useCallback(
    async (value: string) => {
      const input = value.trim();
      if (!input || thinking) return;
      setText("");
      setPending(input);
      const ok = await ask(input);
      setPending("");
      if (!ok) setText(input);
    },
    [ask, thinking],
  );

  const reset = useCallback(() => {
    session.current = null;
    heardRef.current = "";
    setStream(null);
    setListening(false);
    setHeard("");
  }, [setListening]);

  const cancelListening = useCallback(() => {
    attempt.current += 1;
    session.current?.abort();
    reset();
  }, [reset]);

  // Before the microphone opens there is nothing to send yet, so stopping means cancelling.
  const stopListening = useCallback(() => {
    if (session.current) session.current.stop();
    else cancelListening();
  }, [cancelListening]);

  const report = useCallback(
    (code: SpeechErrorCode) => {
      if (code === "unsupported") {
        notify(dict.dock.voiceUnsupported, "info");
        return;
      }
      // Keep the words heard before the microphone vanished, ready to check and send.
      if (code === "device-lost" && heardRef.current) setText(heardRef.current);
      const messages: Record<Exclude<SpeechErrorCode, "unsupported">, string> = {
        "not-allowed": dict.dock.micDenied,
        "no-microphone": dict.dock.noMicrophone,
        busy: dict.dock.micBusy,
        "device-lost": dict.dock.micLost,
        "no-speech": dict.dock.noSpeech,
        network: dict.dock.speechNetwork,
        service: dict.dock.speechService,
        other: dict.dock.speechFailed,
      };
      notify(messages[code], code === "no-speech" ? "info" : "error");
    },
    [dict, notify],
  );

  const startListening = useCallback(async () => {
    if (!canSpeak) {
      notify(dict.dock.voiceUnsupported, "info");
      inputRef.current?.focus();
      return;
    }
    attempt.current += 1;
    const id = attempt.current;
    const isCurrent = () => attempt.current === id;
    const microphone = readMicChoice();
    heardRef.current = "";
    setHeard("");
    setListening(true);

    const started = await startSpeech(
      { lang: speechLocale[lang], microphone },
      {
        onPartial: (value) => {
          if (!isCurrent()) return;
          heardRef.current = value;
          setHeard(value);
        },
        onFinal: (value) => {
          if (isCurrent()) void submit(value);
        },
        onError: (code) => {
          if (isCurrent()) report(code);
        },
        onEnd: () => {
          if (isCurrent()) reset();
        },
      },
    );
    if (!isCurrent()) {
      started?.abort();
      return;
    }
    if (!started) {
      reset();
      return;
    }
    session.current = started;
    setStream(started.stream);
    if (started.fellBack) notify(dict.dock.micFallback(microphone?.label ?? ""), "info");
  }, [canSpeak, lang, notify, dict, submit, setListening, report, reset]);

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelListening();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, cancelListening]);

  useEffect(
    () => () => {
      attempt.current += 1;
      session.current?.abort();
    },
    [],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(text);
  };

  const status = listening ? dict.dock.listening : thinking ? dict.dock.thinking : null;
  const shownText = listening ? heard : thinking ? pending : null;

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-full border border-line bg-surface-raised p-2 shadow-float"
    >
      <button
        type="button"
        onClick={listening ? stopListening : () => void startListening()}
        disabled={thinking}
        aria-label={listening ? dict.dock.stop : dict.dock.speak}
        className={`flex size-13 shrink-0 items-center justify-center rounded-full bg-volt text-on-volt transition-transform active:scale-95 disabled:opacity-100 ${
          listening ? "pw-halo" : ""
        }`}
      >
        {thinking ? (
          <LoaderCircle className="animate-spin" size={24} strokeWidth={2} aria-hidden="true" />
        ) : listening ? (
          <Square size={20} fill="currentColor" strokeWidth={0} aria-hidden="true" />
        ) : (
          <Mic size={24} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      {status ? (
        <div className="min-w-0 flex-1 px-2" aria-live="polite">
          <p className="type-label flex items-center gap-2 text-volt-ink">
            {status}
            {listening && stream ? (
              <MicLevel stream={stream} bars={5} className="h-3.5 w-7" />
            ) : null}
          </p>
          <p className={`type-body truncate ${shownText ? "text-ink" : "text-ink-muted"}`}>
            {shownText || (listening ? dict.dock.hintStop : "")}
          </p>
        </div>
      ) : (
        <>
          <label htmlFor="pw-dock-input" className="sr-only">
            {dict.dock.inputLabel}
          </label>
          <input
            ref={inputRef}
            id="pw-dock-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={dict.dock.placeholder}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={600}
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[0.9375rem] text-ink outline-none placeholder:text-ink-muted"
          />
        </>
      )}

      {listening ? (
        <button
          type="button"
          onClick={cancelListening}
          className="h-11 shrink-0 rounded-full px-4 text-[0.9375rem] font-bold text-ink-muted hover:text-ink"
        >
          {dict.dock.cancel}
        </button>
      ) : text.trim() && !thinking ? (
        <button
          type="submit"
          aria-label={dict.dock.send}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-surface"
        >
          <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}
