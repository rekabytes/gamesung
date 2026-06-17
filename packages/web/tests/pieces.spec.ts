import { test, expect, Page } from "@playwright/test";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function squareIndex(file: string, rank: string): number {
  return RANKS.indexOf(rank) * 8 + FILES.indexOf(file);
}

async function clickSquare(page: Page, file: string, rank: string) {
  await page
    .locator(".board > .rank > .square")
    .nth(squareIndex(file, rank))
    .click({ position: { x: 20, y: 20 } });
}

async function getMoveTokens(page: Page): Promise<string[]> {
  const text = (await page.locator(".move-list").textContent()) ?? "";
  return text.replace(/^Moves:\s*/, "").split(/\s+/).filter(Boolean);
}

async function waitForPlayerTurn(page: Page, expectedCount: number) {
  await expect
    .poll(async () => (await getMoveTokens(page)).length, {
      timeout: 15000,
      intervals: [100],
    })
    .toBe(expectedCount);
  await page.waitForTimeout(200);
}

async function getDestsFromBoard(page: Page): Promise<string[]> {
  const dests: string[] = [];
  const allSquares = page.locator(".board > .rank > .square");
  const total = await allSquares.count();
  for (let j = 0; j < total; j++) {
    const isPossible = await allSquares
      .nth(j)
      .evaluate((el) => el.classList.contains("possible"));
    if (isPossible) {
      const ri = Math.floor(j / 8);
      const fi = j % 8;
      dests.push(`${FILES[fi]}${RANKS[ri]}`);
    }
  }
  return dests.sort();
}

async function startGame(page: Page) {
  await page.goto("http://localhost:3000/chess");
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.locator(".chessboard")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".bot-status")).toHaveText("Your turn", { timeout: 10000 });
}

test.describe("Chess piece interaction", () => {
  test("PAWN: double push shows two destinations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    await clickSquare(page, "d", "2");
    const dests = await getDestsFromBoard(page);
    expect(dests).toEqual(["d3", "d4"]);
    expect(errors).toEqual([]);
  });

  test("KNIGHT: g1 has two L-move destinations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    await clickSquare(page, "g", "1");
    const dests = await getDestsFromBoard(page);
    expect(dests).toContain("f3");
    expect(dests).toContain("h3");
    expect(errors).toEqual([]);
  });

  test("BISHOP: c1 has long diagonal destinations after d2-d4", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    // Play 1. d4 to clear d2, opening the bishop's diagonal.
    await clickSquare(page, "d", "2");
    await clickSquare(page, "d", "4");
    await waitForPlayerTurn(page, 2);
    // Now bishop c1 should have: d2, e3, f4, g5, h6.
    await clickSquare(page, "c", "1");
    const dests = await getDestsFromBoard(page);
    console.log("Bishop c1 destinations (after d2-d4):", dests);
    expect(dests).toContain("d2");
    expect(dests).toContain("e3");
    expect(dests).toContain("f4");
    expect(dests).toContain("g5");
    expect(dests).toContain("h6");
    expect(errors).toEqual([]);
  });

  test("ROOK: a1 has only rank-1 destinations (a-file blocked by pawn)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    // Rook a1 is blocked along a-file (a2 has own pawn) and along rank 1 (b1 has own knight).
    await clickSquare(page, "a", "1");
    const dests = await getDestsFromBoard(page);
    expect(dests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("QUEEN (user's bug): d1 destinations after e2 pawn moves", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);

    // Play 1. d4 + wait for bot, 2. e4 + wait for bot.
    await clickSquare(page, "d", "2");
    await clickSquare(page, "d", "4");
    await waitForPlayerTurn(page, 2);
    await clickSquare(page, "e", "2");
    await clickSquare(page, "e", "4");
    await waitForPlayerTurn(page, 4);

    // Queen d1: d-file opens (d2, d3), e2 diagonal opens (e2).
    await clickSquare(page, "d", "1");
    const dests = await getDestsFromBoard(page);
    console.log("Queen d1 destinations:", dests);
    // d2 and d3 should always be reachable (d2 empty, d3 empty, d4 has own pawn).
    expect(dests).toContain("d2");
    expect(dests).toContain("d3");
    // e2 should be reachable (e2 pawn moved to e4).
    expect(dests).toContain("e2");
    expect(errors).toEqual([]);
  });

  test("KING: e1 has at most 5 destinations (D, E, F squares)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    await clickSquare(page, "e", "1");
    const dests = await getDestsFromBoard(page);
    console.log("King e1 destinations:", dests);
    // King is surrounded by own pieces except d1 (own queen) and ... actually all are own.
    // e1 neighbors: d1 (queen), d2 (pawn), e2 (pawn), f1 (bishop), f2 (pawn).
    // All are own pieces, so king has NO moves from initial position.
    expect(dests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("clicking a piece behind a pawn: doesn't select the pawn (e2)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await startGame(page);
    // Play 1. e4 to clear e2.
    await clickSquare(page, "e", "2");
    await clickSquare(page, "e", "4");
    await waitForPlayerTurn(page, 2);

    // Now click queen (d1) — should show queen destinations, not pawn destinations.
    await clickSquare(page, "d", "1");
    const queenDests = await getDestsFromBoard(page);
    console.log("Queen d1 destinations (after e4):", queenDests);
    // Queen can reach e2 (diagonal opens after pawn moved).
    expect(queenDests).toContain("e2");

    // Now click e3. e3 is empty in this position.
    // e3 is on the d1-h5 diagonal. Queen can reach e3? d1-e2-f3 (e2 empty, f3 empty) — so queen
    // can reach e2 and f3, but e3 is not on the queen's path from d1.
    // Actually d1 to e3: that's not a queen move (queen moves straight or diagonal).
    // d1-e3 is not a diagonal. d1 is rank 1, e3 is rank 3, same file? No, d and e are different files.
    // So e3 is not a queen destination.
    expect(queenDests).not.toContain("e3");
    expect(errors).toEqual([]);
  });
});
