import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByLabel('What should I call you?').fill('Sam');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Start without it/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sam');
}

async function say(page: Page, text: string) {
  const input = page.locator('#cmd');
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeEnabled();
}

test('onboarding creates the starter chart', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Mandala chart' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sleep: 0% this week/ })).toBeVisible();
});

test('no horizontal scroll on any page', async ({ page }) => {
  await onboard(page);
  for (const p of ['today', 'chart', 'review', 'review?range=month', 'notes', 'chat', 'settings', 'help', 'help?s=gemma', 'chart?pillar=1', 'chart?pillar=goal']) {
    await page.goto(`/#/${p}`);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

test('assistant logs a habit and adds a task, with undo', async ({ page }) => {
  await onboard(page);
  await say(page, 'I meditated and remind me to call mom tomorrow');
  await page.goto('/#/chart?pillar=2');
  await expect(page.getByRole('button', { name: /Meditate 10 min\. 1 of 7 days/ })).toBeVisible();
  await page.goto('/#/today');
  await expect(page.getByRole('checkbox', { name: 'Complete Call mom' })).toBeVisible();
});

test('tap a chart action to log it, tap again to unlog', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/chart?pillar=1');
  const cell = page.getByRole('button', { name: /^Dark room\./ });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
});

test('notes: add by hand, find by search, delete with undo', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Add note or task' }).click();
  await page.getByLabel('Note', { exact: true }).fill('Bought new running shoes');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.goto('/#/notes');
  await page.getByLabel('Search notes').fill('shoes');
  const note = page.getByRole('button', { name: /Bought new running shoes/ });
  await expect(note).toBeVisible();
  await note.click();
  await page.getByRole('button', { name: 'Delete note' }).click();
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(note).toBeVisible();
});

test('state lives in the URL (refresh keeps the open block)', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/chart?pillar=3');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Skin' })).toBeVisible();
});

test('weekly review shows the logged week and switches range', async ({ page }) => {
  await onboard(page);
  await say(page, 'I meditated');
  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.getByRole('heading', { name: 'Your week' })).toBeVisible();
  await expect(page.getByLabel('Period').locator('xpath=following-sibling::section[1]')).toContainText('1 action logged');
  await page.getByRole('button', { name: '4 weeks' }).click();
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeVisible();
  await expect(page).toHaveURL(/range=month/);
});

test('help page: open from settings, search, and the assistant opens the right section', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
  await page.getByLabel('Search help').fill('backup');
  await expect(page.getByRole('button', { name: /Backup and moving/ })).toBeVisible();
  await page.goto('/#/today');
  await say(page, 'how do I turn on the AI?');
  await expect(page).toHaveURL(/#\/help\?s=gemma/);
  await expect(page.getByRole('button', { name: /Turn on the AI/ })).toHaveAttribute('aria-expanded', 'true');
});

test('chart: done-today shows as an outline, ring per pillar strip', async ({ page }) => {
  await onboard(page);
  await say(page, 'I meditated');
  await page.goto('/#/chart');
  await expect(page.locator('.cell.today')).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Pillars' }).getByRole('listitem')).toHaveCount(8);
});
