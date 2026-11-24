import { cardOrder, expect, startWith, test } from "./session";

test.describe("a new account", () => {
  test("chooses its modules on the welcome desk and finds them after a reload", async ({
    app: page,
  }) => {
    await startWith(page, ["Notas", "Agenda"]);
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);

    await page.reload();
    await expect(page.getByRole("button", { name: "Organizar" })).toBeVisible();
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);
  });
});
