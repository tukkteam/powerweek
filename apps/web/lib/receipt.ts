import type { Rejection, RejectionReason } from "@tukkteam/modules";

/**
 * What the assistant asked for that could not be done. The model writes its sentence before
 * anything is applied, so the receipt cannot take its word for it: operations that were refused
 * or did not validate are counted here and reported apart.
 *
 * "Nothing to change" (`noop`) is not a failure when other changes were made: a model often
 * adds a module that an earlier operation already put on screen. It only becomes the problem
 * when nothing changed at all.
 */
export function unmet(result: {
  changes: number;
  rejected: readonly Rejection[];
  dropped: number;
}): { count: number; problem: RejectionReason | null } {
  const failed = result.rejected.filter((rejection) => rejection.reason !== "noop");
  const problem =
    failed[0]?.reason ??
    (result.dropped > 0
      ? "invalid"
      : result.changes === 0 && result.rejected.length > 0
        ? "noop"
        : null);
  return { count: failed.length + result.dropped, problem };
}
