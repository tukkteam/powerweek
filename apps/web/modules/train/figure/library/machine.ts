/** Machines: a seat, pads and a lever or a stack, laid out from the pieces in kit.ts. */
import {
  BENCH_HIGH,
  REST,
  SIDE,
  backrest,
  post,
  seatPad,
  type Family,
  type Gear,
  type Vec,
} from "./kit";

/** Where the hips are on a machine's seat. */
const SEAT: Vec = [0, BENCH_HIGH + 6 + REST, 0];
/** The weight stack behind a seated machine, and the post that carries its seat. */
const stack = (z: number): Gear => ({ kind: "box", at: [0, 0, z], wide: 14, deep: 9, high: 62 });

const family: Family = {
  "leg-extension": {
    view: SIDE,
    gear: [
      seatPad(SEAT, 19),
      backrest(SEAT, -14, 36),
      post([0, SEAT[1] - 9, 4]),
      stack(-24),
      // The lever turns about the knees and carries the roller the shins push against.
      { kind: "rail", points: [[0, SEAT[1] - 6, 21], "ankles"] },
      { kind: "plate", at: "ankles", along: [1, 0, 0], radius: 3.6, thick: 16, place: "front" },
    ],
    keys: [
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 96 }, arms: { grip: [10, -30, 4] } },
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 8 }, arms: { grip: [10, -30, 4] } },
    ],
  },
};

export default family;
