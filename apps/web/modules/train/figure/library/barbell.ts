/** Barbell lifts, and what is done with a landmine or an EZ bar. */
import { FRONT, SIDE, type Family } from "./kit";

const family: Family = {
  squat: {
    view: SIDE,
    gear: [{ kind: "barbell" }],
    keys: [
      { lean: 4, arms: { grip: [15, 1.5, -5] } },
      { lean: 40, legs: { flex: 100, bend: 112 }, arms: { grip: [15, 1.5, -5] } },
    ],
  },
  deadlift: {
    view: SIDE,
    gear: [{ kind: "barbell" }],
    keys: [
      { lean: 2, arms: { reach: [14, 47, 7] }, armL: { reach: [-14, 47, 7] } },
      {
        lean: 62,
        legs: { flex: 62, bend: 58 },
        arms: { reach: [14, 21, 12] },
        armL: { reach: [-14, 21, 12] },
      },
    ],
  },
  "bench-press": {
    view: { yaw: 64 },
    gear: [{ kind: "bench", from: [0, 0, -43], to: [0, 0, 11] }, { kind: "barbell" }],
    keys: [
      {
        at: [0, 32, 6],
        pitch: -90,
        legs: { plant: [9, 4, 34] },
        legL: { plant: [-9, 4, 34] },
        arms: { reach: [17, 64, -19], elbow: [0.8, -0.5, -0.4] },
        armL: { reach: [-17, 64, -19] },
      },
      {
        at: [0, 32, 6],
        pitch: -90,
        legs: { plant: [9, 4, 34] },
        legL: { plant: [-9, 4, 34] },
        arms: { reach: [17, 43, -17], elbow: [0.8, -0.5, -0.4] },
        armL: { reach: [-17, 43, -17] },
      },
    ],
  },
  "overhead-press": {
    view: FRONT,
    gear: [{ kind: "barbell" }],
    keys: [
      { arms: { grip: [14, 1, 7], elbow: [0.5, -0.8, 0.2] } },
      { arms: { grip: [13, 31, 1], elbow: [0.9, -0.3, 0.1] } },
    ],
  },
};

export default family;
