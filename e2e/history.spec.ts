import { expect, test } from "@playwright/test";
test("copy public history with balances in event order", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Fachry");
  await page.getByRole("button", { name: "Buat room" }).click();
  await page.getByRole("button", { name: "Tambah computer" }).click();
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  await page.getByRole("button", { name: /^Income/ }).click();
  await page.getByRole("button", { name: "Menu meja" }).click();
  await page.getByText("Riwayat meja", { exact: true }).click();
  await page.getByRole("button", { name: "Salin riwayat lengkap" }).click();
  await expect(page.getByRole("status")).toContainText("Riwayat disalin");
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toMatch(
    /#1 Kartu dibagikan[\s\S]*Fachry · 2 koin · 2 influence[\s\S]*#2 Fachry memilih Income[\s\S]*Fachry · 3 koin · 2 influence/,
  );
});
