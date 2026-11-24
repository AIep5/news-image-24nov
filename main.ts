// One-day world news image: Tuesday 24 November 2026.
// Draws a 1024x1024 newspaper-style front page in code: masthead naming
// the day, a UTC timeline strip, and 26 dated stories across 7 regions.
// No network, no reads, no randomness: two runs write identical bytes.
// Written fresh for news-image-20261124. Standard library only.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const W = 1024;
const H = 1024;

// 5x7 bitmap glyphs, drawn row by row. "#" is ink, "." is empty.
// Covers capitals, digits and the punctuation the headlines use.
const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "01010", "01010", "00100", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "=": ["00000", "00000", "01110", "00000", "01110", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

// ---- tiny RGB canvas -------------------------------------------------

const px = Buffer.alloc(W * H * 3);

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function drawText(str, x, y, scale, c) {
  let cx = x;
  const adv = 6 * scale;
  for (const ch of str) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += adv;
  }
  return cx - scale; // right edge of last glyph
}

function textWidth(str, scale) {
  if (str.length === 0) return 0;
  return str.length * 6 * scale - scale;
}

function centerText(str, y, scale, c) {
  const w = textWidth(str, scale);
  drawText(str, Math.round((W - w) / 2), y, scale, c);
}

// ---- deterministic PNG encoder ---------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    px.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- palette -----------------------------------------------------------

const PAPER = [247, 243, 232];
const PAPER_ALT = [238, 232, 214];
const INK = [20, 20, 20];
const MUTED = [90, 86, 76];
const NAVY = [18, 40, 75];
const NAVY_DK = [11, 26, 51];
const RED = [179, 38, 30];
const WHITE = [255, 255, 255];
const CHIP_LINE = [140, 134, 120];

const REGIONS = [
  { name: "NORTH AMERICA", color: [31, 78, 121] },
  { name: "SOUTH AMERICA", color: [46, 125, 50] },
  { name: "EUROPE", color: [106, 27, 154] },
  { name: "AFRICA", color: [230, 81, 0] },
  { name: "MIDDLE EAST", color: [179, 38, 30] },
  { name: "ASIA", color: [173, 20, 87] },
  { name: "OCEANIA", color: [0, 105, 92] },
];

// Stories: headline, day chip. "24" = happened/first reported 24 Nov 2026.
// "23" = happened 23 Nov, reported 24 Nov (marked honestly in the image).
// Every headline was verified against its primary source; see BUILD-NOTES.
const STORIES = [
  {
    region: 0,
    items: [
      { text: "MEXICO TO TRY EL CHAPO ISIDRO AT HOME, SNUBBING US EXTRADITION", day: "24" },
      { text: "PENNSYLVANIA MEASLES DEATH TOLL HITS 9; 1,638 CASES IN 46 COUNTIES", day: "23" },
      { text: "TRUMP PRESSED NVIDIA BOARD TO REINSTATE HUANG, CNN REPORTS", day: "24" },
      { text: "US BLACKLISTS MEGASPEED OVER ALLEGED NVIDIA CHIP DIVERSION", day: "23" },
    ],
  },
  {
    region: 1,
    items: [
      { text: "CAR BOMB WRECKS COLOMBIA GOVERNOR'S OFFICE; DOZENS HURT", day: "23" },
      { text: "U-17 WORLD CUP: BRAZIL, CHILE, COLOMBIA, VENEZUELA IN ACTION", day: "24" },
      { text: "PLUS ULTRA AIRLINE HALTS TICKET SALES IN PRE-INSOLVENCY CRISIS", day: "24" },
    ],
  },
  {
    region: 2,
    items: [
      { text: "RUSSIAN DRONE BRIEFLY ENTERS POLISH AIRSPACE, WARSAW SAYS", day: "24" },
      { text: "NATO WARNS RUSSIA COULD LAUNCH NUCLEAR-ARMED SATELLITE IN 60 DAYS", day: "23" },
      { text: "MERZ, RUTTE: NATO DEFENCE NOW COVERS SPACE AFTER THREAT", day: "23" },
      { text: "UK RECOGNISES ROHINGYA GENOCIDE, SANCTIONS FIVE GENERALS", day: "23" },
      { text: "NATO SENDS AWACS TO POLAND AFTER FRIDAY MISSILE CRASHES", day: "23" },
    ],
  },
  {
    region: 3,
    items: [
      { text: "SOMALIA, UGANDA SEEK FUNDS TO SUSTAIN ANTI-SHABAAB FIGHT", day: "23" },
      { text: "LIBYA CONDEMNS STRIKE ON BENGHAZI PORT; UN VOICES CONCERN", day: "24" },
    ],
  },
  {
    region: 4,
    items: [
      { text: "SAUDI STRIKES KILL 12 CIVILIANS IN YEMEN IN 48 HOURS", day: "24" },
      { text: "ISRAELI STRIKE KILLS UNRWA WORKER AT GAZA WATER WELL", day: "23" },
      { text: "IRAN VOWS TO DEFY US NAVAL BLOCKADE ON OIL EXPORTS", day: "23" },
    ],
  },
  {
    region: 5,
    items: [
      { text: "RUSSIAN JETS ENTER KOREA AIR DEFENCE ZONE; SEOUL SCRAMBLES JETS", day: "24" },
      { text: "MAGNITUDE 5.6 QUAKE HITS NEPAL-TIBET BORDER; FELT IN 4 NATIONS", day: "24" },
      { text: "NIKKEI JUMPS 3.9% TO RECORD CLOSE ON NVIDIA, EASING TENSIONS", day: "24" },
      { text: "SINGAPORE TO KEEP PROBING MEGASPEED, PM WONG SAYS", day: "24" },
      { text: "CHINA SENTENCES OFFICIAL TO DEATH FOR LEAKING 35 SECRETS", day: "23" },
      { text: "14 NATIONS BACK ICJ MYANMAR GENOCIDE RULING", day: "23" },
    ],
  },
  {
    region: 6,
    items: [
      { text: "ASX 200 SNAPS 8-DAY LOSING STREAK, UP 1.82% ON NVIDIA RALLY", day: "24" },
      { text: "AUSTRALIA PMI SINKS TO 46.1, WEAKEST IN FIVE YEARS", day: "23" },
      { text: "ACT COURT ORDERS REVIEW OF INDIGENOUS RECOGNITION PROTOCOL", day: "24" },
    ],
  },
];

// UTC timeline anchors: report times on 24 Nov 2026, verified.
const TIMELINE = [
  { time: "01:32 UTC", label: "NEPAL QUAKE" },
  { time: "02:01 UTC", label: "NIKKEI SURGES" },
  { time: "05:59 UTC", label: "ASX SNAPS STREAK" },
  { time: "08:59 UTC", label: "YEMEN TOLL RISES" },
  { time: "11:55 UTC", label: "NATO SPACE WARNING" },
  { time: "16:26 UTC", label: "SEOUL SUMMONS ENVOY" },
];

// ---- layout ------------------------------------------------------------

const MASTHEAD_H = 100;
const TIMELINE_H = 48;
const FOOTER_H = 32;
const HEADER_H = 24;
const ROW_H = 26;
const CHIP_W = 86;
const CHIP_H = 18;

function drawChip(x, y, day) {
  if (day === "24") {
    fillRect(x, y, CHIP_W, CHIP_H, RED);
    const label = "24 NOV";
    drawText(label, x + Math.round((CHIP_W - textWidth(label, 2)) / 2), y + 2, 2, WHITE);
  } else {
    fillRect(x, y, CHIP_W, CHIP_H, PAPER_ALT);
    fillRect(x, y, CHIP_W, 2, CHIP_LINE);
    fillRect(x, y + CHIP_H - 2, CHIP_W, 2, CHIP_LINE);
    fillRect(x, y, 2, CHIP_H, CHIP_LINE);
    fillRect(x + CHIP_W - 2, y, 2, CHIP_H, CHIP_LINE);
    const label = "23 NOV";
    drawText(label, x + Math.round((CHIP_W - textWidth(label, 2)) / 2), y + 2, 2, MUTED);
  }
}

function drawMasthead() {
  fillRect(0, 0, W, MASTHEAD_H, NAVY);
  fillRect(0, 0, W, 6, RED);
  drawText("24 NOVEMBER 2026", 24, 20, 5, WHITE);
  drawText("TUESDAY - WORLD NEWS IN ONE IMAGE - ALL TIMES UTC", 26, 66, 2, [200, 208, 224]);
  // Right-hand count box.
  const bx = 806;
  const by = 16;
  fillRect(bx, by, 194, 68, NAVY_DK);
  fillRect(bx, by, 194, 2, RED);
  fillRect(bx, by + 66, 194, 2, RED);
  fillRect(bx, by, 2, 68, RED);
  fillRect(bx + 192, by, 2, 68, RED);
  centerTextIn("26 STORIES", bx, 194, by + 10, 2, WHITE);
  centerTextIn("7 REGIONS", bx, 194, by + 38, 2, [200, 208, 224]);
  fillRect(0, MASTHEAD_H - 3, W, 3, RED);
}

function centerTextIn(str, x, w, y, scale, c) {
  drawText(str, x + Math.round((w - textWidth(str, scale)) / 2), y, scale, c);
}

function drawTimeline() {
  const y0 = MASTHEAD_H;
  fillRect(0, y0, W, TIMELINE_H, PAPER_ALT);
  const lineY = y0 + 29;
  fillRect(16, lineY, W - 32, 2, CHIP_LINE);
  const colW = W / TIMELINE.length;
  TIMELINE.forEach((t, i) => {
    const cx = Math.round(colW * i + colW / 2);
    const tw = textWidth(t.time, 2);
    drawText(t.time, cx - Math.round(tw / 2), y0 + 6, 2, RED);
    fillRect(cx - 4, lineY - 3, 8, 8, RED);
    const lw = textWidth(t.label, 1);
    drawText(t.label, cx - Math.round(lw / 2), lineY + 5, 1, INK);
  });
  fillRect(0, y0 + TIMELINE_H - 2, W, 2, NAVY);
}

function drawStories() {
  let y = MASTHEAD_H + TIMELINE_H;
  for (const band of STORIES) {
    const reg = REGIONS[band.region];
    fillRect(0, y, W, HEADER_H, reg.color);
    drawText(reg.name, 16, y + 5, 2, WHITE);
    const count = band.items.length + " STORIES";
    drawText(count, W - 16 - textWidth(count, 2), y + 5, 2, WHITE);
    y += HEADER_H;
    band.items.forEach((item, i) => {
      fillRect(0, y, W, ROW_H, i % 2 === 0 ? PAPER : PAPER_ALT);
      fillRect(0, y, 8, ROW_H, reg.color);
      fillRect(20, y + 9, 8, 8, reg.color);
      drawText(item.text, 38, y + 6, 2, INK);
      drawChip(W - 16 - CHIP_W, y + 4, item.day);
      y += ROW_H;
    });
  }
  return y;
}

function drawFooter(y) {
  fillRect(0, y, W, FOOTER_H, NAVY_DK);
  centerText(
    "ALL STORIES VERIFIED AGAINST PRIMARY SOURCES - 23 NOV ITEMS MARKED",
    y + 9,
    2,
    [200, 208, 224]
  );
}

// ---- main --------------------------------------------------------------

function main() {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawTimeline();
  const endY = drawStories();
  drawFooter(endY);
  const out = process.argv[2] || "/output/entry.png";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng());
}

main();
