import { describe, expect, it } from "vitest";
import { ease } from "@/lib/motion";
import { MOVE_ROWS } from "../moves-data";
import { EXERCISES, hasFigure, poseAt, viewOf } from "./library";
import { BODY, bendTo, blendPose, size, skeleton, sub, type Pose, type Vec } from "./rig";
import { CANVAS, draw, frame, project } from "./scene";

const far = (a: Vec, b: Vec) => size(sub(a, b));
const sway = ease("sway");

describe("the skeleton", () => {
  it("stands 100 tall, on the floor, the same on both sides", () => {
    const s = skeleton({});
    expect(s.head[1] + BODY.head).toBeCloseTo(100, 0);
    expect(s.ankleL[1]).toBeCloseTo(BODY.ankle, 5);
    expect(s.ankleR[1]).toBeCloseTo(BODY.ankle, 5);
    expect(s.shoulderL[0]).toBeCloseTo(-s.shoulderR[0], 5);
    expect(s.wristL[1]).toBeCloseTo(s.wristR[1], 5);
    // Ankles either side of the origin.
    expect(s.ankleL[0] + s.ankleR[0]).toBeCloseTo(0, 5);
    expect(s.ankleL[2]).toBeCloseTo(0, 5);
  });

  it("moves joints the way their angles say", () => {
    // Arms raised forward to shoulder height: hands ahead, level with the shoulders.
    const ahead = skeleton({ arms: { flex: 90 } });
    expect(ahead.wristR[2] - ahead.shoulderR[2]).toBeCloseTo(BODY.upperArm + BODY.forearm, 4);
    expect(ahead.wristR[1]).toBeCloseTo(ahead.shoulderR[1], 4);
    // Out to the side: each hand on its own side.
    const out = skeleton({ arms: { abduct: 90 } });
    expect(out.wristR[0]).toBeGreaterThan(out.shoulderR[0] + 30);
    expect(out.wristL[0]).toBeLessThan(out.shoulderL[0] - 30);
    // An elbow bent to a right angle brings the forearm forward.
    const bent = skeleton({ arms: { bend: 90 } });
    expect(bent.wristR[2] - bent.elbowR[2]).toBeCloseTo(BODY.forearm, 4);
    // Sitting: thighs level, shins hanging.
    const sat = skeleton({ at: [0, 40, 0], legs: { flex: 90, bend: 90 } });
    expect(sat.kneeR[1]).toBeCloseTo(40, 4);
    expect(sat.kneeR[2]).toBeCloseTo(BODY.thigh, 4);
    expect(sat.ankleR[1]).toBeCloseTo(40 - BODY.shin, 4);
    // Leaning forward takes the head forward and down.
    const lean = skeleton({ lean: 45 });
    expect(lean.head[2]).toBeGreaterThan(20);
    expect(lean.head[1]).toBeLessThan(skeleton({}).head[1]);
  });

  it("lies down and hangs: the body goes where it is put", () => {
    const supine = skeleton({ at: [0, 30, 0], pitch: -90 });
    expect(supine.chest[1]).toBeCloseTo(30, 4);
    expect(supine.chest[2]).toBeCloseTo(-BODY.spine, 4);
    const pinned = skeleton({
      pitch: 70,
      pin: { what: "toes", to: [0, 2, -50] },
      legs: { point: 60 },
    });
    expect((pinned.toeL[2] + pinned.toeR[2]) / 2).toBeCloseTo(-50, 4);
    expect((pinned.toeL[1] + pinned.toeR[1]) / 2).toBeCloseTo(2, 4);
  });

  it("bends a limb to reach a point, keeping its bones their length", () => {
    const { middle, end } = bendTo([0, 0, 0], [20, 0, 0], 16, 15, [0, -1, 0]);
    expect(far(end, [20, 0, 0])).toBeLessThan(1e-6);
    expect(far(middle, [0, 0, 0])).toBeCloseTo(16, 5);
    expect(far(middle, end)).toBeCloseTo(15, 5);
    expect(middle[1]).toBeLessThan(0); // the elbow points the way it was told
    // Out of reach: it stretches towards the point and stops.
    const short = bendTo([0, 0, 0], [100, 0, 0], 16, 15, [0, -1, 0]);
    expect(short.end[0]).toBeCloseTo(31, 1);

    const s = skeleton({ arms: { reach: [14, 60, 20] }, armL: { reach: [-14, 60, 20] } });
    expect(far(s.handR, [14, 60, 20])).toBeLessThan(1e-6);
    expect(far(s.handL, [-14, 60, 20])).toBeLessThan(1e-6);
    expect(far(s.shoulderR, s.elbowR)).toBeCloseTo(BODY.upperArm, 5);
    expect(far(s.elbowR, s.wristR)).toBeCloseTo(BODY.forearm, 5);
  });

  it("blends poses by angle, so a limb swings instead of shrinking", () => {
    const down: Pose = { arms: { flex: 0 } };
    const up: Pose = { arms: { flex: 180 } };
    const half = skeleton(blendPose(down, up, 0.5));
    // Halfway from hanging to overhead is straight ahead, at full length.
    expect(far(half.shoulderR, half.wristR)).toBeCloseTo(BODY.upperArm + BODY.forearm, 4);
    expect(half.wristR[2] - half.shoulderR[2]).toBeCloseTo(BODY.upperArm + BODY.forearm, 4);
    expect(blendPose(down, up, 0).arms?.flex).toBe(0);
    expect(blendPose(down, up, 1).arms?.flex).toBe(180);
  });
});

describe("the view", () => {
  it("shows the figure face on, from its side, or anywhere between", () => {
    const right: Vec = [10, 50, 0];
    const ahead: Vec = [0, 50, 10];
    // Face on: the figure's right is on our left; what is ahead of it is nearer us.
    expect(project(right, { yaw: 0 })[0]).toBeLessThan(CANVAS / 2);
    expect(project(ahead, { yaw: 0 })[2]).toBeGreaterThan(0);
    // From its right side: it faces right, and its right side is nearer us.
    expect(project(ahead, { yaw: 90 })[0]).toBeGreaterThan(CANVAS / 2);
    expect(project(right, { yaw: 90 })[2]).toBeGreaterThan(0);
    // Higher is further up the canvas.
    expect(project([0, 80, 0], { yaw: 40 })[1]).toBeLessThan(project([0, 10, 0], { yaw: 40 })[1]);
  });

  it("frames a scene so everything fits, whatever the pose", () => {
    const poses: Pose[] = [{}, { arms: { flex: 180 } }, { at: [0, 8, 0], pitch: 90 }];
    const view = frame(poses, [], { yaw: 70 });
    for (const pose of poses)
      for (const joint of Object.values(skeleton(pose))) {
        const [x, y] = project(joint, view);
        expect(x).toBeGreaterThan(4);
        expect(x).toBeLessThan(CANVAS - 4);
        expect(y).toBeGreaterThan(4);
        expect(y).toBeLessThan(CANVAS - 4);
      }
  });
});

describe("the exercises", () => {
  const all = Object.entries(EXERCISES);

  it("are moves in the catalogue", () => {
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const [slug] of all) {
      expect(
        MOVE_ROWS.some(([s]) => s === slug),
        slug,
      ).toBe(true);
      expect(hasFigure(slug)).toBe(true);
    }
    expect(hasFigure("not-a-move")).toBe(false);
    expect(hasFigure(undefined)).toBe(false);
  });

  it("keep the figure whole and on the canvas all the way through the loop", () => {
    for (const [slug, exercise] of all) {
      const view = viewOf(exercise);
      for (let phase = 0; phase < 1; phase += 0.05) {
        const s = skeleton(poseAt(exercise, phase, sway));
        // Bones never change length: nothing stretches as it moves.
        for (const side of ["L", "R"] as const) {
          expect(far(s[`shoulder${side}`], s[`elbow${side}`]), `${slug} upper arm`).toBeCloseTo(
            BODY.upperArm,
            3,
          );
          expect(far(s[`elbow${side}`], s[`wrist${side}`]), `${slug} forearm`).toBeCloseTo(
            BODY.forearm,
            3,
          );
          expect(far(s[`hip${side}`], s[`knee${side}`]), `${slug} thigh`).toBeCloseTo(
            BODY.thigh,
            3,
          );
          expect(far(s[`knee${side}`], s[`ankle${side}`]), `${slug} shin`).toBeCloseTo(
            BODY.shin,
            3,
          );
        }
        for (const [name, joint] of Object.entries(s)) {
          expect(joint.every(Number.isFinite), `${slug} ${name}`).toBe(true);
          // Nothing goes through the floor.
          expect(joint[1], `${slug} ${name} at ${phase.toFixed(2)}`).toBeGreaterThan(-0.5);
          const [x, y] = project(joint, view);
          expect(
            x > 2 && x < CANVAS - 2 && y > 2 && y < CANVAS - 2,
            `${slug} ${name} off the canvas`,
          ).toBe(true);
        }
      }
    }
  });

  it("start and end the loop on the first pose, and reach the last halfway", () => {
    for (const [, exercise] of all) {
      const first = skeleton(exercise.keys[0]);
      const last = skeleton(exercise.keys.at(-1)!);
      expect(far(skeleton(poseAt(exercise, 0, sway)).handR, first.handR)).toBeLessThan(1e-6);
      expect(far(skeleton(poseAt(exercise, 0.5, sway)).handR, last.handR)).toBeLessThan(1e-6);
      expect(far(skeleton(poseAt(exercise, 0.999, sway)).handR, first.handR)).toBeLessThan(0.5);
    }
  });

  it("draw as paths with nothing left undefined", () => {
    for (const [slug, exercise] of all) {
      const drawing = draw(poseAt(exercise, 0.3, sway), exercise.gear ?? [], viewOf(exercise));
      for (const [layer, value] of Object.entries(drawing)) {
        if (typeof value !== "string") continue;
        expect(value, `${slug} ${layer}`).not.toMatch(/NaN|undefined|Infinity/);
      }
      expect(drawing.torso.startsWith("M")).toBe(true);
      expect(drawing.head.length).toBeGreaterThan(20);
      expect(drawing.back.length + drawing.front.length).toBeGreaterThan(200);
    }
  });
});
