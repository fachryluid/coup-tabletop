import { test, expect } from "@playwright/test";
test("solo vs computer sampai game over dan rematch", async ({ page }) => {
  test.setTimeout(300000);
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Rani");
  await page.getByRole("button", { name: "Buat room" }).click();
  await page.getByRole("button", { name: "Tambahkan aturan lainnya" }).click();
  for (const label of [/One-Time Guess/, /Duke Blocks Tax/]) {
    const toggle = page.getByLabel(label);
    await toggle.click();
    await expect(toggle).toBeChecked();
  }
  await page.getByRole("button", { name: "Simpan aturan" }).click();
  const add = page.getByRole("button", { name: "Tambah computer" });
  await add.click();
  await page.getByRole("button", { name: "Hapus" }).click();
  await add.click();
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  await expect(page.getByText("Kartu Anda")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Kartu Anda")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const rematch = page.getByRole("button", { name: "Kembali ke Lobi" });
  for (let i = 0; i < 150; i++) {
    const choices = page.locator(".choices button");
    await choices.first().or(rematch).waitFor();
    if (await rematch.isVisible()) break;
    const revision = await page
      .locator("[data-revision]")
      .getAttribute("data-revision");
    const coup = choices.filter({ hasText: /^Coup/ }).first();
    if (await coup.count()) {
      await coup.click();
      await choices.filter({ hasText: /Coup · Computer/ }).click();
      const leftCard = page.getByRole("button", { name: "Kartu kiri" });
      if (await leftCard.isVisible().catch(() => false)) {
        await leftCard.click();
      }
    } else {
      const tax = choices.filter({ hasText: /^Tax/ });
      const challenge = page.getByRole("button", {
        name: "Challenge",
        exact: true,
      });
      await (
        (await tax.count())
          ? tax
          : (await challenge.count())
            ? challenge
            : choices.first()
      ).click();
    }
    await expect(page.locator("[data-revision]")).not.toHaveAttribute(
      "data-revision",
      revision!,
    );
  }
  await expect(rematch).toBeVisible();
  const winner = (await page.locator(".turn-guide").innerText()).replace(
    / menang$/,
    "",
  );
  await expect(
    page.locator(".over-overlay .standings tr").filter({ hasText: winner }),
  ).toContainText("1");
  await page.getByRole("button", { name: "Main lagi", exact: true }).click();
  await expect(page.locator("blockquote")).toContainText(
    winner + " mendapat giliran pertama",
  );
  await expect(page.locator(".over-overlay")).toHaveCount(0);
});
test("dua perangkat berbagi block, challenge, dan pilihan influence", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Host");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const ctx = await browser.newContext({ viewport: page.viewportSize()! }),
    guest = await ctx.newPage();
  await guest.goto(new URL(page.url()).href);
  await guest.getByLabel("Nama pemain").fill("Tamu");
  await guest.getByRole("button", { name: "Gabung room" }).click();
  await expect(guest.getByText("Lobi permainan")).toBeVisible();
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  await page.getByRole("button", { name: /^Foreign Aid/ }).click();
  await guest.getByRole("button", { name: /^Block/ }).click();
  await page.getByRole("button", { name: "Challenge", exact: true }).click();
  const loser = guest;
  await loser
    .getByRole("button", { name: /Gugurkan/ })
    .first()
    .click();
  const observer = loser === page ? guest : page;
  await expect(loser.locator(".my-dialogue blockquote")).toContainText(
    "Saya menggugurkan",
  );
  await expect(observer.locator(".opponent blockquote")).toContainText(
    "Saya menggugurkan",
  );
  await expect(loser.locator(".private-hand .hand-card")).toHaveCount(2);
  await expect(observer.locator(".opponent .fallen")).toHaveCount(0);
  await expect(loser.locator(".lost-hand-card")).toHaveCount(1);
  await expect(observer.locator(".opponent .fallen")).toHaveCount(1);
  await expect(guest.getByRole("button", { name: /^Income/ })).toBeVisible();
  await expect(page.locator(".player-area .balance")).toContainText("2 koin");
  await expect(guest.locator(".opponent .balance")).toContainText("2 koin");
  await expect(
    page.getByRole("heading", { name: "Giliran Tamu" }),
  ).toBeVisible();
  await ctx.close();
});
