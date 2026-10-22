import { expect, test, type Page } from '@playwright/test';

/* The agent's plans live in their own sidebar view: a Progress bar above Bots opens the cards,
 * five steps around the active one, and the bar disappears when the open project has no plan. */
const bar = (page: Page) => page.locator('.sidebar-todos-bar');
const host = (page: Page) => page.locator('#sidebar-todos');
const panel = (page: Page) => page.locator('#sidebar-todos-panel');
const card = (page: Page, id: string) => panel(page).locator(`.todo-card[data-todo-task="${id}"]`);

async function openProgress(page: Page): Promise<void> {
  await bar(page).click();
  await expect(panel(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Preview state is module-local; expose the emitter so a test can mark a run.
  await page.route('**/src/preview.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    await route.fulfill({ response, body: `${source}\nwindow.__todoEmit = emit; window.__todoSession = session; window.__todoDelete = ids => { sessions = sessions.filter(task => !ids.includes(task.id)); emit('sessions-deleted', { sessionIds: ids }); };\n` });
  });
  await page.goto('/');
});

test('opens the plan cards from its own bar above Bots', async ({ page }) => {
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('#navigation')).toBeVisible();
  await expect(bar(page)).toContainText('Progress');
  await expect(bar(page).locator('small')).toHaveText('2');
  const progress = await host(page).boundingBox(), bots = await page.locator('#sidebar-bots').boundingBox();
  expect(progress!.y).toBeLessThan(bots!.y);
  await openProgress(page);
  await expect(page.locator('#navigation')).toBeHidden();
  await expect(page.locator('#sidebar-bots')).toBeVisible();
  await expect(panel(page).locator('.todo-card')).toHaveCount(2);
  const first = card(page, 'session-1');
  await expect(first.locator('.todo-title')).toHaveText('Make search feel instant');
  await expect(first.locator('.todo-count')).toHaveText('3/9');
  await expect(first.locator('.todo-more.before')).toHaveText('+1 finished');
  await expect(first.locator('.todo-item')).toHaveCount(5);
  await expect(first.locator('.todo-item.active')).toContainText('Keep keyboard navigation working');
  await expect(first.locator('.todo-more.after')).toHaveText('+3 more');
  // Each step wraps to at most three lines; the card never shows a sixth one.
  await expect(first.locator('.todo-item .todo-text').first()).toHaveCSS('-webkit-line-clamp', '3');
  await expect(card(page, 'session-2').locator('.todo-count')).toHaveText('1/3');
  await expect(card(page, 'session-2').locator('.todo-item')).toHaveCount(3);
  await expect(card(page, 'session-2').locator('.todo-more')).toHaveCount(0);
  // Back to the task list from the same bar.
  await bar(page).click();
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('#navigation')).toBeVisible();
});

test('highlights the card of the running task only', async ({ page }) => {
  await openProgress(page);
  await expect(card(page, 'session-1')).not.toHaveClass(/running/);
  await page.evaluate(() => {
    const w = window as any;
    w.__todoSession('session-1').status = 'running';
    w.__todoEmit('agent-event', { sessionId: 'session-1', kind: 'status', text: 'Working…' });
  });
  await expect(card(page, 'session-1')).toHaveClass(/running/);
  await expect(card(page, 'session-2')).not.toHaveClass(/running/);
});

test('keeps the Progress bar above Bots with its position in both views', async ({ page }) => {
  await expect(host(page)).toBeVisible();
  const progress = (await host(page).boundingBox())!;
  const bots = (await page.locator('#sidebar-bots').boundingBox())!;
  expect(progress.y).toBeLessThan(bots.y);
  // Open the Bots view: its list fills the sidebar, the two bars stay at the bottom.
  await page.locator('.sidebar-bots-bar').click();
  const botsPanel = (await page.locator('#sidebar-bots-panel').boundingBox())!;
  const bottom = (await page.locator('.sidebar-bottom').boundingBox())!;
  expect((await host(page).boundingBox())!.y).toBeGreaterThanOrEqual(botsPanel.y + botsPanel.height - 1);
  expect((await page.locator('#sidebar-bots').boundingBox())!.y).toBeLessThan(bottom.y);
  expect((await host(page).boundingBox())!.y).toBe(progress.y);
  expect((await page.locator('#sidebar-bots').boundingBox())!.y).toBe(bots.y);
  // Opening Progress from there swaps the body, not the bars.
  await openProgress(page);
  await expect(page.locator('#sidebar-bots-panel')).toBeHidden();
  await expect(page.locator('#navigation')).toBeHidden();
  expect((await host(page).boundingBox())!.y).toBe(progress.y);
  expect((await page.locator('#sidebar-bots').boundingBox())!.y).toBe(bots.y);
});

test('hides the bar while no conversation is open', async ({ page }) => {
  await expect(host(page)).toBeVisible();
  await page.evaluate(() => (window as any).__todoDelete(['session-1', 'session-2']));
  await expect(host(page)).toBeHidden();
  await expect(page.locator('#navigation')).toBeVisible();
});

test('shows the bar with an empty state when the open conversation has no plan', async ({ page }) => {
  await expect(host(page)).toBeVisible();
  await expect(bar(page).locator('small')).toHaveText('2');
  await page.locator('.task-item[data-id="session-4"]').click();
  await expect(host(page)).toBeVisible();
  await expect(bar(page).locator('small')).toHaveText('');
  await openProgress(page);
  await expect(panel(page).locator('.todo-card')).toHaveCount(0);
  await expect(panel(page).locator('.todos-panel-empty')).toContainText('No plan yet');
  await expect(page.locator('#navigation')).toBeHidden();
});
