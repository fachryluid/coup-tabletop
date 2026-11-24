import { expect, test } from "@playwright/test";
import { roles } from "../domain/model";

test("Guess salah: host menyaksikan, target menjawab, penebak memilih kartu gugur", async ({
  page: host,
  browser,
  baseURL,
}) => {
  await host.goto(baseURL!);
  await host.getByRole("button", { name: "Buat meja privat" }).click();
  await host.getByLabel("Nama pemain").fill("Ayu");
  const guessRule = host.getByLabel(/One-Time Guess/);
  await guessRule.click();
  await expect(guessRule).toBeChecked();
  await host.getByRole("button", { name: "Buat room" }).click();
  const join = async (name: string) => {
    const page = await browser.newPage({ viewport: host.viewportSize()! });
    await page.goto(host.url());
    await page.getByLabel("Nama pemain").fill(name);
    await page.getByRole("button", { name: "Gabung room" }).click();
    await expect(page.getByText("Lobi permainan")).toBeVisible();
    return page;
  };
  const actor = await join("Bima"),
    target = await join("Dina");
  try {
    await host.getByRole("button", { name: "Mulai pertandingan" }).click();
    await host.getByRole("button", { name: /^Income/ }).click();
    await actor.getByRole("button", { name: /^Guess/ }).click();
    await actor.getByRole("button", { name: "Dina", exact: true }).click();
    const hand = await target
      .locator(".private-hand .hand-card img")
      .evaluateAll((images) =>
        images.map((img) => img.getAttribute("alt")!.split(" · ")[0]),
      );
    expect(hand).toHaveLength(2);
    const miss = roles.find((role) => !hand.includes(role))!;
    await actor.getByRole("button", { name: miss, exact: true }).click();
    await expect(
      target.getByRole("button", { name: "Jawab salah" }),
    ).toBeVisible();
    for (const observer of [actor, host]) {
      await expect(observer.locator(".turn-guide")).toContainText(
        "Dina menjawab tebakan Bima",
      );
      await expect(
        observer.getByRole("button", { name: /Jawab (benar|salah)/ }),
      ).toHaveCount(0);
    }
    await target.getByRole("button", { name: "Jawab salah" }).click();
    for (const page of [actor, target, host]) {
      await expect(page.locator(".herald-popup blockquote")).toContainText(
        "Tebakan Bima salah",
      );
      await expect(page.locator("[data-proof]")).toHaveCount(0);
    }
    await expect(
      actor.getByRole("button", { name: /Gugurkan/ }).first(),
    ).toBeVisible();
    for (const page of [host, target]) {
      await expect(page.getByRole("button", { name: /Gugurkan/ })).toHaveCount(
        0,
      );
    }
    await actor
      .getByRole("button", { name: /Gugurkan/ })
      .first()
      .click();
    await expect(actor.locator(".lost-hand-card")).toHaveCount(1);
    await expect(target.locator(".private-hand .hand-card")).toHaveCount(2);
  } finally {
    await actor.close();
    await target.close();
  }
});
