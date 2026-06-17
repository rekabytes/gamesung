import { test, expect, Page } from "@playwright/test";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

async function clickSquare(page: Page, file: string, rank: string) {
  const fi = FILES.indexOf(file);
  const ri = RANKS.indexOf(rank);
  const index = ri * 8 + fi;
  await page.locator(".board > .rank > .square").nth(index).click();
}

async function getMoveTokens(page: Page): Promise<string[]> {
  const text = await page.locator(".move-list").textContent();
  return text!.replace(/^Moves:\s*/, "").split(/\s+/).filter(Boolean);
}

test("bot responds to multiple player moves", async ({ page }) => {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`PAGEERROR: ${err.message}\n${err.stack ?? ""}`);
  });

  await page.goto("http://localhost:3000/chess");
  await expect(page.getByRole("heading", { name: "Chess" })).toBeVisible();

  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.locator(".chessboard")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("(Live)")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".bot-status")).toHaveText("Your turn", { timeout: 10000 });

  console.log("--- Initial state ---");
  console.log("Status: Your turn");

  // Helper: wait for bot to play (turn flips back to "Your turn").
  // We don't strictly require "Bot is thinking..." to appear — the bot can be fast enough
  // that both updates arrive in one render cycle. We just wait for the move count to grow.
  async function waitForBotMove(expectedCount: number) {
    await expect.poll(
      async () => {
        const t = await getMoveTokens(page);
        return t.length;
      },
      { timeout: 15000, intervals: [100] }
    ).toBe(expectedCount);
  }

  // Move 1: d2-d4.
  console.log("--- Move 1: d2-d4 ---");
  await clickSquare(page, "d", "2");
  await expect(
    page.locator(".board > .rank > .square").nth(6 * 8 + 3) // d2 itself
  ).toHaveClass(/selected/);
  // d3 and d4 should be possible.
  const d3 = page.locator(".board > .rank > .square").nth(5 * 8 + 3); // d3
  const d4 = page.locator(".board > .rank > .square").nth(4 * 8 + 3); // d4
  await expect(d3).toHaveClass(/possible/);
  await expect(d4).toHaveClass(/possible/);
  await clickSquare(page, "d", "4");
  await waitForBotMove(2);
  let tokens = await getMoveTokens(page);
  console.log("Moves after 1.d4 + bot:", tokens);
  expect(tokens.length).toBe(2);
  expect(tokens[0]).toBe("d2d4");

  // Move 2: e2-e4.
  console.log("--- Move 2: e2-e4 ---");
  await clickSquare(page, "e", "2");
  await expect(
    page.locator(".board > .rank > .square").nth(6 * 8 + 4)
  ).toHaveClass(/selected/);
  await clickSquare(page, "e", "4");
  await waitForBotMove(4);
  tokens = await getMoveTokens(page);
  console.log("Moves after 2.e4 + bot:", tokens);
  expect(tokens.length).toBe(4);
  expect(tokens[0]).toBe("d2d4");
  expect(tokens[2]).toBe("e2e4");

  // Move 3: g1-f3 (knight).
  console.log("--- Move 3: Nf3 ---");
  await clickSquare(page, "g", "1");
  await expect(
    page.locator(".board > .rank > .square").nth(7 * 8 + 6) // g1
  ).toHaveClass(/selected/);
  // f3 should be highlighted.
  await expect(
    page.locator(".board > .rank > .square").nth(5 * 8 + 5) // f3
  ).toHaveClass(/possible/);
  await clickSquare(page, "f", "3");
  await waitForBotMove(6);
  tokens = await getMoveTokens(page);
  console.log("Moves after 3.Nf3 + bot:", tokens);
  expect(tokens.length).toBe(6);
  expect(tokens[4]).toBe("g1f3");

  // Take a screenshot of the final state.
  await page.screenshot({ path: "test-results/chess-after-3-moves.png", fullPage: true });

  // Print collected browser logs.
  console.log("\n--- Browser console logs ---");
  for (const l of consoleLogs) console.log(l);
  console.log("\n--- Browser errors ---");
  for (const e of consoleErrors) console.log(e);

  expect(consoleErrors).toEqual([]);
});
