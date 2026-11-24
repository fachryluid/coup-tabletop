import { expect, test } from "@playwright/test";

test("drawer scrolls as one panel and only the host can end the match", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const guest = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await expect(page.getByRole("button", { name: /^Income/ })).toBeVisible();
    await guest.getByRole("button", { name: "Menu meja" }).click();
    await expect(
      guest.getByRole("button", { name: "Akhiri pertandingan" }),
    ).toHaveCount(0);
    await guest.getByRole("button", { name: "Tutup" }).click();
    await page.setViewportSize({
      width: page.viewportSize()!.width,
      height: 400,
    });
    await page.getByRole("button", { name: "Menu meja" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu meja" });
    await drawer.getByText("Kontrol host", { exact: true }).click();
    await drawer.getByText("Riwayat meja", { exact: true }).click();
    await expect(drawer.locator(".history")).toHaveCSS("overflow-y", "visible");
    await drawer
      .getByRole("link", { name: "Meja lain" })
      .scrollIntoViewIfNeeded();
    expect(await drawer.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    const end = drawer.getByRole("button", { name: "Akhiri pertandingan" });
    page.once("dialog", (d) => d.dismiss());
    await end.click();
    await expect(end).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await end.click();
    for (const client of [page, guest])
      await expect(
        client.getByRole("heading", {
          name: "Pertandingan diakhiri oleh host",
        }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Kembali ke lobi untuk rematch" })
      .click();
    await expect(guest.getByText("Lobi permainan")).toBeVisible();
  } finally {
    await guest.close();
  }
});
