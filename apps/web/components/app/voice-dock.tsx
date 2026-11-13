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
import { useLocale } from "@/components/i18n/locale-provider";
import { speechLocale } from "@/lib/i18n";
import { speechSupported, startSpeech, type SpeechSession } from "@/lib/voice/speech";

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
  const session = useRef<SpeechSession | null>(null);
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

  const stopListening = useCallback(() => session.current?.stop(), []);
  const cancelListening = useCallback(() => {
    session.current?.abort();
    session.current = null;
    setListening(false);
    setHeard("");
  }, [setListening]);

  const startListening = useCallback(() => {
    if (!canSpeak) {
      notify(dict.dock.voiceUnsupported, "info");
      inputRef.current?.focus();
      return;
    }
    setHeard("");
    const started = startSpeech(speechLocale[lang], {
      onPartial: setHeard,
      onFinal: (transcript) => void submit(transcript),
      onError: (code) => {
        if (code === "not-allowed") notify(dict.dock.micDenied);
        else if (code === "unsupported") notify(dict.dock.voiceUnsupported, "info");
        else if (code === "network") notify(dict.errors.network);
      },
      onEnd: () => {
        session.current = null;
        setListening(false);
        setHeard("");
      },
    });
    if (started) {
      session.current = started;
      setListening(true);
    }
  }, [canSpeak, lang, notify, dict, submit, setListening]);

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelListening();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, cancelListening]);

  useEffect(() => () => session.current?.abort(), []);

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
        onClick={listening ? stopListening : startListening}
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
          <p className="type-label text-volt-ink">{status}</p>
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
