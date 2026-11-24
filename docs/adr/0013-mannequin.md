# 0013 · Exercises are performed by a mannequin laid out from parts

Date: 2026-11-24 · Status: Proposed

## Context

The move library (ADR 0008) gives three drawings per exercise. Redrawn with one pen, simplified and lined up, they are consistent, but they are still three poses by different hands: only about a third of the in-between poses that would make them move could be derived without tearing the figure. Smooth movement for every exercise needs poses the library does not have, and at the size of a card a line drawing of a body reads less well than a silhouette.

The owner chose to try a figure of our own: a jointed mannequin, with the gear (a bench, a barbell, a machine) designed separately, so that an exercise becomes a layout of parts made beforehand. Quality comes first; the look is the lime silhouette of the rest of the app.

## Decision

Proposed, and built far enough to judge (twelve exercises):

- **A skeleton, not drawings** (`apps/web/modules/train/figure/rig.ts`). A pose is a handful of joint angles in a trainer's words (hip flexion, elbow bend, how far the torso leans), or a limb told what to hold (`reach`, `grip`, `plant`), which is how hands stay on a bar and feet on the floor. The figure stands 100 units tall in a space with a floor.
- **A silhouette** (`scene.ts`). Head, torso and tapering limbs in the current colour, nothing drawn on them. Depth is shown as pictograms show it: limbs on the far side are dimmer, a limb passing in front of the body is set off by a thin gap, gear is dimmer than the figure.
- **Gear as parts** (`Gear` in `scene.ts`): barbell, dumbbells, kettlebell, bench, bar, box, cable, handle, rail. Each is drawn in space like the figure, so one bench serves every exercise from every side, and a machine is a few of them together.
- **An exercise is a layout** (`library.ts`): where it is seen from, its gear, and two or three key poses. The view is framed automatically so every exercise fills its card.
- **Movement is computed, not stored.** `Figure` blends the key poses by angle, sixty times a second, so limbs swing round their joints; there are no frames. Reduced motion shows the first pose.
- `MoveArt` uses the mannequin for the moves it knows and the drawn frames for the rest.

## Consequences

- No tearing, no stand-ins, any number of "frames", one style: the problems of ADR 0008's update go away for every exercise the mannequin knows.
- 290 exercises are still to be laid out. Each is a few lines copied from the nearest one; seen-from-the-side lifts, hangs, floor work and one cable machine exist as patterns. Until then the app shows two styles side by side, which is not a state to ship: either the mannequin covers the library first, or it is switched on only once it does.
- Machines need more parts (a seat with a back, a lever arm, a weight stack), and a few exercises need things the rig does not do yet: a hand resting on a knee, a foot on a box, a resistance band round the legs.
- The figure is ours, so the CC BY-SA terms of the drawn library do not apply to it. The catalogue (names, muscles) still comes from Workout Guide.
- If the mannequin replaces the drawn frames entirely, `scripts/moves/` and `public/moves` can go, and with them about 6 MB of the repository.
