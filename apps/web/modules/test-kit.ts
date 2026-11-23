import { sequentialIds, type Doc, type Operation } from "@tukkteam/modules";
import type { Agenda } from "./agenda/module";
import type { Fuel } from "./fuel/module";
import { agenda, fuel, kernel, notes, train } from "./index";
import type { Notes } from "./notes/module";
import type { Train } from "./train/module";

/** Helpers for module tests: a week with every module on screen, and a deterministic run. */

export interface WeekData {
  agenda: Agenda;
  train: Train;
  fuel: Fuel;
  notes: Notes;
}

/** Order used by the tests; the same as the categories of plan version 1. */
export const SCREEN = ["agenda", "train", "fuel", "notes"];

export function week(build?: (data: WeekData) => void): Doc {
  const data: WeekData = {
    agenda: agenda.empty(),
    train: train.empty(),
    fuel: fuel.empty(),
    notes: notes.empty(),
  };
  build?.(data);
  return {
    schemaVersion: 2,
    layout: [...SCREEN],
    modules: {
      agenda: { v: 1, data: data.agenda },
      train: { v: 1, data: data.train },
      fuel: { v: 1, data: data.fuel },
      notes: { v: 1, data: data.notes },
    },
  };
}

/** Read stored JSON the test knows to be a plan. */
export function open(raw: unknown): Doc {
  const doc = kernel.read(raw);
  if (!doc) throw new Error("Not a plan");
  return doc;
}

export function run(doc: Doc, operations: Operation[], prefix = "id") {
  return kernel.apply(doc, operations, { newId: sequentialIds(prefix), lang: "es" });
}

export const read = (doc: Doc): WeekData => ({
  agenda: kernel.state(doc, agenda),
  train: kernel.state(doc, train),
  fuel: kernel.state(doc, fuel),
  notes: kernel.state(doc, notes),
});
