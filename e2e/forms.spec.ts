import { expect, test } from "@playwright/test";

test("kontrol formulir meja dapat dipakai dengan keyboard", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Masuk dengan kode" }).click();
  const name = page.getByLabel("Nama pemain");
  const invite = page.getByLabel("Kode undangan");
  await name.fill("Rani");
  await name.press("Tab");
  await expect(invite).toBeFocused();
  await invite.fill("abc123");
  await expect(invite).toHaveValue("ABC123");
  await page.screenshot({ path: info.outputPath("gabung.png") });
  await page.getByRole("button", { name: "Menu awal" }).click();
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  const rule = page.getByLabel(/One-Time Guess/);
  await rule.focus();
  await rule.press("Space");
  await expect(rule).toBeChecked();
  await name.press("Enter");
  await page.getByRole("button", { name: "Tambah computer" }).click();
  await page.getByLabel("Level Computer 1").selectOption("hard");
  await expect(page.getByLabel("Level Computer 1")).toHaveValue("hard");
  await page.screenshot({ path: info.outputPath("lobi.png") });
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  await page.getByRole("button", { name: "Menu meja" }).click();
  await page.getByText("Pengaturan meja", { exact: true }).click();
  await expect(rule).toHaveCount(0);
  await page.getByText("Pengaturan meja", { exact: true }).click();
  await page.getByText("Kontrol host", { exact: true }).click();
  await page.getByText("Koreksi koin", { exact: true }).click();
  await page.getByLabel("Saldo akhir").fill("4");
  await page.getByLabel("Alasan").fill("Koreksi saldo awal");
  await page.getByRole("button", { name: "Simpan koreksi" }).click();
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(page.locator(".player-area .balance")).toContainText("4 koin");
});
