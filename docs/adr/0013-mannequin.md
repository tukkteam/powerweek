# 0013 · Exercises are performed by a mannequin laid out from parts

Date: 2026-11-24 · Status: Accepted (2026-11-25)

## Context

The move library (ADR 0008) gives three drawings per exercise. Redrawn with one pen, simplified and lined up, they are consistent, but they are still three poses by different hands: only about a third of the in-between poses that would make them move could be derived without tearing the figure. Smooth movement for every exercise needs poses the library does not have, and at the size of a card a line drawing of a body reads less well than a silhouette.

The owner chose to try a figure of our own: a jointed mannequin, with the gear (a bench, a barbell, a machine) designed separately, so that an exercise becomes a layout of parts made beforehand. Quality comes first; the look is the lime silhouette of the rest of the app.

## Decision

Tried on twelve exercises, chosen by the owner, and then built for the whole catalogue (302 exercises):

- **A skeleton, not drawings** (`apps/web/modules/train/figure/rig.ts`). A pose is a handful of joint angles in a trainer's words (hip flexion, elbow bend, how far the torso leans), or a limb told what to hold (`reach`, `grip`, `plant`), which is how hands stay on a bar and feet on the floor. The figure stands 100 units tall in a space with a floor.
- **The figure of signs** (`scene.ts`, `BODY` in `rig.ts`). The first version had a broad torso and tapering limbs, and the owner disliked the step where the legs met it. He asked for the figure of road signs and public signage instead. That figure has a published construction, the unit system of the standard pictorial figure (ISO 3864-3, Annex A; the AEM pictorial guidelines give the numbers): 12 units tall, a trunk 2 units wide, a round head 1.75 units across detached from the body, limbs 1 unit wide ending in half circles, pivots at shoulder, elbow, hand, hip, knee and foot, proportions fixed in every pose. The mannequin is built to it. Because two legs are as wide as the trunk, the step is gone by construction.
- **Depth**, which a sign does not need: limbs on the far side are dimmer, gear is dimmer than the figure, and every part of the picture, of the body or of the gear, is set off by the same thin gap from whatever lies behind it (except a near leg where it leaves the trunk, so the two read as one body). Of two weights alike, the nearer is drawn larger.
- **Gear as parts** (`Gear` in `gear.ts`): weights (barbell, landmine, dumbbells, kettlebell, plate, ball), things to rest on (bench, pad, box) and lines (bar, rail, handle, cable, rope). A part can be fixed to a joint, so a cable follows a hand and a roller an ankle. Each is drawn in space like the figure, at one set of sizes, so one bench serves every exercise from every side, and a machine is a few of them together. Each piece has its place among the parts of the figure: a plate beyond it or this side of it, a dumbbell with the arm that holds it.
- **An exercise is a layout**: where it is seen from, its gear, and two or three key poses. The view is framed automatically so every exercise fills its card. Exercises live by family in `figure/library/` and share a kit of views, places to put a body and gear in several pieces, so the machines read as one maker's range and variants of a movement differ only in what makes them different.
- **Looked at, and checked.** `pnpm figure` draws any exercises to a PNG contact sheet with the component the app uses; `checks.ts` says what is wrong with one (through the floor, off the canvas, a limb posed two ways), for that script and for the tests.
- **Movement is computed, not stored.** `Figure` blends the key poses by angle, sixty times a second, so limbs swing round their joints; there are no frames. Reduced motion shows the first pose.
- `MoveArt` uses the mannequin for the moves it knows and the drawn frames for the rest.

## Consequences

- No tearing, no stand-ins, any number of "frames", one style: the problems of ADR 0008's update go away for every exercise the mannequin knows.
- Every move in the catalogue has a figure, so the app shows one style. A move added to the catalogue later falls back to the drawn frames until it is laid out; `pnpm figure --missing` lists those.
- What the rig cannot do is approximated, and worth knowing: there is no shoulder girdle (a shrug or a scapular pull-up is a small rise of the hands), no wrist, no curl of the spine (a crunch folds at the hips, cat-cow is a tilt), and no feet (a calf raise is a few units of height). A loop goes there and back, so a pedal stroke is half a turn and a stride passes through standing.
- Several figures animating at once cost more than drawn frames did, since each part is masked against what is behind it. One at a time, which is all the app does, runs at the display's rate.
- The figure is ours, so the CC BY-SA terms of the drawn library do not apply to it. The catalogue (names, muscles) still comes from Workout Guide.
- The drawn frames are deprecated and only a fallback: ADR 0008 is superseded, and `MoveArt` warns in development when it falls back. `scripts/moves/` and `public/moves` (about 8 MB) go once the owner decides the fallback is not worth keeping ([#35](https://github.com/tukkteam/powerweek/issues/35)).
