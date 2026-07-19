// Renders the Instagram post PNGs from the HTML templates in this folder.
// Run from anywhere: node marketing/render-instagram-posts.cjs
// Requires the repo's npm dependencies (npm install) — uses Playwright's Chromium.
const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "node_modules", "playwright"));

const SIZE = { width: 1080, height: 1350 };

// Speaker spotlight posts. To add a speaker: copy an entry, point PHOTO at
// ../assets/speaker/*.jpg and THUMB1/2 at ../assets/thumbnail/**, re-run.
// COUNT values are editorial (full-series counts used in ads) — keep them
// honest against what the platform will actually offer.
const speakers = [
  {
    out: "ig-speaker-mufti-menk.png",
    NAME: "Mufti Menk",
    PHOTO: "../assets/speaker/mufti.jpeg",
    SUBLINE: "His lectures, <strong>free</strong> on Improving Muslim",
    THUMB1: "../assets/thumbnail/life-of-muhammad-mufti-menk/series-card.jpg",
    COUNT1: "30 episodes",
    TITLE1: "Life of Muhammad (PBUH)",
    SUB1: "Seerah series",
    THUMB2: "../assets/thumbnail/standalone/mufti-menk/purpose-of-creation.jpg",
    COUNT2: "1:01:43",
    TITLE2: "Purpose of Creation",
    SUB2: "Standalone lecture",
  },
  {
    out: "ig-speaker-omar-suleiman.png",
    NAME: "Omar Suleiman",
    PHOTO: "../assets/speaker/os.jpg",
    SUBLINE: "His series, <strong>free</strong> on Improving Muslim",
    THUMB1: "../assets/thumbnail/heart-softeners/whyme.jpg",
    COUNT1: "30 episodes",
    TITLE1: "Why Me?",
    SUB1: "Purification series",
    THUMB2: "../assets/thumbnail/heart-softeners/angels1.jpg",
    COUNT2: "31 episodes",
    TITLE2: "Angels in Your Presence",
    SUB2: "Short episodes · perfect for daily habit",
  },
  {
    out: "ig-speaker-ali-hammuda.png",
    NAME: "Ali Hammuda",
    PHOTO: "../assets/speaker/ah.jpg",
    SUBLINE: "His series, <strong>free</strong> on Improving Muslim",
    THUMB1: "../assets/thumbnail/heart-softeners/changeofheart-card.jpg",
    COUNT1: "20 episodes",
    TITLE1: "Change of Heart",
    SUB1: "Purification series",
    THUMB2: "../assets/thumbnail/salah/enjoy-your-prayer-card.jpg",
    COUNT2: "21 episodes",
    TITLE2: "Enjoy Your Prayer",
    SUB2: "Prayer series",
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });

  const shoot = async (htmlFile, outFile) => {
    await page.goto("file://" + path.join(__dirname, htmlFile).replace(/\\/g, "/"), { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // let webfonts settle
    await page.screenshot({ path: path.join(__dirname, outFile) });
    console.log("rendered", outFile);
  };

  // 1. Main launch/ad post
  await shoot("instagram-post-template.html", "instagram-post-1080x1350.png");

  // 2. Speaker spotlights
  const template = fs.readFileSync(path.join(__dirname, "ig-speaker-template.html"), "utf8");
  const tmp = path.join(__dirname, ".ig-speaker-tmp.html");
  for (const s of speakers) {
    let html = template;
    for (const [key, value] of Object.entries(s)) {
      if (key !== "out") html = html.split(`{{${key}}}`).join(value);
    }
    fs.writeFileSync(tmp, html);
    await shoot(".ig-speaker-tmp.html", s.out);
  }
  fs.unlinkSync(tmp);

  await browser.close();
})();
