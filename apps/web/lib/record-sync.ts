import type { Json } from "@tukkteam/modules";
import { entryKey, type Entries } from "@/lib/plan-api";

/** One dated fact to store; a null value removes it. */
export interface Fact {
  isoDate: string;
  module: string;
  key: string;
  value: Json | null;
}

export interface RecordSyncOptions {
  /** Read every fact in view; null when it could not be read. */
  read(): Promise<Entries | null>;
  /** Store one fact; false when it could not be stored. */
  write(fact: Fact): Promise<boolean>;
  /** Put these facts on screen. */
  show(entries: Entries): void;
  /** Say that something could not be saved. */
  failed(): void;
}

export interface RecordSync {
  /** Fetch what is stored and show it, unless what is on screen is newer. */
  load(): Promise<void>;
  /** Show a fact at once and store it. */
  set(isoDate: string, module: string, key: string, value: Json | null): void;
  /** Look again if an earlier look was missed (the network is back, say). */
  retry(): void;
  /** Stop touching the screen; writes already on their way still finish. */
  dispose(): void;
}

/**
 * Keeps the dated facts on screen and the ones stored telling the same story.
 *
 * A tap shows at once and is written behind it. Writes to the same fact go out one after
 * another, so two quick taps on a counter cannot overtake each other, and a slow one never
 * holds back the facts next to it. A write that fails puts that fact back to what is stored. A
 * read is only shown when nothing was tapped or still being written while it was on its way;
 * otherwise it is taken again once things are quiet.
 */
export function createRecordSync(options: RecordSyncOptions): RecordSync {
  /** What the database is known to hold. */
  let stored: Entries = new Map();
  /** What the person sees: what is stored, plus what they tapped and is still on its way. */
  let shown: Entries = new Map();
  const chains = new Map<string, Promise<void>>();
  let pending = 0;
  /** Counts taps, to tell whether one happened while a read was on its way. */
  let taps = 0;
  /** A read was missed or not shown: look again when things are quiet. */
  let stale = false;
  let disposed = false;

  const publish = () => {
    if (!disposed) options.show(new Map(shown));
  };

  const put = (entries: Entries, id: string, value: Json | null | undefined) => {
    if (value === null || value === undefined) entries.delete(id);
    else entries.set(id, value);
  };

  const load = async (): Promise<void> => {
    // A few tries in a row at most: each one only repeats when a tap got in the way.
    for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
      const before = taps;
      const quiet = pending === 0;
      const fresh = await options.read().catch(() => null);
      if (disposed) return;
      if (fresh && quiet && before === taps) {
        stale = false;
        stored = new Map(fresh);
        shown = new Map(fresh);
        publish();
        return;
      }
      stale = true;
      // A write still on its way asks again when it settles; a failed read waits for `retry`.
      if (!fresh || pending > 0) return;
    }
  };

  const set = (isoDate: string, module: string, key: string, value: Json | null) => {
    const id = entryKey(isoDate, module, key);
    taps += 1;
    pending += 1;
    put(shown, id, value);
    publish();
    const run: Promise<void> = (chains.get(id) ?? Promise.resolve())
      .then(() => options.write({ isoDate, module, key, value }))
      .catch(() => false)
      .then((ok) => {
        pending -= 1;
        const last = chains.get(id) === run;
        if (last) chains.delete(id);
        if (ok) {
          put(stored, id, value);
        } else {
          options.failed();
          // It may or may not have reached the database: look again when possible.
          stale = true;
          // Nothing later is queued for this fact, so show what is known to be stored for it.
          if (last) {
            put(shown, id, stored.get(id));
            publish();
          }
        }
        if (stale && pending === 0) void load();
      });
    chains.set(id, run);
  };

  return {
    load,
    set,
    retry: () => {
      if (stale && pending === 0) void load();
    },
    dispose: () => {
      disposed = true;
    },
  };
}
