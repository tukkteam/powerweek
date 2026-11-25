/** Dumbbells for the upper body: presses, raises, rows, curls, triceps. */
import { FRONT, type Family } from "./kit";

const family: Family = {
  "bicep-curl": {
    view: { yaw: 72 },
    gear: [{ kind: "dumbbells" }],
    keys: [{ arms: { flex: 2, abduct: 5, bend: 6 } }, { arms: { flex: 14, abduct: 5, bend: 140 } }],
  },
  "lateral-raise": {
    view: FRONT,
    gear: [{ kind: "dumbbells", along: [0, 0, 1] }],
    keys: [{ arms: { abduct: 9, bend: 12 } }, { arms: { abduct: 88, flex: 8, bend: 14 } }],
  },
};

export default family;
