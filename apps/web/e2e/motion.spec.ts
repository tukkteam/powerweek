import { expect, test, type Page } from "@playwright/test";

/** How the first card of the landing's hero demo animates in, as the browser computed it. */
const heroCard = (page: Page) =>
  page
    .locator(".pw-rise")
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      };
    });

test.describe("motion", () => {
  test("entrances take their curve and duration from the motion tokens", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/es");
    expect(await heroCard(page)).toEqual({
      name: "pw-rise",
      duration: "0.26s",
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    // A spring token resolves to a linear() curve where the browser understands it.
    const spring = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--spring-bouncy").trim(),
    );
    expect(spring).toMatch(/^linear\(0, /);
  });

  test("with reduced motion, an entrance is a short fade", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/es");
    const card = await heroCard(page);
    expect(card.name).toBe("pw-fade");
    expect(Number.parseFloat(card.duration)).toBeLessThanOrEqual(0.15);
  });

  test("the motion tuning page is not part of a production build", async ({ request }) => {
    const response = await request.get("/es/dev/motion");
    expect(response.status()).toBe(404);
  });
});
