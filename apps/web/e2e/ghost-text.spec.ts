import { test, expect } from '@playwright/test';

test.describe('Ghost Text Inline Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the suggest API endpoint for deterministic E2E assertions
    await page.route('**/suggest/next-word', async (route) => {
      const body = route.request().postDataJSON();
      const context = body?.context || '';

      if (context.endsWith('Hello there ')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [{ completion: 'hope you are doing well', confidence: 0.9 }],
            tier: 'local',
            model: 'ngram-trigram-v1',
          }),
        });
      } else if (context.endsWith('Please let me ')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [{ completion: 'know if you have questions', confidence: 0.95 }],
            tier: 'groq',
            model: 'llama-3.3-70b-versatile',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [],
            tier: 'local',
            model: 'ngram-trigram-v1',
          }),
        });
      }
    });

    await page.route('**/suggest/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('renders CodeMirror editor with ghost text decoration and accepts with Tab', async ({ page }) => {
    // 1. Assert CodeMirror container is present
    const cmEditor = page.locator('[data-testid="codemirror-editor"] .cm-content');
    await expect(cmEditor).toBeVisible();

    // 2. Click and type "Hello there "
    await cmEditor.click();
    await cmEditor.fill('Hello there ');

    // 3. Wait for debounced trigger (200 ms) and check ghost decoration widget
    const ghostText = page.locator('[data-testid="ghost-suggestion"]');
    await expect(ghostText).toBeVisible({ timeout: 2000 });
    await expect(ghostText).toContainText('hope you are doing well');

    // 4. Assert screen reader polite live region
    const liveRegion = page.locator('div[role="status"].sr-only');
    await expect(liveRegion).toContainText('Suggestion available, press Tab to accept');

    // 5. Press Tab to accept full suggestion
    await page.keyboard.press('Tab');

    // 6. Assert ghost text is gone and document content updated in single undo step
    await expect(ghostText).not.toBeVisible();
    await expect(cmEditor).toContainText('Hello there hope you are doing well');

    // 7. Test Undo (Ctrl+Z / Cmd+Z) reverts in 1 step
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
    await expect(cmEditor).toContainText('Hello there ');
  });

  test('Ctrl+Right accepts one word and Esc dismisses', async ({ page }) => {
    const cmEditor = page.locator('[data-testid="codemirror-editor"] .cm-content');
    await cmEditor.click();
    await cmEditor.fill('Hello there ');

    const ghostText = page.locator('[data-testid="ghost-suggestion"]');
    await expect(ghostText).toBeVisible({ timeout: 2000 });

    // Press Control+ArrowRight / Meta+ArrowRight to accept one word ("hope ")
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+ArrowRight' : 'Control+ArrowRight');

    // Document now has "Hello there hope "
    await expect(cmEditor).toContainText('Hello there hope');

    // Remaining ghost text should be "you are doing well"
    await expect(ghostText).toBeVisible();
    await expect(ghostText).toContainText('you are doing well');

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(ghostText).not.toBeVisible();
  });

  test('Match-ahead keeps remaining ghost text when typing matching char', async ({ page }) => {
    const cmEditor = page.locator('[data-testid="codemirror-editor"] .cm-content');
    await cmEditor.click();
    await cmEditor.fill('Hello there ');

    const ghostText = page.locator('[data-testid="ghost-suggestion"]');
    await expect(ghostText).toBeVisible({ timeout: 2000 });
    await expect(ghostText).toContainText('hope you are doing well');

    // Type 'h' (which matches first char of 'hope')
    await page.keyboard.press('h');

    // Document now ends with 'h', ghost text remainder is 'ope you are doing well'
    await expect(ghostText).toBeVisible();
    await expect(ghostText).toContainText('ope you are doing well');
  });

  test('Footer toggle chip and Settings popover toggle disable ghost text', async ({ page }) => {
    // 1. Footer toggle chip "Suggest: ON"
    const footerToggle = page.getByRole('button', { name: /Suggest: ON/i });
    await expect(footerToggle).toBeVisible();

    // Click to turn OFF
    await footerToggle.click();
    await expect(page.getByRole('button', { name: /Suggest: OFF/i })).toBeVisible();

    // Type text; no ghost text should appear
    const cmEditor = page.locator('[data-testid="codemirror-editor"] .cm-content');
    await cmEditor.click();
    await cmEditor.fill('Hello there ');
    await page.waitForTimeout(500);

    const ghostText = page.locator('[data-testid="ghost-suggestion"]');
    await expect(ghostText).not.toBeVisible();

    // Click to turn back ON
    const footerToggleOff = page.getByRole('button', { name: /Suggest: OFF/i });
    await footerToggleOff.click();
    await expect(page.getByRole('button', { name: /Suggest: ON/i })).toBeVisible();

    // Check Settings popover gear icon
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await settingsButton.click();
    await expect(page.getByText('Inline suggestions')).toBeVisible();
    await expect(page.getByText('AI suggestions (Groq)')).toBeVisible();
  });
});
