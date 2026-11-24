import { describe, expect, it } from "vitest";
import { cardUnder, moveTo, pressKey, sameOrder, type Arrangement, type Box } from "./arrange";

const order = ["agenda", "fuel", "train", "notes"];
const idle: Arrangement = { order, held: null };

/** Presses keys on one module's handle, one after another, and keeps every announcement. */
function press(start: Arrangement, id: string, keys: string[]) {
  let state = start;
  const events = [];
  for (const key of keys) {
    const result = pressKey(state, id, key);
    if (!result) {
      events.push(null);
      continue;
    }
    state = result.state;
    events.push(result.event);
  }
  return { state, events };
}

describe("moveTo", () => {
  it("moves a module to a place and shifts the others", () => {
    expect(moveTo(order, "notes", 0)).toEqual(["notes", "agenda", "fuel", "train"]);
    expect(moveTo(order, "agenda", 2)).toEqual(["fuel", "train", "agenda", "notes"]);
  });

  it("clamps the place to either end and ignores modules that are not there", () => {
    expect(moveTo(order, "fuel", -3)).toEqual(["fuel", "agenda", "train", "notes"]);
    expect(moveTo(order, "fuel", 99)).toEqual(["agenda", "train", "notes", "fuel"]);
    expect(moveTo(order, "habits", 0)).toEqual(order);
  });

  it("never changes the order it was given", () => {
    const before = [...order];
    moveTo(order, "notes", 0);
    expect(order).toEqual(before);
  });
});

describe("sameOrder", () => {
  it("compares places, not only members", () => {
    expect(sameOrder(order, [...order])).toBe(true);
    expect(sameOrder(order, ["fuel", "agenda", "train", "notes"])).toBe(false);
    expect(sameOrder(order, order.slice(0, 3))).toBe(false);
  });
});

describe("pressKey", () => {
  it("picks up with Space or Enter and says where the module is", () => {
    for (const key of [" ", "Enter"]) {
      const result = pressKey(idle, "fuel", key);
      expect(result?.state.held).toEqual({ id: "fuel", origin: order });
      expect(result?.event).toEqual({ kind: "picked", id: "fuel", place: 2, total: 4 });
    }
  });

  it("leaves every other key to the browser until a module is held", () => {
    for (const key of ["ArrowDown", "Escape", "Tab", "a"])
      expect(pressKey(idle, "fuel", key)).toBeNull();
    expect(pressKey(idle, "habits", " ")).toBeNull();
  });

  it("moves the held module one place per arrow, then drops it", () => {
    const { state, events } = press(idle, "agenda", [" ", "ArrowDown", "ArrowRight", "Enter"]);
    expect(state).toEqual({ order: ["fuel", "train", "agenda", "notes"], held: null });
    expect(events.map((event) => event && [event.kind, event.place])).toEqual([
      ["picked", 1],
      ["moved", 2],
      ["moved", 3],
      ["dropped", 3],
    ]);
  });

  it("treats up and left as earlier, Home and End as either end", () => {
    const held = pressKey(idle, "train", " ")!.state;
    expect(press(held, "train", ["ArrowUp"]).state.order).toEqual([
      "agenda",
      "train",
      "fuel",
      "notes",
    ]);
    expect(press(held, "train", ["ArrowLeft", "ArrowLeft"]).state.order[0]).toBe("train");
    expect(press(held, "train", ["Home"]).state.order[0]).toBe("train");
    expect(press(held, "train", ["End"]).state.order.at(-1)).toBe("train");
  });

  it("keeps an arrow at either end, so the page does not scroll, and announces nothing", () => {
    const held = pressKey(idle, "agenda", " ")!.state;
    const result = pressKey(held, "agenda", "ArrowUp");
    expect(result).toEqual({ state: held, event: null });
  });

  it("puts the module back where it was picked up on Escape", () => {
    const { state, events } = press(idle, "notes", [" ", "Home", "ArrowDown", "Escape"]);
    expect(state).toEqual({ order, held: null });
    expect(events.at(-1)).toEqual({ kind: "cancelled", id: "notes", place: 4, total: 4 });
  });

  it("leaves keys it does not use to the browser while a module is held", () => {
    const held = pressKey(idle, "fuel", " ")!.state;
    expect(pressKey(held, "fuel", "Tab")).toBeNull();
    expect(pressKey(held, "fuel", "x")).toBeNull();
  });

  it("a key on another module's handle picks that one up instead", () => {
    const held = pressKey(idle, "fuel", " ")!.state;
    const result = pressKey(held, "notes", "Enter");
    expect(result?.state.held?.id).toBe("notes");
  });
});

describe("cardUnder", () => {
  // Two columns: a tall agenda on the left, fuel and notes stacked on the right.
  const boxes = new Map<string, Box>([
    ["agenda", { left: 0, top: 0, width: 100, height: 300 }],
    ["fuel", { left: 120, top: 0, width: 100, height: 100 }],
    ["notes", { left: 120, top: 120, width: 100, height: 100 }],
  ]);

  it("finds the card under the pointer, but never the one being dragged", () => {
    expect(cardUnder(50, 50, boxes, "notes", null)).toEqual({ target: "agenda", skip: "agenda" });
    expect(cardUnder(150, 150, boxes, "notes", null)).toEqual({ target: null, skip: null });
  });

  it("finds nothing in the gaps between cards", () => {
    expect(cardUnder(110, 50, boxes, "notes", null)).toEqual({ target: null, skip: null });
  });

  it("does not trade back with the card it just traded with until the pointer leaves it", () => {
    expect(cardUnder(50, 250, boxes, "notes", "agenda")).toEqual({ target: null, skip: "agenda" });
    // Out of it, the guard is gone; another card counts at once.
    expect(cardUnder(110, 250, boxes, "notes", "agenda")).toEqual({ target: null, skip: null });
    expect(cardUnder(150, 50, boxes, "notes", "agenda")).toEqual({ target: "fuel", skip: "fuel" });
  });
});
