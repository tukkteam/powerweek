/**
 * The rules of arranging the panel, apart from the screen that draws it: where a module goes
 * when it is moved, what each key does while one is held, and which card a dragged one is over.
 * Everything here is pure, so it is tested without a browser.
 */

/** `order` with `id` moved to `index` (clamped to the ends). Unknown ids leave it unchanged. */
export function moveTo(order: readonly string[], id: string, index: number): string[] {
  const from = order.indexOf(id);
  if (from === -1) return [...order];
  const next = order.filter((other) => other !== id);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
  return next;
}

/** True when both orders list the same modules in the same places. */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** A module picked up with the keyboard, and the order it was picked up from. */
export interface Held {
  id: string;
  origin: readonly string[];
}

export interface Arrangement {
  order: string[];
  held: Held | null;
}

/** What a key did, for the live region: the module and its place, counted from 1. */
export interface Moved {
  kind: "picked" | "moved" | "dropped" | "cancelled";
  id: string;
  place: number;
  total: number;
}

/**
 * One key pressed on a module's handle. Space or Enter picks it up and drops it; while held,
 * the arrow keys move it one place (up and left are earlier, down and right later), Home and
 * End to either end, and Escape puts it back where it was picked up. Returns null for a key
 * that does nothing here, so the browser keeps its default.
 */
export function pressKey(
  state: Arrangement,
  id: string,
  key: string,
): { state: Arrangement; event: Moved | null } | null {
  const report = (kind: Moved["kind"], order: string[]): Moved => ({
    kind,
    id,
    place: order.indexOf(id) + 1,
    total: order.length,
  });
  const held = state.held?.id === id ? state.held : null;

  if (!held) {
    if (key !== " " && key !== "Enter") return null;
    if (!state.order.includes(id)) return null;
    return {
      state: { order: state.order, held: { id, origin: [...state.order] } },
      event: report("picked", state.order),
    };
  }

  if (key === " " || key === "Enter")
    return { state: { order: state.order, held: null }, event: report("dropped", state.order) };
  if (key === "Escape") {
    const order = [...held.origin];
    return { state: { order, held: null }, event: report("cancelled", order) };
  }

  const from = state.order.indexOf(id);
  const to =
    key === "ArrowUp" || key === "ArrowLeft"
      ? from - 1
      : key === "ArrowDown" || key === "ArrowRight"
        ? from + 1
        : key === "Home"
          ? 0
          : key === "End"
            ? state.order.length - 1
            : null;
  if (to === null) return null;
  // At either end the key is still ours: the page must not scroll under a held card.
  if (to < 0 || to >= state.order.length) return { state, event: null };
  const order = moveTo(state.order, id, to);
  return { state: { order, held }, event: report("moved", order) };
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const inside = (x: number, y: number, box: Box) =>
  x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;

/**
 * The card a dragged one is over, by where the cards sit in the grid (not where they are
 * gliding to). `skip` is the card it last traded places with: cards differ in size, so right
 * after a trade the pointer can sit on that same card again, and trading back would make the
 * two swap on every move. It counts again once the pointer has left it.
 */
export function cardUnder(
  x: number,
  y: number,
  boxes: ReadonlyMap<string, Box>,
  held: string,
  skip: string | null,
): { target: string | null; skip: string | null } {
  const stillSkipped = skip !== null && boxes.has(skip) && inside(x, y, boxes.get(skip)!);
  for (const [id, box] of boxes) {
    if (id === held || !inside(x, y, box)) continue;
    if (stillSkipped && id === skip) return { target: null, skip };
    return { target: id, skip: id };
  }
  return { target: null, skip: stillSkipped ? skip : null };
}
