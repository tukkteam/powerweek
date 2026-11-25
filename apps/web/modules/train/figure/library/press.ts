/** Pressing with the body: push-ups, dips, planks and their kin, on the floor or a wall. */
import { type Family } from "./kit";

const family: Family = {
  "push-up": {
    view: { yaw: 78 },
    keys: [
      {
        pitch: 66,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [14, 3.7, 20], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-14, 3.7, 20] },
      },
      {
        pitch: 82,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [14, 3.7, 20], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-14, 3.7, 20] },
      },
    ],
  },
  plank: {
    view: { yaw: 78 },
    keys: [
      {
        pitch: 78.5,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [13, 3.7, 40], elbow: [0.1, -0.3, 1] },
        armL: { reach: [-13, 3.7, 40] },
      },
      {
        pitch: 79.5,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [13, 3.7, 40], elbow: [0.1, -0.3, 1] },
        armL: { reach: [-13, 3.7, 40] },
      },
    ],
  },
};

export default family;
