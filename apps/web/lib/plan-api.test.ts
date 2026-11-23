import { describe, expect, it } from "vitest";
import { week } from "@/modules/test-kit";
import { PlanError, readPlan } from "./plan-api";

describe("reading a stored plan", () => {
  it("returns the plan when this build recognises it", () => {
    expect(readPlan(week()).layout).toEqual(["agenda", "train", "fuel", "notes"]);
  });

  it("refuses what it does not recognise, instead of showing an empty plan", () => {
    for (const raw of [undefined, null, {}, { schemaVersion: 3, layout: [], modules: {} }]) {
      let thrown: unknown;
      try {
        readPlan(raw);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(PlanError);
      expect((thrown as PlanError).isOutdated).toBe(true);
    }
  });
});
