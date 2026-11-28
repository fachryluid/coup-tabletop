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
      await expect(
        page.getByRole("button", { name: "Buat meja privat" }),
      ).toBeEnabled();
      const enterStart = page.getByRole("button", {
        name: "Layar penuh",
        exact: true,
      });
      await expect(enterStart).toBeVisible();
      await enterStart.click();
      await expect(
        page.getByRole("button", { name: "Keluar layar penuh" }),
      ).toBeVisible();
      const stage = await page.locator(".start-stage").boundingBox();
      expect(stage!.width).toBeCloseTo(page.viewportSize()!.width, 0);
      expect(stage!.height).toBeGreaterThanOrEqual(
        page.viewportSize()!.height - 1,
      );
      if (!fallback)
        await page.screenshot({ path: info.outputPath("start-fullscreen.png") });
      await page.getByRole("button", { name: "Keluar layar penuh" }).click();
      await page.getByRole("button", { name: "Buat meja privat" }).click();
      await page.getByLabel("Nama pemain").fill("Ayu");
      await page.getByRole("button", { name: "Buat room" }).click();
      await page.getByRole("button", { name: "Tambah computer" }).click();
      await page.getByRole("button", { name: "Mulai pertandingan" }).click();
      await expect(page.locator(".action-overlay")).toBeVisible();
      if (!fallback)
        await page.screenshot({ path: info.outputPath("action-overlay.png") });
      await page.getByRole("button", { name: "Lihat meja" }).click();
      await expect(page.locator(".action-minimized-dock")).toBeVisible();
      const dock = page.getByRole("group", { name: "Kontrol tampilan" });
      await expect(dock).toHaveCSS("position", "static");
      await expect(
        page.locator("header").getByRole("button", { name: "Musik latar" }),
      ).toHaveCount(0);
      await expect(
        page
          .locator("header")
          .getByRole("button", { name: "Kembali ke halaman awal" }),
      ).toHaveCount(0);
      await expect(
        page.locator("header").getByRole("button", { name: "Menu meja" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Layar penuh", exact: true })
        .click();
      const exit = page.getByRole("button", { name: "Keluar layar penuh" });
      await expect(exit).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(() => document.fullscreenElement?.tagName ?? null),
      ).toBe(fallback ? null : "HTML");
      await expect(dock).toHaveCSS("position", "fixed");
      const arena = await page.locator(".arena").boundingBox(),
        bar = await dock.boundingBox();
      expect(bar!.y).toBeGreaterThanOrEqual(arena!.y);
      expect(bar!.x + bar!.width).toBeLessThanOrEqual(arena!.x + arena!.width);
      await page.getByRole("button", { name: "Menu meja" }).click();
      const menu = page.getByRole("dialog", { name: "Menu meja" });
      await expect(menu).toBeVisible();
      const expectedWidth = Math.min(520, page.viewportSize()!.width - 28);
      await expect
        .poll(async () => Math.round((await menu.boundingBox())!.width))
        .toBe(expectedWidth);
      const menuBox = (await menu.boundingBox())!;
      expect(
        Math.abs(menuBox.x + menuBox.width / 2 - page.viewportSize()!.width / 2),
      ).toBeLessThanOrEqual(2);
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
