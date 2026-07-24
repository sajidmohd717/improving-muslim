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

// Speaker photos used in the promo hooks, copied from the site's assets.
// NOTE: mm.jpg is Majed Mahmoud — Mufti Menk is mufti.jpeg.
// Only speakers whose content is actually on the platform belong here.
// Source resolution matters: a 172px circle needs ~350px+ to stay sharp in the
// 2x render, which rules out the 176px photos (ba, mm, yq).
const SPEAKER_PHOTOS = {
  // video #1 — the four best-known
  'speaker-mufti-menk.jpg': 'mufti.jpeg',
  'speaker-omar-suleiman.jpg': 'os.jpg',
  'speaker-ali-hammuda.jpg': 'ah.jpg',
  'speaker-navaid-aziz.jpg': 'navaid-aziz.jpg',
  // video #2 — a different four
  'speaker-belal-assaad.jpg': 'ba.jpg',
  'speaker-majed-mahmoud.jpg': 'mm.jpg',
  'speaker-abu-taymiyyah.jpg': 'abu-taymiyyah.jpg',
  'speaker-yasir-qadhi.jpg': 'yq.jpg',
};

// A speaker circle is ~150px in the composition, doubled by the 2x render.
// Below this the face visibly softens — video #1 shipped with 176px sources
// before anyone noticed, so fail loudly rather than let it through again.
const MIN_PHOTO_PX = 350;

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const isSOF = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const speakerDir = path.join(__dirname, '..', '..', 'assets', 'speaker');
  const tooSmall = [];
  for (const [dest, src] of Object.entries(SPEAKER_PHOTOS)) {
    const buf = fs.readFileSync(path.join(speakerDir, src));
    const size = jpegSize(buf);
    if (size && Math.min(size.w, size.h) < MIN_PHOTO_PX) {
      tooSmall.push(`${src} is ${size.w}x${size.h}, needs ${MIN_PHOTO_PX}px+`);
    }
    fs.writeFileSync(path.join(OUT, dest), buf);
  }
  // Warn rather than fail: not every photo here is used by the video being
  // rendered, and blocking the screenshot capture over an unrelated one helps
  // nobody. Printed last so it's the final thing on screen.
  const warnUndersized = () => {
    if (!tooSmall.length) return;
    console.warn('\n⚠  Speaker photos too small for a 2x render:');
    for (const line of tooSmall) console.warn('   - ' + line);
    console.warn('   Only matters if the video you are rendering uses them.');
    console.warn('   Replacing them in assets/speaker/ also improves the site.\n');
  };
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
  warnUndersized();
})();
