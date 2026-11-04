import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByLabel('What should I call you?').fill('Sam');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Start without it/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sam');
}

test('laptop: left rail replaces the tab bar, welcome shows', async ({ page }) => {
  await onboard(page);
  const rail = page.getByRole('navigation', { name: 'Main' });
  await expect(rail).toHaveClass(/rail/);
  await expect(page.locator('.tabbar')).toHaveCount(0);
  await expect(page.getByText('Welcome, Sam')).toBeVisible();
  await rail.getByRole('button', { name: 'Chart' }).click();
  await expect(page).toHaveURL(/#\/chart/);
});

test('laptop: Ctrl+K opens the command menu and runs a result', async ({ page }) => {
  await onboard(page);
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await input.fill('open sleep');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/pillar=1/);
  await expect(page.getByRole('heading', { name: 'Sleep' })).toBeVisible();
  // split view: the overview is still on screen
  await expect(page.getByRole('grid', { name: 'Mandala chart' })).toBeVisible();
});

test('laptop: ask the assistant from the command menu', async ({ page }) => {
  await onboard(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('I meditated');
  await page.getByRole('option', { name: /Ask the assistant/ }).click();
  await expect(page).toHaveURL(/#\/chat/);
  await expect(page.locator('.bubble.assistant').last()).toContainText(/Meditate/i);
});

test('laptop: keyboard shortcuts g+r, n', async ({ page }) => {
  await onboard(page);
  await page.locator('body').click({ position: { x: 700, y: 800 } });
  await page.keyboard.press('g');
  await page.keyboard.press('r');
  await expect(page).toHaveURL(/#\/review/);
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Note', { exact: true })).toBeFocused();
});

test('laptop: no horizontal scroll', async ({ page }) => {
  await onboard(page);
  for (const p of ['today', 'chart', 'chart?pillar=3', 'review', 'notes', 'chat', 'settings', 'help']) {
    await page.goto(`/#/${p}`);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), p).toBeLessThanOrEqual(0);
  }
});
