import { test, expect } from '@playwright/test';

test.describe('UI Deduplication Verification', () => {
  test('asserts critical action labels render at most once per page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Sign In / Save: only ONE "Sign in to save" in header (Guest session has no sign in button)
    const signInToSaveButtons = page.getByRole('button', { name: /^sign in to save$/i });
    expect(await signInToSaveButtons.count()).toBeLessThanOrEqual(1);

    // Any button containing exactly "Sign In"
    const exactSignIn = page.getByRole('button', { name: /^sign in$/i });
    expect(await exactSignIn.count()).toBe(0);

    // 2. Save: Header has "Sign in to save" or "Save" (at most 1)
    const exactSave = page.getByRole('button', { name: /^save$/i });
    expect(await exactSave.count()).toBeLessThanOrEqual(1);

    // 3. Report: Header report button removed; only "Report Verdict" in verdict card exists
    const exactReportButtons = page.getByRole('button', { name: /^report$/i });
    expect(await exactReportButtons.count()).toBe(0);

    const reportVerdictButtons = page.getByRole('button', { name: /report verdict/i });
    expect(await reportVerdictButtons.count()).toBeLessThanOrEqual(1);

    // 4. Generate: Only in RightPanel tab header
    const generateTabsOrButtons = page.getByRole('button', { name: /^generate$/i });
    expect(await generateTabsOrButtons.count()).toBeLessThanOrEqual(1);

    // 5. Summarize: Toolbar button removed; right panel uses tab "Summary" and button "Generate Summary"
    const summarizeButtons = page.getByRole('button', { name: /^summarize$/i });
    expect(await summarizeButtons.count()).toBe(0);

    // 6. Subjects: Toolbar button removed; Generate tab has "Suggest subjects"
    const exactSubjectsButtons = page.getByRole('button', { name: /^subjects$/i });
    expect(await exactSubjectsButtons.count()).toBe(0);

    // 7. Clear: Exactly one reset/clear action in header
    const clearButtons = page.getByRole('button', { name: /^clear$/i });
    expect(await clearButtons.count()).toBeLessThanOrEqual(1);
  });
});
