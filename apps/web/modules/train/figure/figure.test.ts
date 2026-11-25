import { describe, expect, it } from "vitest";
import { ease } from "@/lib/motion";
import { MOVE_ROWS } from "../moves-data";
import { problems } from "./checks";
import { EXERCISES, FAMILIES, hasFigure, poseAt, viewOf } from "./library";
import { BODY, bendTo, blendPose, size, skeleton, sub, type Pose, type Vec } from "./rig";
import { CANVAS, draw, frame, nearer, project } from "./scene";

const far = (a: Vec, b: Vec) => size(sub(a, b));
const sway = ease("sway");

describe("the skeleton", () => {
  it("stands 100 tall, on the floor, the same on both sides", () => {
    const s = skeleton({});
    expect(s.head[1] + BODY.head).toBeCloseTo(100, 0);
    expect(s.ankleL[1]).toBeCloseTo(BODY.leg, 5);
    expect(s.ankleR[1]).toBeCloseTo(BODY.leg, 5);
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
    expect(blendPose(down, up, 0).armL?.flex).toBe(0);
    expect(blendPose(down, up, 1).armR?.flex).toBe(180);
  });

  it("blends each limb whole, however a pose says it", () => {
    // One key speaks of both legs, the next of each: the left leg must not pass through zero.
    const both: Pose = { legs: { flex: 60, bend: 80 } };
    const each: Pose = { legL: { flex: 60, bend: 80 }, legR: { flex: 10, bend: 0 } };
    const half = blendPose(both, each, 0.5);
    expect(half.legL).toEqual({ flex: 60, bend: 80 });
    expect(half.legR).toEqual({ flex: 35, bend: 40 });
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
      }
      // Nothing through the floor or off the canvas, every limb posed one way in every key.
      expect(problems(exercise, sway), slug).toEqual([]);
    }
  });

  it("are each laid out in one family", () => {
    const slugs = Object.values(FAMILIES).flatMap((family) => Object.keys(family));
    expect(new Set(slugs).size).toBe(slugs.length);
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
      const texts = [
        drawing.floor,
        ...drawing.parts.flatMap((part) => [part.shape, part.lines, part.halo]),
      ];
      for (const text of texts) expect(text, slug).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("set every part of the figure off from what is behind it, all the way round the loop", () => {
    for (const [slug, exercise] of all) {
      for (let phase = 0; phase < 1; phase += 0.1) {
        const drawn = draw(poseAt(exercise, phase, sway), exercise.gear ?? [], viewOf(exercise));
        // Always seven of the figure, so the picture keeps its structure while it moves. One
        // paints nothing: it clears the gap round the near legs where they join the trunk.
        const figure = drawn.parts.filter((part) => part.tone !== "gear");
        expect(figure, slug).toHaveLength(7);
        const parts = figure.filter((part) => part.shape);
        // Head, trunk, two arms, two legs: each with a shape and something to clear behind it.
        expect(parts, slug).toHaveLength(6);
        for (const part of parts) {
          expect(part.shape.length, slug).toBeGreaterThan(20);
          expect(part.halo.length, slug).toBeGreaterThan(20);
        }
        // Back to front: limbs on the far side, the trunk (the one part with an edge), the
        // head, limbs on the near side.
        const trunkAt = parts.findIndex((part) => part.edge > 0);
        expect(
          parts.filter((part) => part.edge > 0),
          slug,
        ).toHaveLength(1);
        expect(
          parts.slice(0, trunkAt).every((part) => part.tone === "far"),
          slug,
        ).toBe(true);
        expect(
          parts.slice(trunkAt).every((part) => part.tone === "body"),
          slug,
        ).toBe(true);
        expect(parts.length - trunkAt, slug).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("the gear", () => {
  it("draws the nearer of two weights larger, and two that are level alike", () => {
    expect(nearer(0)).toBe(1);
    for (const depth of [5, 15, 30, 45]) {
      expect(nearer(depth), String(depth)).toBeGreaterThan(1);
      expect(nearer(-depth), String(depth)).toBeLessThan(1);
      // As much larger on this side as smaller on that one.
      expect(nearer(depth) + nearer(-depth)).toBeCloseTo(2);
      expect(nearer(depth)).toBeGreaterThan(nearer(depth - 5));
    }
    // A barbell seen from its end; the same barbell seen nearly from the front.
    expect(nearer(29)).toBeGreaterThan(1.08);
    expect(nearer(9)).toBeLessThan(1.03);
  });

  it("is drawn at its size, with nothing added round it, in the same parts all the way round", () => {
    for (const [slug, exercise] of Object.entries(EXERCISES)) {
      const at = (phase: number) =>
        draw(poseAt(exercise, phase, sway), exercise.gear ?? [], viewOf(exercise)).parts;
      const count = at(0).length;
      for (let phase = 0; phase < 1; phase += 0.1) {
        const parts = at(phase);
        expect(parts, slug).toHaveLength(count);
        for (const part of parts.filter((one) => one.tone === "gear")) {
          expect(part.edge, slug).toBe(0);
          expect(part.halo, slug).toBe(part.shape);
        }
      }
    }
  });

  it("puts one plate of a barbell seen from its end beyond the figure and one this side", () => {
    const { parts } = draw(
      poseAt(EXERCISES.squat!, 0, sway),
      EXERCISES.squat!.gear ?? [],
      viewOf(EXERCISES.squat!),
    );
    const tones = parts.filter((part) => part.shape || part.lines).map((part) => part.tone);
    expect(tones[0]).toBe("gear");
    expect(tones.at(-1)).toBe("gear");
    expect(tones.filter((tone) => tone === "gear")).toHaveLength(2);
  });

  it("keeps a dumbbell with the arm that holds it", () => {
    const curl = EXERCISES["bicep-curl"]!;
    for (const phase of [0, 0.25, 0.5]) {
      const { parts } = draw(poseAt(curl, phase, sway), curl.gear ?? [], viewOf(curl));
      const gear = parts.flatMap((part, k) => (part.tone === "gear" && part.shape ? [k] : []));
      // Two dumbbells, each next to an arm: one of them with the arm on the far side.
      expect(gear).toHaveLength(2);
      for (const k of gear) expect(parts[k - 1]!.tone).not.toBe("gear");
      expect(parts[gear[0]! - 1]!.tone).toBe("far");
      expect(parts[gear[1]! - 1]!.tone).toBe("body");
    }
  });
});
