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
}) => {
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
        .getByRole("group", { name: "Kontrol tampilan" })
        .getByRole("button", { name: "Gabung voice chat" })
        .click();
      await expect(
        client.getByRole("button", { name: "Bisukan mikrofon" }),
      ).toBeVisible();
    }
    for (const client of [page, guest])
      await expect(client.locator("html")).toHaveAttribute(
        "data-signal",
        "yes",
      );
    await page.getByRole("button", { name: "Bisukan mikrofon" }).click();
    const frames = (client: Page) =>
      client.evaluate(() =>
        Number(document.documentElement.dataset.frames || 0),
      );
    const first = await frames(page);
    await expect.poll(() => frames(page)).toBeGreaterThan(first + 10);
    const muted = await frames(guest);
    await expect.poll(() => frames(page)).toBeGreaterThan(first + 25);
    expect(await frames(guest)).toBe(muted);
    await page.getByRole("button", { name: "Aktifkan mikrofon" }).click();
    await expect.poll(() => frames(guest)).toBeGreaterThan(muted + 10);
    await guest.getByRole("button", { name: "Keluar voice chat" }).click();
    await expect(
      guest.getByRole("button", { name: "Gabung voice chat" }),
    ).toBeVisible();
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
  await expect(page.getByRole("group", { name: "Kontrol tampilan" }).getByRole("alert")).toContainText(
    "Server meja tidak menjawab",
  );
  omitJoin = false;
  await join.click();
  await expect(
    page.getByRole("button", { name: "Bisukan mikrofon" }),
  ).toBeVisible();
});
