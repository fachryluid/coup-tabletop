import { expect, test, type Page } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

async function monitor(page: Page) {
  await page.addInitScript(() => {
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.sampleRate === 16000 && this.buffer.length === 640) {
        const data = document.documentElement.dataset;
        data.frames = String(Number(data.frames || 0) + 1);
        if (this.buffer.getChannelData(0).some((n) => n !== 0))
          data.signal = "yes";
      }
      original.apply(this, args);
    };
  });
}

test("room microphones carry audio both ways, mute independently and release on exit", async ({
  page,
  browser,
}, info) => {
  await monitor(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByRole("button", { name: "Buat room" }).click();
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const guest = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await monitor(guest);
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    for (const client of [page, guest]) {
      await client
        .getByRole("group", { name: "Kontrol lobi" })
        .getByRole("button", { name: "Gabung voice chat" })
        .click();
      await expect(
        client.getByRole("button", { name: "Kontrol voice chat (aktif)" }),
      ).toBeVisible();
      // Tidak ada tombol keluar terpisah di sebelah ikon mikrofon
      await expect(
        client.getByRole("button", { name: "Keluar voice chat" }),
      ).toHaveCount(0);
    }
    for (const client of [page, guest])
      await expect(client.locator("html")).toHaveAttribute(
        "data-signal",
        "yes",
      );
    const speakingSeat = page.locator(".seat[data-voice-speaking]").first();
    await expect(speakingSeat).toBeVisible();
    expect(
      await speakingSeat.evaluate((el) => getComputedStyle(el).boxShadow),
    ).toBe("none");
    const speakingBadge = speakingSeat.getByRole("status", {
      name: "Sedang berbicara",
    });
    await expect(speakingBadge).toBeVisible();
    await expect(speakingBadge).toHaveText("");
    const badgeStyle = await speakingBadge.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        border: s.borderTopWidth,
        shadow: s.boxShadow,
      };
    });
    expect(badgeStyle).toEqual({
      bg: "rgba(0, 0, 0, 0)",
      border: "0px",
      shadow: "none",
    });
    await page.screenshot({ path: info.outputPath("lobby-voice-speaking.png") });
    // Klik ikon mic yang aktif -> tampil 2 menu: Bisukan mikrofon & Keluar dari voice chat
    await page.getByRole("button", { name: "Kontrol voice chat (aktif)" }).click();
    await expect(page.getByRole("menuitem", { name: "Bisukan mikrofon" })).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Keluar dari voice chat" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Bisukan mikrofon" }).click();
    await expect(
      page.getByRole("button", { name: "Kontrol voice chat (dibisukan)" }),
    ).toBeVisible();
    const frames = (client: Page) =>
      client.evaluate(() =>
        Number(document.documentElement.dataset.frames || 0),
      );
    const first = await frames(page);
    await expect.poll(() => frames(page)).toBeGreaterThan(first + 10);
    const muted = await frames(guest);
    await expect.poll(() => frames(page)).toBeGreaterThan(first + 25);
    expect(await frames(guest)).toBe(muted);
    await page.getByRole("button", { name: "Kontrol voice chat (dibisukan)" }).click();
    await page.getByRole("menuitem", { name: "Aktifkan mikrofon" }).click();
    await expect.poll(() => frames(guest)).toBeGreaterThan(muted + 10);
    await guest.getByRole("button", { name: "Kontrol voice chat (aktif)" }).click();
    await guest.getByRole("menuitem", { name: "Keluar dari voice chat" }).click();
    await expect(
      guest.getByRole("button", { name: "Gabung voice chat" }),
    ).toBeVisible();

    // Mulai pertandingan untuk memverifikasi indikator voice in-game absolute di sebelah kiri nama tanpa menggeser nama
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await expect(page.locator(".arena")).toBeVisible();
    await page.getByRole("button", { name: "Lihat meja" }).click();
    const opponentName = page.locator(".opponent .table-name-row b").first();
    await guest.getByRole("button", { name: "Gabung voice chat" }).click();
    const inGameBadge = page
      .locator(".opponent .table-name-row")
      .first()
      .getByRole("status", { name: "Sedang berbicara" });
    await expect(inGameBadge).toBeVisible();
    const speakingBox = (await opponentName.boundingBox())!;
    const badgeBox = (await inGameBadge.boundingBox())!;
    expect(
      await inGameBadge.evaluate((el) => getComputedStyle(el).position),
    ).toBe("absolute");
    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(speakingBox.x + 1);
    await page.screenshot({ path: info.outputPath("ingame-voice-speaking.png") });
    // Saat lawan mute (indikator hilang), posisi nama tetap 100% sama (tidak geser X maupun Y)
    await guest.getByRole("button", { name: "Kontrol voice chat (aktif)" }).click();
    await guest.getByRole("menuitem", { name: "Bisukan mikrofon" }).click();
    await expect(inGameBadge).toHaveCount(0);
    const silentBox = (await opponentName.boundingBox())!;
    expect(Math.abs(silentBox.x - speakingBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(silentBox.y - speakingBox.y)).toBeLessThanOrEqual(1);
  } finally {
    await guest.close();
  }
});

test("a server that ignores voice join shows a server error and allows retry", async ({
  page,
}) => {
  let omitJoin = true;
  await page.routeWebSocket("**/socket.io/**", (route) => {
    const upstream = route.connectToServer();
    route.onMessage((packet) => {
      if (
        omitJoin &&
        typeof packet === "string" &&
        packet.includes('"voice:join"')
      )
        return;
      upstream.send(packet);
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByRole("button", { name: "Buat room" }).click();
  const join = page.getByRole("button", { name: "Gabung voice chat" });
  await join.click();
  await expect(page.getByRole("group", { name: "Kontrol lobi" }).getByRole("alert")).toContainText(
    "Server meja tidak menjawab",
  );
  omitJoin = false;
  await join.click();
  await expect(
    page.getByRole("button", { name: "Kontrol voice chat (aktif)" }),
  ).toBeVisible();
});
