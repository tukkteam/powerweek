import { cardOrder, expect, startWith, test } from "./session";

test.describe("arranging the panel in place", () => {
  test("reorders with the keyboard, saves on Done as one change, and undoes it", async ({
    app: page,
  }) => {
    await startWith(page, ["Agenda", "Comidas", "Notas"]);
    expect(await cardOrder(page)).toEqual(["agenda", "fuel", "notes"]);

    await page.getByRole("button", { name: "Organizar" }).click();
    // The real cards stay on screen while arranging, at their real size.
    expect(await cardOrder(page)).toEqual(["agenda", "fuel", "notes"]);
    const live = page.locator("#panel-arranger-status");

    const handle = page.getByRole("button", { name: "Mover Agenda", exact: true });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(live).toHaveText("Has cogido Agenda. Puesto 1 de 3.");
    await page.keyboard.press("ArrowDown");
    await expect(live).toHaveText("Agenda, puesto 2 de 3.");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(live).toHaveText("Has dejado Agenda en el puesto 3 de 3.");
    await expect(handle).toBeFocused();
    expect(await cardOrder(page)).toEqual(["fuel", "notes", "agenda"]);

    await page.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("button", { name: "Organizar" })).toBeFocused();
    expect(await cardOrder(page)).toEqual(["fuel", "notes", "agenda"]);
    await expect(page.getByText("1 cambio en tu semana")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Organizar" })).toBeVisible();
    expect(await cardOrder(page)).toEqual(["fuel", "notes", "agenda"]);

    await page.goto("/es/app");
    await page.getByRole("button", { name: "Organizar" }).click();
    await page.getByRole("button", { name: "Mover Notas", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Listo" }).click();
    expect(await cardOrder(page)).toEqual(["notes", "fuel", "agenda"]);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect.poll(() => cardOrder(page)).toEqual(["fuel", "notes", "agenda"]);
  });

  test("Escape puts a held card back, and Cancel leaves without saving", async ({ app: page }) => {
    await startWith(page, ["Agenda", "Notas"]);
    await page.getByRole("button", { name: "Organizar" }).click();

    await page.getByRole("button", { name: "Mover Agenda", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);
    await page.keyboard.press("Escape");
    await expect(page.locator("#panel-arranger-status")).toHaveText(
      "Cancelado: Agenda vuelve al puesto 1 de 2.",
    );
    // Escape only put the card back: the panel is still being arranged.
    expect(await cardOrder(page)).toEqual(["agenda", "notes"]);
    await expect(page.getByRole("button", { name: "Listo" })).toBeVisible();

    await page.getByRole("button", { name: "Mover Notas antes" }).click();
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);
    // Notas is first now, so its "earlier" button is off: the focus moves to its handle.
    await expect(page.getByRole("button", { name: "Mover Notas", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(await cardOrder(page)).toEqual(["agenda", "notes"]);
    await expect(page.getByText("1 cambio en tu semana")).toHaveCount(0);
  });

  test("adds and removes modules in place, at their real size", async ({ app: page }) => {
    await startWith(page, ["Agenda"]);
    await page.getByRole("button", { name: "Añadir módulo" }).click();
    // Opened to add: the list of modules to bring on has the focus.
    await expect(page.getByRole("button", { name: "Añadir Comidas" })).toBeFocused();
    await page.getByRole("button", { name: "Añadir Comidas" }).click();
    expect(await cardOrder(page)).toEqual(["agenda", "fuel"]);
    await expect(page.getByRole("button", { name: "Mover Comidas", exact: true })).toBeFocused();

    await page.getByRole("button", { name: "Quitar Agenda" }).click();
    expect(await cardOrder(page)).toEqual(["fuel"]);
    await page.getByRole("button", { name: "Listo" }).click();
    expect(await cardOrder(page)).toEqual(["fuel"]);

    // Taking every module off brings back the welcome.
    await page.getByRole("button", { name: "Organizar" }).click();
    await page.getByRole("button", { name: "Quitar Comidas" }).click();
    await page.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("heading", { name: "¿Qué quieres organizar?" })).toBeVisible();
  });

  test("drags a card with the mouse", async ({ app: page }) => {
    await startWith(page, ["Agenda", "Notas"]);
    await page.getByRole("button", { name: "Organizar" }).click();
    const notes = await page.locator("#module-notes").boundingBox();
    const handle = page.getByRole("button", { name: "Mover Agenda", exact: true });
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(notes!.x + notes!.width / 2, notes!.y + notes!.height / 2, { steps: 12 });
    await page.mouse.up();
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);
    await page.getByRole("button", { name: "Listo" }).click();
    expect(await cardOrder(page)).toEqual(["notes", "agenda"]);
  });
});
