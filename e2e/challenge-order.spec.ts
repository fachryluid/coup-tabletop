import { expect, test } from "@playwright/test";

test("Challenge gagal tampil sebelum dek mengganti kartu", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Masuk dengan kode" }).click();
  await expect(page.getByLabel("Kode undangan")).toBeVisible();
  await page.getByRole("button", { name: "Menu awal" }).click();
  await page.getByRole("button", { name: "Buat meja privat" }).click();
  await page.getByLabel("Nama pemain").fill("Ayu");
  await page.getByLabel("Nama pemain").press("Enter");
  await expect(page.getByText("Lobi permainan")).toBeVisible();
  const ctx = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const guest = await ctx.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Nama pemain").fill("Bima");
    await guest.getByRole("button", { name: "Gabung room" }).click();
    await page.getByRole("button", { name: "Mulai pertandingan" }).click();
    await expect(page.getByRole("button", { name: /^Income/ })).toBeVisible();
    const offscreen = await page.addStyleTag({
      content:
        ".my-dialogue .seat-bubble{transform:translateX(-200vw) !important}",
    });
    await page.getByRole("button", { name: /^Income/ }).click();
    for (const seat of [page, guest])
      await expect(seat.locator("blockquote")).toContainText("1 koin");
    await expect(page.locator(".player-area .balance")).toContainText("2 koin");
    await expect(guest.locator(".opponent .balance")).toContainText("2 koin");
    await expect(guest.locator(".opponent .balance")).toContainText("3 koin");
    await expect(page.locator(".player-area .balance")).toContainText("2 koin");
    await offscreen.evaluate((style) => {
      style.parentNode?.removeChild(style);
    });
    await expect(page.locator(".player-area .balance")).toContainText("3 koin");
    // Both seats can afford Assassinate. With only three copies of Contessa,
    // at least one seat must have a role that can declare a provable action.
    await guest.getByRole("button", { name: /^Income/ }).click();
    const hand = (seat: typeof page) =>
      seat
        .locator(".hand-card img")
        .evaluateAll((imgs) =>
          imgs.map((img) => img.getAttribute("alt")!.split(" · ")[0]),
        );
    const hostRole = (await hand(page)).find((role) => role !== "Contessa");
    const actor = hostRole ? page : guest,
      challenger = hostRole ? guest : page;
    const role =
      hostRole || (await hand(guest)).find((role) => role !== "Contessa")!;
    if (!hostRole) await page.getByRole("button", { name: /^Income/ }).click();
    const action: Record<string, string> = {
      Duke: "Tax",
      Assassin: "Assassinate",
      Captain: "Steal",
      Ambassador: "Exchange",
    };
    await actor
      .getByRole("button", { name: new RegExp("^" + action[role]) })
      .click();
    if (["Captain", "Assassin"].includes(role))
      await actor
        .getByRole("button", {
          name: action[role] + " · " + (hostRole ? "Bima" : "Ayu"),
        })
        .click();
    await actor.getByRole("button", { name: "Tahan dialog" }).click();
    const next = actor.getByRole("button", { name: "Berikutnya →" });
    while (await next.isEnabled()) await next.click();
    await actor.locator(".deck-pile").evaluate((el) =>
      new MutationObserver((records) => {
        for (const r of records)
          for (const node of r.addedNodes)
            if (
              node instanceof HTMLElement &&
              node.dataset.motion === "replace"
            )
              el.setAttribute("data-replaced", "yes");
      }).observe(el, { childList: true }),
    );
    const pile = actor.locator(".deck-pile");
    await challenger
      .getByRole("button", { name: "Challenge", exact: true })
      .click();
    await Promise.all([
      (async () => {
        await next.click();
        await expect(actor.locator(".opponent blockquote")).toContainText(
          /menantang/i,
        );
        expect(await pile.getAttribute("data-replaced")).toBeNull();
        await actor.getByRole("button", { name: "Buktikan · " + role }).click();
        await next.click();
        const proof = actor.locator("[data-proof] img");
        await expect(proof).toHaveAttribute(
          "alt",
          new RegExp("^" + role + " ·"),
        );
        await expect(
          actor.locator("blockquote img, .seat-bubble img"),
        ).toHaveCount(0);
        await expect(actor.locator(".my-dialogue blockquote")).toContainText(
          /Tantangan .* gagal/,
        );
        expect(await pile.getAttribute("data-replaced")).toBeNull();
        await expect(pile).toHaveAttribute("data-replaced", "yes");
      })(),
      (async () => {
        const returning = challenger.locator('[data-motion="replace"]');
        const loss = challenger.getByRole("button", { name: /Gugurkan/ });
        const proof = challenger.locator(".opponent [data-proof] img");
        await expect(proof).toHaveAttribute(
          "alt",
          new RegExp("^" + role + " ·"),
        );
        await expect(
          challenger.locator("blockquote img, .seat-bubble img"),
        ).toHaveCount(0);
        await expect(challenger.locator(".opponent blockquote")).toContainText(
          /Tantangan .* gagal/,
        );
        await expect(proof).toBeVisible();
        await challenger.screenshot({ path: info.outputPath("bukti.png") });
        await expect(returning.first()).toBeAttached();
        await expect(loss).toHaveCount(0);
        await expect(loss.first()).toBeVisible();
        await expect(returning).toHaveCount(0);
      })(),
    ]);
  } finally {
    await ctx.close();
  }
});
