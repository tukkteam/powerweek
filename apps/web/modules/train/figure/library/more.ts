/** Cardio, stretches, and the odd piece of kit: a kettlebell, a plate. */
import { SIDE, type Family } from "./kit";

const family: Family = {
  "kettlebell-swing": {
    view: SIDE,
    gear: [{ kind: "kettlebell" }],
    keys: [
      { lean: 58, legs: { flex: 58, bend: 42 }, arms: { flex: 22, abduct: -18, bend: 4 } },
      { lean: -3, legs: { flex: 0, bend: 0 }, arms: { flex: 88, abduct: -18, bend: 4 } },
    ],
  },
};

export default family;
