import { expect, test } from "@playwright/test";

test("panduan awal, tombol kembali, emote in-game, koin 3D meja, dan Coup kiri/kanan", async ({
  page: host,
  browser,
  baseURL,
}, info) => {
  await host.goto(baseURL!);

  // 0a. Header dan hero section full-width screen dan minimal setinggi layar tanpa horizontal overflow
  const landingHeader = (await host.locator("header").boundingBox())!;
  const landingBrand = (await host.locator("header .brand-lockup").boundingBox())!;
  const landingHero = (await host.locator(".start-stage").boundingBox())!;
  expect(landingHeader.width).toBeCloseTo(host.viewportSize()!.width, 0);
  expect(landingHero.width).toBeCloseTo(host.viewportSize()!.width, 0);
  expect(landingHeader.height + landingHero.height).toBeGreaterThanOrEqual(
    host.viewportSize()!.height - 1,
  );
  // Hero langsung menampilkan "The Ultimate Coup" tanpa mengulang logo SVG di hero
  await expect(host.locator(".brand-hero svg")).toHaveCount(0);
  await expect(host.locator(".brand-hero")).toContainText("The Ultimate");
  await expect(
    host.locator(".brand-hero").getByRole("heading", { name: "The Ultimate Coup" }),
  ).toBeVisible();
  expect(
    await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);

  // 0. Banner update terbaru tampil sekali di kunjungan pertama, lalu hilang setelah dilihat
  const updateBanner = host.locator(".update-banner");
  await expect(updateBanner).toBeVisible();
  await expect(updateBanner).toContainText("Update terbaru versi 1.3.0");
  await host.screenshot({ path: info.outputPath("landing-update-banner.png") });
  await updateBanner.getByRole("link", { name: /Lihat detail/ }).click();
  await expect(
    host.getByRole("heading", { name: "Catatan Pembaruan", exact: true }),
  ).toBeVisible();
  await expect(
    host.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Catatan Pembaruan");
  await expect(host.locator(".patch-entry")).toHaveCount(4);
  expect(
    await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await host.screenshot({ path: info.outputPath("updates-page.png") });
  await host.getByRole("link", { name: "Kembali", exact: true }).click();
  await expect(
    host.getByRole("button", { name: "Buat meja privat" }),
  ).toBeVisible();
  await expect(host.locator(".update-banner")).toHaveCount(0);
  await host.reload();
  await expect(host.locator(".update-banner")).toHaveCount(0);

  // 1. Panduan cara main di halaman awal
  await expect(
    host.getByRole("heading", { name: /Apa itu The Ultimate Coup & Cara Bermain/ }),
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

  // 1b. Halaman Syarat & Ketentuan dan Kebijakan Privasi dapat dibuka dari footer halaman awal
  await host.getByRole("link", { name: "Syarat & Ketentuan" }).click();
  await expect(
    host.getByRole("heading", { name: "Syarat & Ketentuan" }),
  ).toBeVisible();
  await expect(
    host.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Beranda");
  expect(
    await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await host.screenshot({ path: info.outputPath("terms-page.png") });
  await host.getByRole("link", { name: "Kembali", exact: true }).click();
  await expect(
    host.getByRole("button", { name: "Buat meja privat" }),
  ).toBeVisible();

  await host.getByRole("link", { name: "Kebijakan Privasi" }).click();
  await expect(
    host.getByRole("heading", { name: "Kebijakan Privasi" }),
  ).toBeVisible();
  await expect(
    host.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Kebijakan Privasi");
  expect(
    await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await host.screenshot({ path: info.outputPath("privacy-page.png") });
  const legalCta = host.locator(".legal-cta");
  await legalCta.scrollIntoViewIfNeeded();
  await expect(legalCta).toHaveCSS("color", "rgb(32, 29, 24)");
  await expect(legalCta).toHaveCSS("background-color", "rgb(231, 199, 134)");
  await host.screenshot({ path: info.outputPath("legal-footer.png") });
  await host.getByRole("link", { name: "Kembali", exact: true }).click();
  await expect(
    host.getByRole("button", { name: "Buat meja privat" }),
  ).toBeVisible();

  // 2. Buat room lalu kembali ke halaman awal dari lobi, dan buat room lagi
  await host.getByRole("button", { name: "Buat meja privat" }).click();
  await host.getByLabel("Nama pemain").fill("Ayu");
  await host.getByRole("button", { name: "Buat room" }).click();
  await expect(host.getByText("Lobi permainan")).toBeVisible();
  const lobbyHeader = (await host.locator("header").boundingBox())!;
  const lobbyBrand = (await host.locator("header .brand-lockup").boundingBox())!;
  expect(lobbyHeader.width).toBeCloseTo(host.viewportSize()!.width, 0);
  expect(lobbyHeader.height).toBeCloseTo(landingHeader.height, 0);
  expect(lobbyBrand.x).toBeCloseTo(landingBrand.x, 0);

  await host.getByRole("button", { name: "Halaman awal", exact: true }).click();
  const confirmLobby = host.locator("dialog.confirm-modal");
  await expect(confirmLobby).toBeVisible();
  await confirmLobby.getByRole("button", { name: "Ya, kembali" }).click();
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
    // Saat awal mulai (sebelum kartu tiba), tinggi meja sudah >= 90% viewport dan header in-game konsisten dengan landing/lobi
    await expect(host.locator(".arena")).toBeVisible();
    const openingArena = (await host.locator(".arena").boundingBox())!;
    const headerBox = (await host.locator("header").boundingBox())!;
    const inGameBrand = (await host.locator("header .brand-lockup").boundingBox())!;
    expect(headerBox.width).toBeCloseTo(host.viewportSize()!.width, 0);
    expect(headerBox.height).toBeCloseTo(landingHeader.height, 0);
    expect(inGameBrand.x).toBeCloseTo(landingBrand.x, 0);
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

    // 6. Navigasi ke halaman Pengaturan saat masih di room -> tombol "Kembali ke game" muncul di header & mengembalikan ke meja
    await host.goto("/settings");
    const returnToGameLink = host
      .locator("header")
      .getByRole("link", { name: "Kembali ke game" });
    await expect(returnToGameLink).toBeVisible();
    await returnToGameLink.click();
    await expect(host.locator(".arena")).toBeVisible();

    // 7. Header in-game bersih tanpa tombol sound & kembali; kembali ke halaman awal lewat Modal Menu meja + custom ConfirmModal
    await expect(
      host.locator("header").getByRole("button", { name: "Musik latar" }),
    ).toHaveCount(0);
    await expect(
      host
        .locator("header")
        .getByRole("button", { name: "Kembali ke halaman awal" }),
    ).toHaveCount(0);
    await host.getByRole("button", { name: "Menu meja" }).click();
    const menuDialog = host.getByRole("dialog", { name: "Menu meja" });
    await expect(menuDialog).toBeVisible();
    await menuDialog
      .getByRole("button", { name: "Kembali ke halaman awal" })
      .click();
    const confirmLeave = host.locator("dialog.confirm-modal");
    await expect(confirmLeave).toBeVisible();
    await host.screenshot({
      path: info.outputPath("confirm-modal.png"),
      animations: "disabled",
    });
    await confirmLeave.getByRole("button", { name: "Ya, kembali" }).click();
    await expect(
      host.getByRole("button", { name: "Buat meja privat" }),
    ).toBeVisible();

    // 8. Jika room di localStorage sudah tidak ada di server, tombol "Kembali ke game" tidak ditampilkan & storage dibersihkan
    await host.evaluate(() => {
      localStorage.setItem("coup:active-room", "DEADBEEF00");
      localStorage.setItem("coup:DEADBEEF00", "stale-token");
    });
    await host.goto("/settings");
    await expect(
      host.getByRole("heading", { name: "Pengaturan", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        host.evaluate(() => localStorage.getItem("coup:active-room")),
      )
      .toBeNull();
    await expect(
      host.locator("header").getByRole("link", { name: "Kembali ke game" }),
    ).toHaveCount(0);
  } finally {
    await guestCtx.close();
  }
});

test("tampilan login Google dan form buat username rapi tanpa badge Akun Pemain", async ({
  page,
  baseURL,
}, info) => {
  // 1. Belum login Google
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authRequired: true, user: null }),
    });
  });
  await page.goto(baseURL!);
  await expect(page.getByText("Akun Pemain")).toHaveCount(0);
  const googleBtn = page.getByRole("link", { name: /Masuk dengan Google/ });
  await expect(googleBtn).toBeVisible();
  await expect(googleBtn).toHaveCSS("border-radius", "2px");
  await expect(page.locator(".auth-terms-note")).toContainText(
    "Kebijakan Privasi",
  );
  await page.screenshot({ path: info.outputPath("auth-google.png") });

  // 2. Sudah login Google tapi belum buat username
  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authRequired: true,
        user: {
          id: "u-test",
          email: "pemain@example.com",
          name: "Pemain Uji",
        },
      }),
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Buat username", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-card-box")).not.toContainText("unik");
  const usernameInput = page.getByLabel("Username", { exact: true });
  await usernameInput.fill("fachry_99");
  await expect(usernameInput).toHaveValue("fachry_99");
  const wrapBox = (await page.locator(".username-input-wrap").boundingBox())!;
  const inputBox = (await usernameInput.boundingBox())!;
  const prefixBox = (await page.locator(".username-prefix").boundingBox())!;
  expect(inputBox.x).toBeGreaterThanOrEqual(prefixBox.x + prefixBox.width - 1);
  expect(inputBox.y).toBeGreaterThanOrEqual(wrapBox.y);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(
    wrapBox.y + wrapBox.height + 1,
  );
  await page.screenshot({ path: info.outputPath("auth-username.png") });

  // 3. Sudah login lengkap: avatar foto Google di paling kanan header & popup profil saat diklik
  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authRequired: true,
        user: {
          id: "u-test",
          email: "fachry@example.com",
          name: "Fachry Nugroho",
          picture: "/cards/duke.webp",
          username: "fachry_99",
          termsAcceptedAt: "2026-11-27T00:00:00.000Z",
        },
      }),
    });
  });
  await page.reload();
  const avatarBtn = page.getByRole("button", { name: "Menu akun @fachry_99" });
  await expect(avatarBtn).toBeVisible();
  await expect(page.getByRole("button", { name: "Musik latar" })).toHaveCount(0);
  const fullscreenBtn = page.getByRole("button", { name: "Layar penuh" });
  const avatarBox = (await avatarBtn.boundingBox())!;
  const fullscreenBox = (await fullscreenBtn.boundingBox())!;
  expect(avatarBox.x).toBeGreaterThan(fullscreenBox.x);
  await avatarBtn.click();
  const popup = page.getByRole("dialog", { name: "Informasi akun" });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Fachry Nugroho");
  await expect(popup).toContainText("@fachry_99");
  await expect(popup).toContainText("fachry@example.com");
  await expect(
    popup.getByRole("button", { name: "Keluar akun" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("account-popup.png") });
  await popup.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pengaturan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Pengaturan");
  await page.getByRole("radio", { name: /Balairung Malam/ }).click();
  await page.screenshot({ path: info.outputPath("settings-page.png") });
  // 4. Kembali ke halaman awal lalu buat room: foto profil Google host muncul di kursi lobi
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Fachry");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const hostAvatar = page.locator('.seat .seat-avatar[data-kind="photo"] img').first();
  await expect(hostAvatar).toBeVisible();
  await expect(hostAvatar).toHaveAttribute("src", "/cards/duke.webp");
  await page.screenshot({ path: info.outputPath("lobby-host-avatar.png") });
});
