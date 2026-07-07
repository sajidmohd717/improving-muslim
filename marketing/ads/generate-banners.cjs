const fs = require("fs");
const path = require("path");

const outDir = __dirname;

const brand = {
  cream: "#fffdf8",
  soft: "#f7f3ec",
  green: "#176b5b",
  greenDeep: "#0f4a3f",
  gold: "#c89b3c",
  ink: "#18201b",
  muted: "#68726b",
  line: "#ded6c8",
};

const font = "Inter, Arial, sans-serif";

function logo(x, y, scale) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M256 76c54 38 102 91 102 168v104H154V244c0-77 48-130 102-168Z" fill="${brand.soft}" stroke="${brand.green}" stroke-width="24" stroke-linejoin="round"/>
    <path d="M256 145c32 25 58 59 58 107v96H198v-96c0-48 26-82 58-107Z" fill="${brand.green}"/>
    <path d="M256 191c17 16 31 38 31 68v89h-62v-89c0-30 14-52 31-68Z" fill="${brand.cream}"/>
    <path d="M96 368c58-16 112-7 160 26 48-33 102-42 160-26v38c-58-14-112-5-160 28-48-33-102-42-160-28v-38Z" fill="${brand.cream}" stroke="${brand.green}" stroke-width="22" stroke-linejoin="round"/>
    <path d="M256 394v40" stroke="${brand.gold}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="256" cy="57" r="15" fill="${brand.gold}"/>
    <circle cx="128" cy="150" r="12" fill="${brand.gold}"/>
    <circle cx="384" cy="150" r="12" fill="${brand.gold}"/>
  </g>`;
}

function tspans(lines, x, y, size, lineHeight, weight = 800, fill = brand.ink, anchor = "start") {
  return `
    <text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="${font}" font-size="${size}" font-weight="${weight}">
      ${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`).join("")}
    </text>`;
}

function ctaPill(x, y, w, h, fontSize, anchor = "start") {
  const textX = anchor === "middle" ? x + w / 2 : x + Math.round(h * 0.4);
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(h / 6)}" fill="${brand.green}"/>
    <text x="${textX}" y="${y + h / 2 + fontSize * 0.36}" text-anchor="${anchor}" fill="${brand.cream}" font-family="${font}" font-size="${fontSize}" font-weight="900">improvingmuslim.com</text>`;
}

// 1080x1080 — Instagram/Facebook feed
const igFeed = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${brand.cream}"/>
  <circle cx="962" cy="168" r="72" fill="${brand.soft}" stroke="${brand.line}" stroke-width="2"/>
  ${logo(760, 66, 0.38)}
  <text x="84" y="112" fill="${brand.green}" font-family="${font}" font-size="25" font-weight="900" letter-spacing="2.2">IMPROVING MUSLIM</text>
  ${tspans(["Islamic lectures.", "No ads.", "No distractions."], 84, 340, 88, 104)}
  ${tspans(["Complete series from trusted speakers,", "organized by topic. Free, forever."], 84, 700, 34, 46, 700, brand.muted)}
  ${ctaPill(84, 800, 620, 96, 39)}
  <circle cx="86" cy="1000" r="8" fill="${brand.gold}"/><circle cx="117" cy="1000" r="8" fill="${brand.gold}"/><circle cx="148" cy="1000" r="8" fill="${brand.gold}"/>
</svg>`;

// 1080x1920 — IG Stories / TikTok / YouTube Shorts
const story = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${brand.cream}"/>
  <circle cx="540" cy="430" r="190" fill="${brand.soft}" stroke="${brand.line}" stroke-width="2"/>
  ${logo(392, 285, 0.58)}
  <text x="540" y="760" text-anchor="middle" fill="${brand.green}" font-family="${font}" font-size="30" font-weight="900" letter-spacing="2.6">IMPROVING MUSLIM</text>
  ${tspans(["Islamic lectures.", "No ads.", "No distractions."], 540, 920, 92, 112, 800, brand.ink, "middle")}
  ${tspans(["Complete series from trusted speakers,", "organized by topic. Free, forever."], 540, 1280, 36, 50, 700, brand.muted, "middle")}
  ${ctaPill(210, 1430, 660, 104, 41, "middle")}
  <circle cx="493" cy="1650" r="8" fill="${brand.gold}"/><circle cx="524" cy="1650" r="8" fill="${brand.gold}"/><circle cx="555" cy="1650" r="8" fill="${brand.gold}"/>
</svg>`;

// 1280x720 — YouTube / landscape display
const landscape = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="${brand.cream}"/>
  <rect x="856" width="424" height="720" fill="${brand.soft}"/>
  <line x1="856" y1="0" x2="856" y2="720" stroke="${brand.line}" stroke-width="2"/>
  ${logo(950, 210, 0.46)}
  <text x="84" y="104" fill="${brand.green}" font-family="${font}" font-size="24" font-weight="900" letter-spacing="2.2">IMPROVING MUSLIM</text>
  ${tspans(["Islamic lectures.", "No ads. No distractions."], 84, 250, 64, 82)}
  ${tspans(["Complete series from trusted speakers, organized by topic.", "Free, forever."], 84, 430, 28, 40, 700, brand.muted)}
  ${ctaPill(84, 530, 520, 84, 34)}
</svg>`;

// 728x90 — Google Display leaderboard
const leaderboard = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="728" height="90" viewBox="0 0 728 90">
  <rect width="728" height="90" fill="${brand.cream}"/>
  <rect width="728" height="90" fill="none" stroke="${brand.line}" stroke-width="2"/>
  ${logo(14, 10, 0.14)}
  <text x="98" y="40" fill="${brand.ink}" font-family="${font}" font-size="24" font-weight="800">Islamic lectures. No ads. No distractions.</text>
  <text x="98" y="70" fill="${brand.muted}" font-family="${font}" font-size="16" font-weight="700">Complete series from trusted speakers — free, forever.</text>
  <rect x="512" y="24" width="200" height="42" rx="8" fill="${brand.green}"/>
  <text x="612" y="51" text-anchor="middle" fill="${brand.cream}" font-family="${font}" font-size="17" font-weight="900">improvingmuslim.com</text>
</svg>`;

// 300x250 — Google Display medium rectangle
const rectangle = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="250" viewBox="0 0 300 250">
  <rect width="300" height="250" fill="${brand.cream}"/>
  <rect width="300" height="250" fill="none" stroke="${brand.line}" stroke-width="2"/>
  ${logo(112, 14, 0.15)}
  ${tspans(["Islamic lectures.", "No ads. No distractions."], 150, 125, 21, 27, 800, brand.ink, "middle")}
  <text x="150" y="180" text-anchor="middle" fill="${brand.muted}" font-family="${font}" font-size="13" font-weight="700">Free, forever.</text>
  <rect x="45" y="198" width="210" height="36" rx="8" fill="${brand.green}"/>
  <text x="150" y="221" text-anchor="middle" fill="${brand.cream}" font-family="${font}" font-size="15" font-weight="900">improvingmuslim.com</text>
</svg>`;

const banners = {
  "ig-feed-1080x1080.svg": igFeed,
  "story-1080x1920.svg": story,
  "landscape-1280x720.svg": landscape,
  "leaderboard-728x90.svg": leaderboard,
  "rectangle-300x250.svg": rectangle,
};

Object.entries(banners).forEach(([name, svg]) => {
  fs.writeFileSync(path.join(outDir, name), svg);
});

console.log(`Wrote ${Object.keys(banners).length} banner SVGs to ${outDir}`);
