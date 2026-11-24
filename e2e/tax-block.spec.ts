import { expect, test } from "@playwright/test";

test("Tax offers Challenge and Duke Block together; accepting the block spends the turn", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  const toggle = page.getByLabel(/Duke Blocks Tax/);
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Buat room" }).click();
  const guest = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await page.getByRole("button", { name: /^Tax/ }).click();
    await expect(
      guest.getByRole("button", { name: "Challenge", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("button", { name: "Pass", exact: true }),
    ).toBeVisible();
    await guest.getByRole("button", { name: "Block · Duke" }).click();
    await expect(
      page.getByRole("button", { name: "Challenge", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pass", exact: true }).click();
    await expect(guest.getByRole("button", { name: /^Income/ })).toBeVisible();
    await expect(page.locator(".turn-guide")).toContainText("Giliran Bima");
    await expect(page.locator(".player-area .balance")).toContainText("2 koin");
  } finally {
    await guest.close();
  }
});
