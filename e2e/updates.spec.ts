import { expect, test } from "@playwright/test";

test("panduan awal, tombol kembali, emote in-game, koin 3D meja, dan Coup kiri/kanan", async ({
  page: host,
  browser,
  baseURL,
}, info) => {
  await host.goto(baseURL!);

  // 1. Panduan cara main di halaman awal
  await expect(
    host.getByRole("heading", { name: /Apa itu Coup & Cara Bermain/ }),
  ).toBeVisible();
  await expect(host.getByRole("button", { name: /Cara bermain/ })).toBeVisible();
  for (const role of ["Duke", "Assassin", "Captain", "Ambassador", "Contessa"]) {
    await expect(
      host.locator(".how-to-play").getByRole("heading", { name: role }),
    ).toBeVisible();
  }
  expect(
    await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await host.locator(".how-to-play").scrollIntoViewIfNeeded();
  await host.screenshot({ path: info.outputPath("how-to-play.png") });

  // 2. Buat room lalu kembali ke halaman awal dari lobi, dan buat room lagi
  await host.getByRole("button", { name: "Buat meja privat" }).click();
  await host.getByLabel("Nama pemain").fill("Ayu");
  await host.getByRole("button", { name: "Buat room" }).click();
  await expect(host.getByText("Lobi permainan")).toBeVisible();

  host.once("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "Halaman awal", exact: true }).click();
  await expect(
    host.getByRole("button", { name: "Buat meja privat" }),
  ).toBeVisible();

  // Pastikan bisa langsung membuat room baru setelah kembali ke halaman awal
  await host.getByRole("button", { name: "Buat meja privat" }).click();
  await host.getByLabel("Nama pemain").fill("Ayu");
  await host.getByRole("button", { name: "Buat room" }).click();
  await expect(host.getByText("Lobi permainan")).toBeVisible();

  const guestCtx = await browser.newContext({ viewport: host.viewportSize()! });
  const guest = await guestCtx.newPage();
  try {
    await guest.goto(host.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await expect(guest.getByText("Lobi permainan")).toBeVisible();

    // Host memilih tipe kartu Custom 1 lewat tombol + modal di lobi (default Klasik)
    const hostThemeBadge = host.locator(
      ".card-theme-picker > .extra-rules-header .rules-badge",
    );
    const guestThemeBadge = guest.locator(
      ".card-theme-picker > .extra-rules-header .rules-badge",
    );
    await expect(hostThemeBadge).toHaveText("Klasik");
    await host.getByRole("button", { name: "Pilih tipe kartu" }).click();
    const themeModal = host.getByRole("dialog", { name: "Pilih tipe kartu" });
    await expect(themeModal).toBeVisible();
    await expect(themeModal).not.toContainText("2 kartu klasik");
    await expect(themeModal.getByRole("radio", { name: /Klasik/ })).toBeChecked();
    await themeModal.getByRole("radio", { name: /Custom 1/ }).click();
    await themeModal.getByRole("button", { name: "Lihat" }).nth(1).click();
    await expect(themeModal.locator(".theme-gallery-item")).toHaveCount(5);
    await expect
      .poll(async () =>
        themeModal
          .locator(".theme-gallery-item img")
          .evaluateAll((imgs) =>
            imgs.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await host.screenshot({ path: info.outputPath("lobby-card-themes.png") });
    await themeModal.getByRole("button", { name: "Simpan tipe kartu" }).click();
    await expect(themeModal).toBeHidden();
    await expect(hostThemeBadge).toHaveText("Custom 1");
    await expect(guestThemeBadge).toHaveText("Custom 1");

    await host.getByRole("button", { name: "Mulai pertandingan" }).click();
    // Saat awal mulai (sebelum kartu tiba), tinggi meja sudah >= 90% viewport dan berjarak rapi dari header
    await expect(host.locator(".arena")).toBeVisible();
    const openingArena = (await host.locator(".arena").boundingBox())!;
    const headerBox = (await host.locator("header").boundingBox())!;
    expect(openingArena.height).toBeGreaterThanOrEqual(
      host.viewportSize()!.height * 0.9 - 1,
    );
    expect(openingArena.y).toBeGreaterThan(
      headerBox.y + headerBox.height + 10,
    );
    await expect(host.locator(".title")).toContainText(
      "2 pemain · Timer mati · Custom 1",
    );
    await expect(host.getByText("Kartu Anda", { exact: true })).toBeVisible();

    // 3. Tumpukan koin 3D menyatu langsung dengan meja & kas istana 1:1 di dekat dek
    await expect(host.locator(".court-supplies .court-deck")).toBeVisible();
    await expect(host.locator(".court-supplies .court-treasury")).toContainText(
      "Kas · 46 koin",
    );
    await expect(host.locator(".court-treasury .coin-3d")).toHaveCount(46);
    await expect(host.locator(".treasury-pile")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(host.locator(".player-area .coin-tray")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(host.locator(".player-area [data-coin-seat] .coin-3d")).toHaveCount(2);
    await expect(host.locator(".opponent [data-coin-seat] .coin-3d")).toHaveCount(2);
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    // 4. Emote in-game tampil di kedua perangkat + aset SFX tersaji normal
    for (const sfxPath of [
      "/audio/sfx/click.mp3",
      "/audio/sfx/card-slide.mp3",
      "/audio/sfx/card-swap.mp3",
      "/audio/sfx/coin-clink.mp3",
      "/audio/sfx/emote-laugh.mp3",
      "/audio/sfx/emote-clap.mp3",
    ]) {
      const res = await host.request.get(sfxPath);
      expect(res.status(), sfxPath).toBe(200);
      expect((await res.body()).length, sfxPath).toBeGreaterThan(1000);
    }
    await host.getByRole("button", { name: "Lihat meja" }).click();
    await host.getByRole("button", { name: "Kirim emote" }).click();
    await host.getByRole("button", { name: "Mencurigakan..." }).click();
    await expect(host.locator(".player-area .seat-emote-burst")).toContainText(
      "Mencurigakan...",
    );
    await expect(guest.locator(".opponent .seat-emote-burst")).toContainText(
      "Mencurigakan...",
    );
    await host.screenshot({ path: info.outputPath("table-coins-emote.png") });

    // 5. Coup memilih kartu kiri atau kanan saat target punya 2 kartu
    await host.getByRole("button", { name: "Menu meja" }).click();
    const menu = host.getByRole("dialog", { name: "Menu meja" });
    await menu.getByText("Kontrol host", { exact: true }).click();
    await menu.getByText("Koreksi koin", { exact: true }).click();
    await menu.getByLabel("Saldo akhir").fill("7");
    await menu.getByLabel("Alasan").fill("Uji aksi Coup");
    await menu.getByRole("button", { name: "Simpan koreksi" }).click();
    await menu.getByRole("button", { name: "Tutup", exact: true }).click();

    await expect(host.locator(".player-area .balance")).toContainText("7 koin");
    await expect(host.locator(".player-area [data-coin-seat] .coin-3d")).toHaveCount(7);
    await expect(host.locator(".court-treasury")).toContainText("Kas · 41 koin");
    await expect(host.locator(".court-treasury .coin-3d")).toHaveCount(41);

    // Buka aksi -> uji Switch kartu kiri/kanan (1x giliran ini, tidak menghabiskan giliran)
    const reopen = host.getByRole("button", { name: "Pilih Aksi" });
    if (await reopen.isVisible().catch(() => false)) {
      await reopen.click();
    }
    const beforeSwap = await host
      .locator(".private-hand .hand-card img")
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt")));
    const switchBtn = host.locator('.action-tile[data-kind="Switch"]');
    await expect(switchBtn).toBeVisible();
    // Ilustrasi tombol aksi tetap memakai desain klasik meskipun tipe kartu meja Custom 1
    await expect(
      host.locator('.action-tile[data-kind="Tax"] .action-art-thumb img'),
    ).toHaveAttribute("src", "/cards/duke.webp");
    await switchBtn.click();
    await expect(host.locator("blockquote")).toContainText(
      "menukar posisi kartunya",
    );
    await expect(
      host.getByRole("button", { name: /^Coup/ }),
    ).toBeVisible();
    // Switch tidak lagi muncul di giliran yang sama, dan posisi kartu kiri/kanan tertukar
    await expect(switchBtn).toHaveCount(0);
    const afterSwap = await host
      .locator(".private-hand .hand-card img")
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt")));
    expect(afterSwap).toEqual([beforeSwap[1], beforeSwap[0]]);

    // Lanjut pilih Coup -> pilih Bima -> pilih Kartu kanan (tanpa caption kiri/kanan)
    await host.getByRole("button", { name: /^Coup/ }).click();
    await host.getByRole("button", { name: "Coup · Bima" }).click();
    await expect(host.getByRole("button", { name: "Kartu kiri" })).toBeVisible();
    await expect(host.getByRole("button", { name: "Kartu kanan" })).toBeVisible();
    await expect(host.locator(".mystery-card-label")).toHaveCount(0);
    await host.screenshot({ path: info.outputPath("coup-left-right.png") });

    const guestRightCard = (await guest
      .locator(".private-hand .hand-card img")
      .nth(1)
      .getAttribute("alt"))!.split(" · ")[0];

    await host.getByRole("button", { name: "Kartu kanan" }).click();

    // Kartu kanan Bima langsung gugur tanpa perlu Bima memilih kartu
    await expect(guest.locator(".lost-hand-card")).toHaveCount(1);
    await expect(guest.locator(".lost-hand-card img")).toHaveAttribute(
      "alt",
      new RegExp("^" + guestRightCard),
    );
    await expect(host.locator(".opponent .fallen")).toHaveCount(1);
    await expect(host.locator(".player-area .balance")).toContainText("0 koin");
    await expect(host.locator(".player-area [data-coin-seat] .coin-3d")).toHaveCount(0);
    await expect(host.locator(".court-treasury .coin-3d")).toHaveCount(48);

    // 6. Kembali ke halaman awal saat in-game
    host.once("dialog", (d) => d.accept());
    await host.getByRole("button", { name: "Kembali ke halaman awal" }).click();
    await expect(
      host.getByRole("button", { name: "Buat meja privat" }),
    ).toBeVisible();
  } finally {
    await guestCtx.close();
  }
});
