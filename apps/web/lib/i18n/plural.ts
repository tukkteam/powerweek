/** "1 change" / "3 changes": `many` holds a # where the number goes. */
export const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : many.replace("#", String(n));
