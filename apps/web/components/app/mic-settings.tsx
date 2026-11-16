"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicLevel } from "@/components/app/mic-level";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  feedsTrackToSpeech,
  listMicrophoneInfo,
  micErrorCode,
  openMicrophone,
  readMicChoice,
  realMicrophones,
  releaseMicrophone,
  resolveChoice,
  saveMicChoice,
  subscribeMicChoice,
  systemDefaultLabel,
  userAgentData,
  type MicChoice,
  type MicDevice,
} from "@/lib/voice/microphone";
import { speechSupported } from "@/lib/voice/speech";

/**
 * pick: dictation listens to the microphone we open, so the user can choose it.
 * system: the browser (or a native shell) listens to the system input; we can only test it.
 * none: no dictation in this browser.
 */
type Support = "pick" | "system" | "none" | "unknown";

function readSupport(): Support {
  if (!speechSupported()) return "none";
  if (window.PowerWeekNative?.speech || !navigator.mediaDevices?.getUserMedia) return "system";
  return feedsTrackToSpeech(userAgentData()) ? "pick" : "system";
}
const subscribeNothing = () => () => {};
const serverSupport = (): Support => "unknown";
const serverChoice = () => null;

interface Test {
  stream: MediaStream;
  name: string;
}

/** Settings → Voice: which microphone dictation uses, and a live test of it. */
export function MicSettings() {
  const { dict } = useLocale();
  const t = dict.settings.mic;
  const support = useSyncExternalStore(subscribeNothing, readSupport, serverSupport);
  const choice = useSyncExternalStore(subscribeMicChoice, readMicChoice, serverChoice);
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [defaultName, setDefaultName] = useState<string | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testStream = useRef<MediaStream | null>(null);
  const testAttempt = useRef(0);

  const refresh = useCallback(() => {
    void listMicrophoneInfo()
      .catch(() => [])
      .then((devices) => {
        const list = realMicrophones(devices);
        setMics(list);
        setDefaultName(systemDefaultLabel(devices));
        // Same device, new id (site data was cleared): keep the choice pointing at it.
        const saved = readMicChoice();
        const match = saved ? resolveChoice(saved, list) : null;
        if (saved && match && match.id !== saved.id) saveMicChoice(match);
      });
  }, []);

  // The list follows microphones as they come and go (a dock, headphones).
  useEffect(() => {
    if (support !== "pick" && support !== "system") return;
    const media = navigator.mediaDevices;
    refresh();
    media.addEventListener?.("devicechange", refresh);
    return () => media.removeEventListener?.("devicechange", refresh);
  }, [support, refresh]);

  const stopTest = useCallback(() => {
    testAttempt.current += 1;
    releaseMicrophone(testStream.current);
    testStream.current = null;
    setTest(null);
  }, []);

  useEffect(() => () => releaseMicrophone(testStream.current), []);

  const startTest = useCallback(
    async (target: MicChoice | null) => {
      stopTest();
      const id = testAttempt.current;
      setTestError(null);
      try {
        const { stream } = await openMicrophone(target);
        if (testAttempt.current !== id) {
          releaseMicrophone(stream);
          return;
        }
        const track = stream.getAudioTracks()[0];
        testStream.current = stream;
        setTest({ stream, name: track?.label || t.systemDefault });
        track?.addEventListener("ended", () => {
          if (testStream.current === stream) stopTest();
        });
        // Names only show once the site may use the microphone.
        refresh();
      } catch (error) {
        if (testAttempt.current !== id) return;
        const code = micErrorCode(error);
        setTestError(
          code === "not-allowed"
            ? dict.dock.micDenied
            : code === "no-microphone"
              ? dict.dock.noMicrophone
              : code === "busy"
                ? dict.dock.micBusy
                : dict.errors.generic,
        );
      }
    },
    [stopTest, refresh, t.systemDefault, dict],
  );

  if (support === "unknown") return null;
  if (support === "none")
    return <p className="type-body text-ink-muted">{dict.dock.voiceUnsupported}</p>;

  const known = mics.length > 0;
  const connected = choice ? resolveChoice(choice, mics) : null;
  const missing = Boolean(choice && known && !connected);
  const testTarget = support === "pick" ? choice : null;

  function onPick(id: string) {
    const next = id ? (mics.find((mic) => mic.id === id) ?? choice) : null;
    saveMicChoice(next);
    if (test) void startTest(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {support === "pick" ? (
        <label className="flex flex-col gap-2">
          <span className="type-caption text-ink-muted">{t.label}</span>
          <select
            value={choice ? (connected?.id ?? choice.id) : ""}
            onChange={(event) => onPick(event.target.value)}
            className="h-12 rounded-[14px] border border-line-strong bg-surface px-4 text-base text-ink"
          >
            <option value="">
              {defaultName ? t.systemDefaultIs(defaultName) : t.systemDefault}
            </option>
            {mics.map((mic, index) => (
              <option key={mic.id} value={mic.id}>
                {mic.label || t.unnamed(index + 1)}
              </option>
            ))}
            {choice && !connected ? (
              <option value={choice.id}>{t.disconnected(choice.label || t.unnamed(1))}</option>
            ) : null}
          </select>
          <span className="type-caption text-ink-muted">{t.hint}</span>
        </label>
      ) : (
        <p className="type-caption text-ink-muted">{t.systemOnly}</p>
      )}

      {missing ? (
        <p role="status" className="type-caption text-ink">
          {t.missing}
        </p>
      ) : null}

      <div className="flex min-h-11 items-center gap-4">
        <Button onClick={() => (test ? stopTest() : void startTest(testTarget))}>
          {test ? (
            <Square size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          ) : (
            <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
          {test ? t.stopTest : t.test}
        </Button>
        {test ? <MicLevel stream={test.stream} bars={16} className="h-8 max-w-56 flex-1" /> : null}
      </div>

      <p
        aria-live="polite"
        className={`type-caption empty:hidden ${testError ? "text-danger" : "text-ink-muted"}`}
      >
        {testError ?? (test ? t.testing(test.name) : support === "pick" && !known ? t.reveal : "")}
      </p>
    </div>
  );
}
