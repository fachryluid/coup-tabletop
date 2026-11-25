import { test, expect } from "@playwright/test";
test("Steal menjelaskan pelaku, target, peran dan siapa yang merespons", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const ctx = await browser.newContext({ viewport: page.viewportSize()! });
  const third = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const guest = await ctx.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    const witness = await third.newPage();
    await witness.goto(page.url());
    await witness.getByLabel("Nama pemain").fill("Dina");
    await witness.getByRole("button", { name: "Gabung room" }).click();
    await expect(
      page.locator(".seat").getByText("Dina", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await expect(
      page.getByRole("heading", { name: "Anda memilih aksi" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Steal/ }).click();
    await page.getByRole("button", { name: "Steal · Bima" }).click();
    for (const view of [page, guest])
      await expect(view.locator("blockquote")).toHaveText(
        /Captain.*2 koin dari Bima/,
      );
    await expect(witness.locator(".turn-guide")).toContainText(
      "Bima bisa Challenge, Block, atau Pass",
    );
    await expect(witness.locator(".choices button")).toHaveCount(0);
    await expect(guest.locator(".turn-guide")).toContainText("Challenge");
    await expect(
      guest.locator(".arena .opponent[data-speaking=true] blockquote"),
    ).toContainText("Captain");
    await expect(page.locator(".arena .my-dialogue blockquote")).toContainText(
      "Captain",
    );
    await expect(
      guest
        .locator(".choices")
        .getByRole("button", { name: "Challenge", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        guest
          .locator(".private-hand img")
          .first()
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(guest.locator(".choices button b")).toHaveText([
      "Pass",
      "Challenge",
      "Block · Ambassador",
      "Block · Captain",
    ]);
    for (const role of ["Captain", "Ambassador"])
      await expect(
        guest.getByRole("button", { name: "Block · " + role }),
      ).toBeVisible();
    await guest.getByRole("button", { name: "Pass", exact: true }).click();
    await expect(guest.locator(".my-dialogue blockquote")).toHaveCount(0);
    await expect(guest.getByRole("button", { name: /^Income/ })).toBeVisible();
    await expect(guest.locator(".player-area .balance")).toContainText(
      "0 koin",
    );
    await guest.getByRole("button", { name: "Lihat meja" }).click();
    await guest.getByRole("button", { name: "Menu meja" }).click();
    const menu = guest.getByRole("dialog", { name: "Menu meja" });
    await menu.getByText("Riwayat meja", { exact: true }).click();
    await expect(menu.locator(".history")).toContainText("Bima pass.");
    await menu.getByRole("button", { name: "Tutup", exact: true }).click();
  } finally {
    await third.close();
    await ctx.close();
  }
});
test("musik latar benar-benar diputar, diatur volumenya, ganti varian, dan dijeda", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Musik latar" });
  await expect(trigger).toHaveAttribute("aria-pressed", "false");
  await trigger.click();
  const panel = page.getByRole("region", { name: "Kontrol musik latar" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Putar" }).click();
  await expect(trigger).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((el) => (el as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await panel.getByLabel("Volume musik").fill("65");
  expect(
    await page
      .locator("audio")
      .evaluate((el) => (el as HTMLAudioElement).volume),
  ).toBeCloseTo(0.65, 2);
  await panel.getByRole("radio", { name: /Balairung Malam/ }).click();
  await expect(trigger).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Matikan" }).click();
  await expect(trigger).toHaveAttribute("aria-pressed", "false");
  expect(
    await page
      .locator("audio")
      .evaluate((el) => (el as HTMLAudioElement).paused),
  ).toBe(true);
});
