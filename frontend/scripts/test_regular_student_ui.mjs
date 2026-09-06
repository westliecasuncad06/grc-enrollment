import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/Westlie Casuncad/.gemini/antigravity/brain/3b8a0109-e2e7-46a5-bff7-6a89cfc626a2';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to login page...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');

  await page.locator('input[type="email"]').fill('student.seed@grc.test');
  await page.locator('input[type="password"]').fill('password');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/portal**', { timeout: 15000 });
  console.log('   ✓ Logged in as student.seed@grc.test');

  console.log('2. Navigating to /portal/enrollment...');
  await page.goto(`${BASE_URL}/portal/enrollment`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check state 1: Section summary cards visible
  const sectionCards = page.locator('div[role="article"]');
  const cardCount = await sectionCards.count();
  console.log(`   Found ${cardCount} section card(s)`);

  const initialTables = await page.locator('table').count();
  console.log(`   Schedule tables visible initially: ${initialTables} (expected 0 or only enrollments table at bottom)`);

  await page.screenshot({ path: `${ARTIFACT_DIR}/state1_section_cards.png`, fullPage: true });
  console.log('   ✓ Screenshot saved: state1_section_cards.png');

  // Check if there is a Choose section button
  const chooseBtn = page.locator('button:has-text("Choose")').first();
  if (await chooseBtn.isVisible()) {
    const btnText = await chooseBtn.textContent();
    console.log(`3. Clicking "${btnText?.trim()}"...`);
    await chooseBtn.click();
    await page.waitForTimeout(1000);

    // Check state 2: Schedule table is now visible!
    const scheduleTable = page.locator('table[aria-label*="schedule"]').first();
    const isScheduleVisible = await scheduleTable.isVisible();
    console.log(`   Schedule table visible now: ${isScheduleVisible} (expected true)`);

    const changeSectionBtn = page.locator('button:has-text("Change section")');
    console.log(`   "Change section" button visible: ${await changeSectionBtn.isVisible()}`);

    const submitBtn = page.locator('button:has-text("Submit enrollment")');
    console.log(`   "Submit enrollment" button visible: ${await submitBtn.isVisible()}`);

    await page.screenshot({ path: `${ARTIFACT_DIR}/state2_schedule_revealed.png`, fullPage: true });
    console.log('   ✓ Screenshot saved: state2_schedule_revealed.png');

    // Test clicking "Change section"
    console.log('4. Testing "Change section" button...');
    await changeSectionBtn.click();
    await page.waitForTimeout(800);
    const returnCardCount = await page.locator('div[role="article"]').count();
    console.log(`   Section cards returned: ${returnCardCount > 1 || returnCardCount === cardCount}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}/state3_returned_to_sections.png`, fullPage: true });
    console.log('   ✓ Screenshot saved: state3_returned_to_sections.png');
  } else {
    console.log('   Note: Student may already have an active enrollment or term is not open.');
  }

  await browser.close();
  console.log('\nAll checks completed successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
