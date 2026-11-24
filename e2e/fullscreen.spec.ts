import { test, expect } from "@playwright/test";

for (const fallback of [false, true]) {
  test(
    "Kontrol mengambang pada " +
      (fallback ? "layar penuh dalam tab" : "layar penuh browser"),
    async ({ page }, info) => {
      if (fallback)
        await page.addInitScript(() => {
          Element.prototype.requestFullscreen = async () => {
            throw new Error("Unavailable");
          };
        });
      await page.goto("/");
      await page.getByRole("button", { name: "Buat meja privat" }).click();
      await page.getByLabel("Nama pemain").fill("Ayu");
      await page.getByRole("button", { name: "Buat room" }).click();
      await page.getByRole("button", { name: "Tambah computer" }).click();
      await page.getByRole("button", { name: "Mulai pertandingan" }).click();
      const dock = page.getByRole("group", { name: "Kontrol tampilan" });
      await expect(dock).toHaveCSS("position", "static");
      await expect(
        page.locator("header").getByRole("button", { name: "Musik latar" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Layar penuh", exact: true })
        .click();
      const exit = page.getByRole("button", { name: "Keluar layar penuh" });
      await expect(exit).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(() => document.fullscreenElement?.tagName ?? null),
      ).toBe(fallback ? null : "MAIN");
      await expect(dock).toHaveCSS("position", "fixed");
      const arena = await page.locator(".arena").boundingBox(),
        bar = await dock.boundingBox();
      expect(bar!.y).toBeGreaterThanOrEqual(arena!.y);
      expect(bar!.x + bar!.width).toBeLessThanOrEqual(arena!.x + arena!.width);
      await page.getByRole("button", { name: "Menu meja" }).click();
      const menu = page.getByRole("dialog", { name: "Menu meja" });
      expect((await menu.boundingBox())!.width).toBeCloseTo(
        Math.min(384, page.viewportSize()!.width - 48),
        0,
      );
      await expect.poll(async () => {
        const box = (await menu.boundingBox())!;
        return Math.round(box.x + box.width);
      }).toBe(page.viewportSize()!.width);
      await menu.getByText("Kontrol host", { exact: true }).click();
      await menu.getByRole("button", { name: "Jeda", exact: true }).click();
      await menu.getByRole("button", { name: "Tutup" }).click();
      await expect(
        page.getByRole("heading", { name: "Permainan dijeda" }),
      ).toBeVisible();
      await expect(menu).toBeHidden();
      if (!fallback)
        await page.screenshot({ path: info.outputPath("fullscreen.png") });
      await exit.click();
      await expect(dock).toHaveCSS("position", "static");
      await expect(
        page.getByRole("button", { name: "Layar penuh", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
    },
  );
}
