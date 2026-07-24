// Captures the My Notes flow on a real watch page for the "notes" promo video.
// Drives the actual UI rather than mocking it, so what the video shows is what
// the site does. The typing progression is captured frame by frame, so the
// video plays back real typing instead of a cross-fade.
// Usage: node marketing/promo-video/capture-notes.cjs   (dev server on :4173)
const { chromium, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:4173';
const EPISODE = '/watch/life-of-muhammad-mufti-menk/VO22l6-Qkys/';
const OUT = path.join(__dirname, 'public');

const AT_SECONDS = 12 * 60 + 45; // player position, so the chip reads 12:45
const LATER_SECONDS = 38 * 60 + 20; // deep into the lecture, before the tap
const NOTE_BODY = 'He was called **Al-Ameen** — the trustworthy — years before prophethood';
const CHARS_PER_STEP = 4; // ~18 typing frames; fast enough to read as typing
const SCROLL_Y = 170; // frame the note area without losing the player

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Clear any previous typing frames so a shorter note can't leave strays
  for (const f of fs.readdirSync(OUT)) {
    if (f.startsWith('notes-type-')) fs.unlinkSync(path.join(OUT, f));
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent: devices['iPhone 13 Pro'].userAgent,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 4,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + EPISODE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Park the player so the timestamp control shows a plausible position.
  await page.evaluate((t) => {
    const v = document.querySelector('video');
    if (!v) return;
    try { v.currentTime = t; } catch {}
    v.pause();
    v.dispatchEvent(new Event('timeupdate'));
  }, AT_SECONDS);
  await page.waitForTimeout(400);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `notes-${name}.png`) });
  };

  // Open the editor (mobile starts collapsed when there is no note yet)
  if (await page.locator('.notes-panel.is-collapsed').count()) {
    await page.locator('#notes-panel-toggle').click();
    await page.waitForTimeout(500);
  }
  await page.locator('.notes-panel').scrollIntoViewIfNeeded();
  await page.evaluate((y) => window.scrollBy(0, y), SCROLL_Y);
  await page.waitForTimeout(500);
  await shot('01-open');
  console.log('captured 01-open');

  // Insert the timestamp with the real button
  await page.locator('#notes-insert-timestamp').click();
  await page.waitForTimeout(400);
  await shot('02-timestamp');
  console.log('captured 02-timestamp');

  // Type in steps, capturing each one
  const textarea = page.locator('#notes-textarea');
  await textarea.click();
  let step = 0;
  for (let i = 0; i < NOTE_BODY.length; i += CHARS_PER_STEP) {
    await textarea.type(NOTE_BODY.slice(i, i + CHARS_PER_STEP), { delay: 0 });
    await page.waitForTimeout(60);
    await shot(`type-${String(step).padStart(3, '0')}`);
    step += 1;
  }
  console.log(`captured ${step} typing frames`);

  // Let autosave settle so the status reads "Saved"
  await page.waitForTimeout(1800);
  await shot('03-saved');
  console.log('captured 03-saved');

  // Preview tab: timestamps render as buttons that seek the player
  await page.locator('[data-notes-tab="preview"]').click();
  await page.waitForTimeout(700);
  await shot('04-preview');
  console.log('captured 04-preview');

  // Record where the rendered timestamp chip sits, in screen-basis px, so the
  // video can put its tap indicator exactly on it without hand-tuned offsets.
  const chip = await page.evaluate(() => {
    const el = document.querySelector('.note-timestamp');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  });
  if (!chip) throw new Error('No .note-timestamp found in preview — check the note text has a MM:SS token');
  console.log('timestamp chip at', chip);

  // The payoff: move deep into the lecture, then tap the note's timestamp and
  // let the real handler seek the player back to the noted moment.
  await page.evaluate((t) => {
    const v = document.querySelector('video');
    if (!v) return;
    try { v.currentTime = t; } catch {}
    v.pause();
    v.dispatchEvent(new Event('timeupdate'));
  }, LATER_SECONDS);
  await page.waitForTimeout(600);
  await shot('05-later');
  console.log('captured 05-later');

  await page.locator('.note-timestamp').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('video')?.pause());
  await page.waitForTimeout(900); // let the smooth scrollIntoView settle
  await shot('06-seeked');
  console.log('captured 06-seeked');

  fs.writeFileSync(
    path.join(OUT, 'notes-manifest.json'),
    JSON.stringify({ typingFrames: step, chip }, null, 2)
  );
  await browser.close();
})();
