import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let boardId: string;

test.beforeAll(async () => {
  const board = await prisma.board.findFirst({ orderBy: { createdAt: "desc" } });
  if (!board) {
    throw new Error("No boards found. Run `pnpm db:seed` before e2e tests.");
  }
  boardId = board.id;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("sticky note to outline acceptance", async ({ page }) => {
  await page.goto(`/board/${boardId}`);

  const canvasNodes = page.getByTestId("canvas-node");
  await expect(canvasNodes.first()).toBeVisible();

  const initialCount = await canvasNodes.count();
  await page.getByTestId("add-sticky").click();
  await expect(canvasNodes).toHaveCount(initialCount + 1);

  const latestIndex = (await canvasNodes.count()) - 1;
  const latestNode = canvasNodes.nth(latestIndex);
  await latestNode.getByTestId("sticky-textarea").fill("Playwright idea note");

  await page.getByTestId("run-cluster").click();
  await expect(page.getByTestId("cluster-pill").first()).toBeVisible();

  const clusteredNode = page
    .getByTestId("canvas-node")
    .filter({ has: page.getByTestId("cluster-pill") })
    .first();
  await clusteredNode.click();

  await page.getByTestId("run-outline").click();
  await expect(page.getByTestId("accept-outline")).toBeVisible();
  await page.getByTestId("accept-outline").click();
  await expect(page.getByTestId("accept-outline")).toBeHidden();
});
