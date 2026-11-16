/**
 * The microphone dictation listens to.
 *
 * Desktop Chromium browsers (Chrome, Edge, Comet, Arc…) let the Web Speech API recognise a
 * MediaStreamTrack: `recognition.start(track)`, Chrome 135+. PowerWeek opens the microphone
 * itself and hands it over, so the user can pick one in Settings and dictation no longer depends
 * on a device the browser remembered. Comet, for example, kept listening to an audio interface
 * that was unplugged with the dock, and heard nothing. Other browsers ignore the track and
 * listen to the system's default input, so there we leave the microphone to them.
 *
 * The choice lives in localStorage: device ids are per browser and per site.
 */

export interface MicDevice {
  id: string;
  /** Empty until the site has microphone permission. */
  label: string;
}

/** The microphone the user picked. No choice means the system default. */
export type MicChoice = MicDevice;

export type MicErrorCode = "not-allowed" | "no-microphone" | "busy" | "other";

export interface OpenedMicrophone {
  stream: MediaStream;
  /** True when the chosen microphone was not connected and the system default was opened. */
  fellBack: boolean;
}

interface UADataBrand {
  brand: string;
  version: string;
}

/** The parts of `navigator.userAgentData` we read (Chromium only). */
export interface UAData {
  brands?: readonly UADataBrand[];
  mobile?: boolean;
  platform?: string;
}

type DeviceInfo = Pick<MediaDeviceInfo, "kind" | "deviceId" | "label" | "groupId">;

/** Aliases Chromium lists next to the real devices. */
const ALIASES = new Set(["default", "communications"]);
const DESKTOP = new Set(["macOS", "Windows", "Linux"]);
const KEY = "pw-mic";

/** True when speech recognition will listen to a track we open: desktop Chromium 135+. */
export function feedsTrackToSpeech(ua: UAData | null | undefined): boolean {
  if (!ua || ua.mobile || !DESKTOP.has(ua.platform ?? "")) return false;
  const chromium = ua.brands?.find((brand) => brand.brand === "Chromium");
  return Number(chromium?.version) >= 135;
}

export function userAgentData(): UAData | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { userAgentData?: UAData }).userAgentData ?? null;
}

/** Real microphones in system order, without Chromium's "default" and "communications" aliases. */
export function realMicrophones(devices: readonly DeviceInfo[]): MicDevice[] {
  return devices
    .filter((d) => d.kind === "audioinput" && d.deviceId && !ALIASES.has(d.deviceId))
    .map((d) => ({ id: d.deviceId, label: d.label }));
}

/**
 * The name of the device the system default points at, when the browser says so. Chromium labels
 * the alias "Default - <device>" in the browser's language and gives it the device's group.
 */
export function systemDefaultLabel(devices: readonly DeviceInfo[]): string | null {
  const alias = devices.find((d) => d.kind === "audioinput" && d.deviceId === "default");
  if (!alias?.label) return null;
  const real = devices.filter(
    (d) => d.kind === "audioinput" && d.deviceId && !ALIASES.has(d.deviceId) && d.label,
  );
  const byName = real
    .filter((d) => alias.label.endsWith(d.label))
    .sort((a, b) => b.label.length - a.label.length)[0];
  const byGroup = real.find((d) => alias.groupId && d.groupId === alias.groupId);
  return (byName ?? byGroup)?.label ?? null;
}

/** The connected device for a saved choice: same id, else same name (ids reset with site data). */
export function resolveChoice(choice: MicChoice, mics: readonly MicDevice[]): MicDevice | null {
  return (
    mics.find((mic) => mic.id === choice.id) ??
    (choice.label ? mics.find((mic) => mic.label === choice.label) : undefined) ??
    null
  );
}

export function micErrorCode(error: unknown): MicErrorCode {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "not-allowed";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-microphone";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "other";
}

function isMissingDevice(error: unknown): boolean {
  return micErrorCode(error) === "no-microphone";
}

/* ---------- The saved choice (useSyncExternalStore-friendly: stable snapshots) ---------- */

export function parseMicChoice(raw: string | null): MicChoice | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
      const label = "label" in value && typeof value.label === "string" ? value.label : "";
      return value.id ? { id: value.id, label } : null;
    }
  } catch {}
  return null;
}

let cachedRaw: string | null = null;
let cachedChoice: MicChoice | null = null;
const listeners = new Set<() => void>();

export function readMicChoice(): MicChoice | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedChoice = parseMicChoice(raw);
  }
  return cachedChoice;
}

export function saveMicChoice(choice: MicChoice | null) {
  try {
    if (choice) localStorage.setItem(KEY, JSON.stringify({ id: choice.id, label: choice.label }));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function subscribeMicChoice(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/* ---------- Opening a microphone ---------- */

export async function listMicrophoneInfo(): Promise<DeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return navigator.mediaDevices.enumerateDevices();
}

function capture(constraints: MediaTrackConstraints | true): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: constraints });
}

/**
 * The system default input. Chromium's "default" alias follows the operating system even when the
 * browser remembers another device; elsewhere a plain request already means the system default.
 */
async function openSystemDefault(): Promise<MediaStream> {
  if (!userAgentData()) return capture(true);
  try {
    return await capture({ deviceId: { exact: "default" } });
  } catch (error) {
    if (!isMissingDevice(error)) throw error;
    return capture(true);
  }
}

/**
 * Opens the chosen microphone, or the system default when there is no choice or the chosen one is
 * not connected. Throws the browser's error (see `micErrorCode`) when no microphone can be opened.
 */
export async function openMicrophone(choice: MicChoice | null): Promise<OpenedMicrophone> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("No media devices", "NotFoundError");
  }
  if (!choice) return { stream: await openSystemDefault(), fellBack: false };

  try {
    return { stream: await capture({ deviceId: { exact: choice.id } }), fellBack: false };
  } catch (error) {
    if (!isMissingDevice(error)) throw error;
  }
  // The id may have changed (site data cleared) while the same device is still plugged in.
  const renamed = choice.label
    ? resolveChoice({ id: "", label: choice.label }, realMicrophones(await listMicrophoneInfo()))
    : null;
  if (renamed) {
    try {
      return { stream: await capture({ deviceId: { exact: renamed.id } }), fellBack: false };
    } catch (error) {
      if (!isMissingDevice(error)) throw error;
    }
  }
  return { stream: await openSystemDefault(), fellBack: true };
}

export function releaseMicrophone(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
