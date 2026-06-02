const fs = require("fs");
const path = require("path");

const outDir = __dirname;

const brand = {
  cream: "#fffdf8",
  soft: "#f7f3ec",
  green: "#176b5b",
  gold: "#c89b3c",
  ink: "#18201b",
  muted: "#68726b",
  line: "#ded6c8",
};

const logo = `
  <g transform="translate(760 66) scale(0.38)">
    <path d="M256 76c54 38 102 91 102 168v104H154V244c0-77 48-130 102-168Z" fill="${brand.soft}" stroke="${brand.green}" stroke-width="24" stroke-linejoin="round"/>
    <path d="M256 145c32 25 58 59 58 107v96H198v-96c0-48 26-82 58-107Z" fill="${brand.green}"/>
    <path d="M256 191c17 16 31 38 31 68v89h-62v-89c0-30 14-52 31-68Z" fill="${brand.cream}"/>
    <path d="M96 368c58-16 112-7 160 26 48-33 102-42 160-26v38c-58-14-112-5-160 28-48-33-102-42-160-28v-38Z" fill="${brand.cream}" stroke="${brand.green}" stroke-width="22" stroke-linejoin="round"/>
    <path d="M256 394v40" stroke="${brand.gold}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="256" cy="57" r="15" fill="${brand.gold}"/>
    <circle cx="128" cy="150" r="12" fill="${brand.gold}"/>
    <circle cx="384" cy="150" r="12" fill="${brand.gold}"/>
  </g>`;

function tspans(lines, x, y, size, lineHeight, weight = 800, fill = brand.ink) {
  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`).join("")}
    </text>`;
}

function label(text) {
  return `
    <text x="84" y="112" fill="${brand.green}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="2.2">
      ${text}
    </text>`;
}

function footer(slideNumber) {
  return `
    <line x1="84" y1="942" x2="996" y2="942" stroke="${brand.line}" stroke-width="2"/>
    <text x="84" y="988" fill="${brand.muted}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800">Improving Muslim</text>
    <text x="996" y="988" text-anchor="end" fill="${brand.muted}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800">${slideNumber}/5</text>`;
}

function shell(slideNumber, body, accent = true) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${brand.cream}"/>
  <circle cx="962" cy="168" r="72" fill="${brand.soft}" stroke="${brand.line}" stroke-width="2"/>
  ${accent ? `<circle cx="86" cy="820" r="8" fill="${brand.gold}"/><circle cx="117" cy="820" r="8" fill="${brand.gold}"/><circle cx="148" cy="820" r="8" fill="${brand.gold}"/>` : ""}
  ${logo}
  ${body}
  ${footer(slideNumber)}
</svg>`;
}

const slides = [
  shell(
    1,
    `${label("A CALMER WAY TO LEARN")}
     ${tspans(["Islamic lectures", "without the", "noise."], 84, 370, 92, 104)}
     <rect x="84" y="695" width="350" height="8" rx="4" fill="${brand.gold}"/>
     ${tspans(["No ads. No clutter. No endless scroll."], 84, 760, 32, 42, 800, brand.muted)}`,
  ),
  shell(
    2,
    `${label("THE PROBLEM")}
     ${tspans(["You open a lecture", "for one beneficial", "reminder."], 84, 330, 72, 86)}
     ${tspans(["Then the recommendations begin."], 84, 650, 44, 56, 900, brand.green)}
     ${tspans(["One tap becomes ten. A reminder becomes a rabbit hole."], 84, 730, 31, 42, 760, brand.muted)}`,
  ),
  shell(
    3,
     `${label("WHAT WE REMOVE")}
     ${tspans(["No ads.", "No pop-ups.", "No endless", "recommendations."], 84, 258, 72, 84)}
     <rect x="84" y="682" width="512" height="2" fill="${brand.line}"/>
     ${tspans(["No unrelated videos", "pulling your attention away."], 84, 738, 32, 40, 800, brand.muted)}`,
  ),
  shell(
    4,
    `${label("WHAT WE ARE BUILDING")}
     ${tspans(["A focused place", "for Islamic", "lecture series."], 84, 326, 78, 92)}
     ${tspans(["Organized by topic.", "Built for quiet study.", "Made to help you stay with what you came to watch."], 84, 658, 32, 44, 760, brand.muted)}
     <rect x="84" y="828" width="196" height="8" rx="4" fill="${brand.gold}"/>`,
  ),
  shell(
    5,
    `${label("START WATCHING")}
     ${tspans(["Beneficial", "content.", "Less noise."], 84, 322, 88, 100)}
     <rect x="84" y="680" width="620" height="96" rx="14" fill="${brand.green}"/>
     <text x="122" y="741" fill="${brand.cream}" font-family="Inter, Arial, sans-serif" font-size="39" font-weight="900">improvingmuslim.com</text>
     ${tspans(["Share it with someone who wants to learn without distractions."], 84, 842, 30, 42, 760, brand.muted)}`,
    false,
  ),
];

slides.forEach((svg, index) => {
  fs.writeFileSync(path.join(outDir, `slide-${String(index + 1).padStart(2, "0")}.svg`), svg);
});

console.log(`Wrote ${slides.length} SVG slides to ${outDir}`);
