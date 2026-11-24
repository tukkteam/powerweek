import { expect, test as base, type Page } from "@playwright/test";

/**
 * Tests of the signed-in app. Each test starts a new anonymous account, the way anyone tries
 * PowerWeek, and deletes it when it ends, so the database is left as it was found. They need a
 * real Supabase with the migrations applied: CI starts a local one (`supabase start`); see
 * docs/development.md to run them on your machine.
 */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, provide) => {
    await page.goto("/es/login");
    await page.getByRole("button", { name: "Empezar sin cuenta" }).click();
    await expect(page).toHaveURL(/\/es\/app$/);
    await provide(page);
    await deleteAccount(page);
  },
});

export { expect };

async function deleteAccount(page: Page) {
  await page.goto("/es/app/settings");
  await page.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await page.getByRole("button", { name: "Sí, borrar todo" }).click();
  await expect(page).toHaveURL(/\/es$/);
}

/** From the welcome desk of a new account, put these modules on screen, in this order. */
export async function startWith(page: Page, names: string[]) {
  await expect(page.getByRole("heading", { name: "¿Qué quieres organizar?" })).toBeVisible();
  for (const name of names) await page.getByRole("button", { name: `Añadir ${name}` }).click();
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByRole("button", { name: "Organizar" })).toBeVisible();
  // The receipt comes once the plan is saved.
  await expect(page.getByText(/^\d+ cambios? en tu semana$/)).toBeVisible();
}

/** The modules on the Today screen, in the order their cards are drawn. */
export function cardOrder(page: Page): Promise<string[]> {
  return page
    .locator('[id^="module-"]')
    .evaluateAll((cards) => cards.map((card) => card.id.replace("module-", "")));
}
