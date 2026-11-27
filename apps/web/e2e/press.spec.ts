import { expect, test, type Locator } from "@playwright/test";

/** The element's scale and filter as the browser draws them in the next frame. */
const look = (target: Locator) =>
  target.evaluate(
    (node) =>
      new Promise<{ scale: string; filter: string; playing: number }>((resolve) =>
        requestAnimationFrame(() => {
          const style = getComputedStyle(node);
          resolve({
            scale: style.scale,
            filter: style.filter,
            playing: node.getAnimations().length,
          });
        }),
      ),
  );

const scaleOf = (value: string) => (value === "none" ? 1 : Number.parseFloat(value));

/** Waits until nothing is animating the element any more. */
const settled = (target: Locator) =>
  expect.poll(() => target.evaluate((node) => node.getAnimations().length)).toBe(0);

async function centre(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.describe("pressing", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/es");
  });

  test("a press shows in the next frame and springs back on release", async ({ page }) => {
    // The language already chosen: pressing it does nothing, so the page stays put.
    const start = page.locator('button[lang="es"]').first();
    const { x, y } = await centre(start);
    await page.mouse.move(x, y);
    await page.mouse.down();
    const first = await look(start);
    expect(first.playing).toBe(1);
    expect(scaleOf(first.scale)).toBeLessThan(1);
    expect(first.filter).toMatch(/^brightness\(0\.9/);

    await page.mouse.up();
    await settled(start);
    const after = await look(start);
    expect(scaleOf(after.scale)).toBe(1);
  });

  test("sliding off lets go, and releasing outside does nothing", async ({ page }) => {
    const english = page.locator('button[lang="en"]').first();
    const { x, y, box } = await centre(english);
    await page.mouse.move(x, y);
    await page.mouse.down();
    expect(scaleOf((await look(english)).scale)).toBeLessThan(1);

    await page.mouse.move(x, box.y - 80, { steps: 4 });
    await settled(english);
    expect(scaleOf((await look(english)).scale)).toBe(1);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/es$/);

    // A press that stays on the control still acts.
    await english.click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("Space shows the same press from the keyboard", async ({ page }) => {
    const english = page.locator('button[lang="en"]').first();
    await english.focus();
    await page.keyboard.down(" ");
    expect(scaleOf((await look(english)).scale)).toBeLessThan(1);
    await page.keyboard.up(" ");
    await settled(english);
    await expect(page).toHaveURL(/\/en$/);
  });

  test("with reduced motion, a press only changes tone", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const start = page.locator('button[lang="es"]').first();
    const { x, y } = await centre(start);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const held = await look(start);
    expect(scaleOf(held.scale)).toBe(1);
    expect(held.filter).toBe("brightness(0.9)");
    await page.mouse.up();
    await settled(start);
    expect((await look(start)).filter).toBe("none");
  });
});
