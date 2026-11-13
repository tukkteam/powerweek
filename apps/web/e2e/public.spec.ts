import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("the root redirects to the browser language", async ({ browser }) => {
    const english = await browser.newContext({
      locale: "en-GB",
      extraHTTPHeaders: { "Accept-Language": "en-GB,en;q=0.9" },
    });
    const page = await english.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await english.close();
  });

  test("Spanish landing tells the story and links into the app", async ({ page }) => {
    await page.goto("/es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Dile a tu semana qué hacer/i);
    await expect(page.getByRole("link", { name: "Empezar sin cuenta" }).first()).toHaveAttribute(
      "href",
      "/es/login",
    );
    await expect(page.getByRole("heading", { name: /Tres pasos/i })).toBeVisible();
  });

  test("English landing is fully translated", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Talk your week into shape/i);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("the app requires a session", async ({ page }) => {
    await page.goto("/es/app/week");
    await expect(page).toHaveURL(/\/es\/login\?next=%2Fes%2Fapp%2Fweek/);
    await expect(page.getByRole("button", { name: "Empezar sin cuenta" })).toBeVisible();
  });

  test("the PWA manifest is served", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("PowerWeek");
    expect(manifest.icons.length).toBeGreaterThan(2);
  });
});
