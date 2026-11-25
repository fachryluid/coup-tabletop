import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
test("tampilan meja dan respons pada ukuran layar proyek", async ({
  page,
  browser,
}, info) => {
  const dir = process.env.COUP_SCREENSHOTS ?? info.outputDir;
  await mkdir(dir, { recursive: true });
  const shot = async (name: string) =>
    page.screenshot({
      path: path.join(dir, info.project.name + "-" + name + ".png"),
      animations: "disabled",
    });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Buat meja privat" }),
  ).toBeEnabled();
  await shot("entry");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Rani");
  await shot("create");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  await shot("lobby");
  const ctx = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const guest = await ctx.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Damar");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await expect(
      page.locator(".seat").getByText("Damar", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await expect(page.getByText("Kartu Anda", { exact: true })).toBeVisible();
    await shot("table");
    await page.getByRole("button", { name: /^Tax/ }).click();
    await expect(guest.locator(".turn-guide")).toHaveText(
      "Tax Rani — Anda bisa Challenge atau Pass",
    );
    await guest.screenshot({
      path: path.join(dir, info.project.name + "-tax.png"),
      animations: "disabled",
    });
    await guest.getByRole("button", { name: "Pass", exact: true }).click();
    await guest.getByRole("button", { name: /^Income/ }).click();
    await page.getByRole("button", { name: /^Foreign Aid/ }).click();
    await guest.getByRole("button", { name: /^Block/ }).click();
    await expect(
      page.getByRole("button", { name: "Challenge", exact: true }),
    ).toBeVisible();
    await shot("response");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await ctx.close();
  }
});
test("Exchange memilih indeks kartu lalu Guess memilih lawan dan peran", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByRole("button", { name: "Buat room" }).click();
  await page.getByRole("button", { name: "Tambahkan aturan lainnya" }).click();
  const toggle = page.getByLabel(/One-Time Guess/);
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Simpan aturan" }).click();
  const ctx = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const guest = await ctx.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await expect(
      page.locator(".seat").getByText("Bima", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await page.getByRole("button", { name: /^Exchange/ }).click();
    await guest.getByRole("button", { name: "Pass", exact: true }).click();
    const pool = page.locator(".exchange-cards button");
    await expect(page.locator("blockquote")).toContainText("Saya pass");
    await expect(page.locator(".court-deck")).toContainText("11 kartu");
    await expect(pool).toHaveCount(0);
    await expect(page.locator("blockquote")).toContainText(
      "mengambil dua kartu",
    );
    await expect(page.locator(".court-deck")).toContainText("11 kartu");
    await expect(
      guest.locator(".deck-pile .travelling-card").first(),
    ).toBeAttached();
    await expect(page.locator(".court-deck")).toContainText("9 kartu");
    await expect(pool).toHaveCount(4);
    await expect(guest.locator(".exchange-cards")).toHaveCount(0);
    await pool.nth(0).click();
    await pool.nth(3).click();
    const dir = process.env.COUP_SCREENSHOTS ?? info.outputDir;
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, info.project.name + "-exchange.png"),
      animations: "disabled",
    });
    const hand = page.locator(".private-hand .hand-card img");
    const faces = () =>
      hand.evaluateAll((images) =>
        images.map((image) => image.getAttribute("src")),
      );
    const before = await faces();
    const selected = await page
      .locator(".exchange-cards [aria-pressed=true] img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("src")),
      );
    await page.getByRole("button", { name: /Simpan kartu/ }).click();
    await expect(page.locator("blockquote")).toContainText(
      "kartu yang akan saya simpan",
    );
    expect(await faces()).toEqual(before);
    await expect(page.locator(".court-deck")).toContainText("9 kartu");
    await expect(page.locator(".court-deck")).toContainText("11 kartu");
    expect(await faces()).toEqual(selected);
    await guest.getByRole("button", { name: /^Guess/ }).click();
    await guest.getByRole("button", { name: "Ayu" }).click();
    await guest.getByRole("button", { name: "Kembali", exact: true }).click();
    await guest.getByRole("button", { name: "Ayu" }).click();
    await guest.getByRole("button", { name: /Kartu kiri/ }).click();
    const revealedRole = (await page
      .locator(".hand-card img")
      .first()
      .getAttribute("alt"))!.split(" · ")[0];
    await guest
      .getByRole("button", { name: revealedRole, exact: true })
      .click();
    for (const view of [guest, page])
      await expect(view.locator("blockquote")).toContainText("Saya menebak");
    await expect(page.locator(".hand-card")).toHaveCount(2);
    await expect(guest.locator(".opponent .fallen")).toHaveCount(0);
    const declaration = guest.locator("[data-event-seq]");
    const actionId = await declaration.getAttribute("data-action-id");
    const seq = Number(await declaration.getAttribute("data-event-seq"));
    await expect(guest.locator(".opponent [data-proof] img")).toHaveAttribute(
      "alt",
      new RegExp("^" + revealedRole),
    );
    await expect(guest.locator(".opponent .seat-bubble img")).toHaveCount(0);
    await expect(guest.locator(".opponent blockquote")).toContainText(
      "Tebakan Bima benar",
    );
    await expect(page.locator(".my-dialogue blockquote")).toContainText(
      "Saya memegang " + revealedRole,
    );
    await expect(guest.locator(".seat-bubble[data-event-seq]")).toHaveAttribute(
      "data-event-seq",
      String(seq + 1),
    );
    const verdict = guest.locator(".herald-popup");
    await expect(verdict.locator("blockquote")).toHaveText(
      /Tebakan Bima benar/,
    );
    await expect(verdict).toHaveAttribute("data-action-id", actionId!);
    await expect(verdict).toHaveAttribute("data-event-seq", String(seq + 2));
    const arena = guest.locator(".arena");
    expect(await arena.evaluate((el) => el.scrollLeft)).toBe(0);
    await guest.screenshot({ path: info.outputPath("tebakan-benar.png") });
    await expect(page.locator(".herald-popup blockquote")).toContainText(
      "kehilangan",
    );
    await page.screenshot({ path: info.outputPath("bentara.png") });
    await expect(page.locator(".hand-card")).toHaveCount(2);
    await expect(page.locator(".lost-hand-card")).toHaveCount(1);
    await expect(guest.locator(".opponent .fallen")).toHaveCount(1);
    await expect(
      guest.getByText("Tebakan terpakai", { exact: true }),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
});
test("enam kursi terbaca di meja", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Rani");
  await page.getByRole("button", { name: "Buat room" }).click();
  for (let n = 1; n <= 5; n++) {
    await page.getByRole("button", { name: "Tambah computer" }).click();
    await expect(page.getByLabel("Level Computer " + n)).toBeVisible();
  }
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  await expect(page.locator(".opponent")).toHaveCount(5);
  await expect(
    page.locator(".deck-pile .travelling-card").first(),
  ).toBeAttached();
  await expect(
    page
      .locator(".arena[data-dealing] [data-live-card]:not([data-arrived])")
      .first(),
  ).toBeHidden();
  await expect(page.locator(".travelling-card")).toHaveCount(1);
  expect(
    (await page.locator(".arena").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.9 - 1);
  await expect(page.locator(".court-deck")).toContainText("3 kartu");
  await expect(page.locator(".arena[data-dealing]")).toHaveCount(0);
  await expect(page.locator("[data-live-card]:visible")).toHaveCount(12);
  const dir = process.env.COUP_SCREENSHOTS ?? info.outputDir;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, info.project.name + "-six.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("mengaktifkan animasi tidak mengulang pembagian awal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Rani");
  await page.getByRole("button", { name: "Buat room" }).click();
  await page.getByRole("button", { name: "Tambah computer" }).click();
  await page.getByRole("button", { name: "Mulai pertandingan" }).click();
  const pile = page.locator(".deck-pile");
  await expect(pile).toBeVisible();
  await expect(pile.locator(".travelling-card")).toHaveCount(0);
  await pile.evaluate((el) => {
    new MutationObserver((records) => {
      if (
        records.some((r) =>
          Array.from(r.addedNodes).some(
            (node) =>
              node instanceof Element && node.matches(".travelling-card"),
          ),
        )
      )
        el.setAttribute("data-transfer-seen", "yes");
    }).observe(el, { childList: true });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: /^Income/ }).click();
  await expect(
    page.getByRole("heading", { name: "Giliran Computer 1" }),
  ).toBeVisible();
  expect(await pile.getAttribute("data-transfer-seen")).toBeNull();
});

test("slideshow membuka menu dengan Contessa", async ({ page }, info) => {
  await page.goto("/");
  const slides = page.locator(".start-slide");
  await expect(slides).toHaveCount(5);
  await expect(slides.first()).toHaveCSS("background-image", /contessa\.webp/);
  await expect(slides.first()).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("contessa.png") });
  await expect(slides.nth(1)).toHaveCSS("opacity", "1", { timeout: 8500 });
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await expect(slides.nth(1)).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(slides.first()).toHaveCSS("opacity", "1");
  await expect(slides.nth(1)).toHaveCSS("opacity", "0");
});
