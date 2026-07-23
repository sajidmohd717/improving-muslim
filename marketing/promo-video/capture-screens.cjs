// Captures phone-sized screenshots of the live site for the Remotion promo.
// Usage: node marketing/promo-video/capture-screens.cjs  (dev server must be on :4173)
const { chromium, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:4173';
const OUT = path.join(__dirname, 'public');

const shots = [
  { name: 'home', url: '/', fullPage: true },
  { name: 'series-lom', url: '/series/life-of-muhammad-mufti-menk/', fullPage: true },
  { name: 'watch-lom', url: '/watch/life-of-muhammad-mufti-menk/VO22l6-Qkys/', fullPage: false },
  { name: 'explore', url: '/pages/explore.html', fullPage: true },
];

// Fixed-position elements repeat mid-page in fullPage captures; hide them there.
const HIDE_FIXED_CSS = '.bottom-nav { display: none !important; }';

// Speaker photos used in the PromoV2 hook, copied from the site's assets.
// NOTE: mm.jpg is Majed Mahmoud — Mufti Menk is mufti.jpeg.
const SPEAKER_PHOTOS = {
  'speaker-mufti-menk.jpg': 'mufti.jpeg',
  'speaker-omar-suleiman.jpg': 'os.jpg',
  'speaker-ali-hammuda.jpg': 'ah.jpg',
  'speaker-navaid-aziz.jpg': 'navaid-aziz.jpg',
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const speakerDir = path.join(__dirname, '..', '..', 'assets', 'speaker');
  for (const [dest, src] of Object.entries(SPEAKER_PHOTOS)) {
    fs.copyFileSync(path.join(speakerDir, src), path.join(OUT, dest));
  }
  const browser = await chromium.launch();
  // Explicit viewport matching the Remotion phone screen basis (375x812)
  // so viewport captures fill the mockup screen exactly.
  const ctx = await browser.newContext({
    userAgent: devices['iPhone 13 Pro'].userAgent,
    viewport: { width: 375, height: 812 },
    // 4x density so screenshots stay sharper-than-needed even in the 2x
    // (2160x3840) high-quality render
    deviceScaleFactor: 4,
    isMobile: true,
    hasTouch: true,
  });
  for (const shot of shots) {
    const page = await ctx.newPage();
    await page.goto(BASE + shot.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if (shot.fullPage) await page.addStyleTag({ content: HIDE_FIXED_CSS });
    await page.screenshot({
      path: path.join(OUT, `${shot.name}.png`),
      fullPage: shot.fullPage,
    });
    console.log(`captured ${shot.name}`);
    await page.close();
  }
  await browser.close();
})();
