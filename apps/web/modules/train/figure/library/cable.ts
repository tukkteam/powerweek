/** Cable machines: a column, a pulley, a cable to the hands. */
import { type Family } from "./kit";

const family: Family = {
  "lat-pulldown": {
    view: { yaw: 52 },
    gear: [
      { kind: "bench", from: [0, 0, -9], to: [0, 0, 9], high: 28 },
      {
        kind: "rail",
        points: [
          [0, 0, -26],
          [0, 132, -26],
          [0, 132, 4],
        ],
      },
      { kind: "cable", from: [0, 132, 4] },
      { kind: "handle", wide: 48 },
    ],
    keys: [
      {
        at: [0, 33, 0],
        lean: -4,
        legs: { plant: [7, 4, 23] },
        legL: { plant: [-7, 4, 23] },
        arms: { reach: [21, 93, 4], elbow: [0.9, -0.5, -0.1] },
        armL: { reach: [-21, 93, 4] },
      },
      {
        at: [0, 33, 0],
        lean: -12,
        legs: { plant: [7, 4, 23] },
        legL: { plant: [-7, 4, 23] },
        arms: { reach: [18, 67, 5], elbow: [0.9, -0.5, -0.1] },
        armL: { reach: [-18, 67, 5] },
      },
    ],
  },
};

export default family;
