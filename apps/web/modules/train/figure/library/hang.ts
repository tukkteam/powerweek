/** Hanging and pulling with the body, and back work lying face down. */
import { type Family } from "./kit";

const family: Family = {
  "pull-up": {
    view: { yaw: 24 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 64.5, 0],
        legs: { flex: 4, bend: 20 },
        arms: { reach: [17, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-17, 126, 0] },
      },
      {
        at: [0, 86, 2],
        legs: { flex: 8, bend: 28 },
        arms: { reach: [17, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-17, 126, 0] },
      },
    ],
  },
  "hanging-knee-raise": {
    view: { yaw: 60 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 64.5, 0],
        legs: { flex: 4, bend: 8 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
      {
        at: [0, 64.5, -2],
        lean: 8,
        legs: { flex: 98, bend: 104 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
    ],
  },
};

export default family;
