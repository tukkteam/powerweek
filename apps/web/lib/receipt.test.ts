import { describe, expect, it } from "vitest";
import { unmet } from "./receipt";

const rejection = (reason: "not_found" | "limit" | "noop" | "invalid" | "unavailable") => ({
  index: 0,
  op: "agenda.remove",
  reason,
});

describe("what the assistant could not do", () => {
  it("is nothing when every operation applied", () => {
    expect(unmet({ changes: 2, rejected: [], dropped: 0 })).toEqual({ count: 0, problem: null });
  });

  it("ignores a redundant operation next to real changes", () => {
    // "los lunes hago pierna" puts Training on screen; the model's own layout.add is then a no-op.
    expect(unmet({ changes: 2, rejected: [rejection("noop")], dropped: 0 })).toEqual({
      count: 0,
      problem: null,
    });
  });

  it("says so when nothing changed because it was already the case", () => {
    expect(unmet({ changes: 0, rejected: [rejection("noop")], dropped: 0 })).toEqual({
      count: 0,
      problem: "noop",
    });
  });

  it("reports the first real reason and counts everything that failed", () => {
    expect(
      unmet({
        changes: 1,
        rejected: [rejection("noop"), rejection("unavailable"), rejection("not_found")],
        dropped: 1,
      }),
    ).toEqual({ count: 3, problem: "unavailable" });
  });

  it("treats operations that did not validate as not understood", () => {
    expect(unmet({ changes: 0, rejected: [], dropped: 2 })).toEqual({
      count: 2,
      problem: "invalid",
    });
  });

  it("leaves a plain question alone", () => {
    expect(unmet({ changes: 0, rejected: [], dropped: 0 })).toEqual({ count: 0, problem: null });
  });
});
