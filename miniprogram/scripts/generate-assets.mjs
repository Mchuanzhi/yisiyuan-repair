import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
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
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function hex(color) {
  const value = color.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  set(x, y, color, alpha = 255) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const index = (py * this.width + px) * 4;
    const srcA = alpha / 255;
    const dstA = this.data[index + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (!outA) return;
    for (let channel = 0; channel < 3; channel += 1) {
      this.data[index + channel] = Math.round((color[channel] * srcA + this.data[index + channel] * dstA * (1 - srcA)) / outA);
    }
    this.data[index + 3] = Math.round(outA * 255);
  }

  fill(color) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) this.set(x, y, color, color[3] ?? 255);
    }
  }

  fillRect(x, y, w, h, color, alpha = 255) {
    for (let py = y; py < y + h; py += 1) {
      for (let px = x; px < x + w; px += 1) this.set(px, py, color, alpha);
    }
  }

  fillRoundRect(x, y, w, h, radius, color, alpha = 255) {
    const r = Math.min(radius, w / 2, h / 2);
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        let inside = true;
        if (px < r && py < r) inside = (px - r) ** 2 + (py - r) ** 2 <= r * r;
        else if (px >= w - r && py < r) inside = (px - (w - r)) ** 2 + (py - r) ** 2 <= r * r;
        else if (px < r && py >= h - r) inside = (px - r) ** 2 + (py - (h - r)) ** 2 <= r * r;
        else if (px >= w - r && py >= h - r) inside = (px - (w - r)) ** 2 + (py - (h - r)) ** 2 <= r * r;
        if (inside) this.set(x + px, y + py, color, alpha);
      }
    }
  }

  fillCircle(cx, cy, radius, color, alpha = 255) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.set(x, y, color, alpha);
      }
    }
  }

  strokeCircle(cx, cy, radius, width, color) {
    const outer = (radius + width / 2) ** 2;
    const inner = Math.max(0, radius - width / 2) ** 2;
    for (let y = Math.floor(cy - radius - width); y <= cy + radius + width; y += 1) {
      for (let x = Math.floor(cx - radius - width); x <= cx + radius + width; x += 1) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= outer && d >= inner) this.set(x, y, color);
      }
    }
  }

  strokeRoundRect(x, y, w, h, radius, width, color) {
    const r = Math.min(radius, w / 2, h / 2);
    const innerW = w - width * 2;
    const innerH = h - width * 2;
    const innerR = Math.max(0, r - width);
    const inside = (px, py, boxW, boxH, boxR) => {
      if (px < 0 || py < 0 || px >= boxW || py >= boxH) return false;
      if (px < boxR && py < boxR) return (px - boxR) ** 2 + (py - boxR) ** 2 <= boxR * boxR;
      if (px >= boxW - boxR && py < boxR) return (px - (boxW - boxR)) ** 2 + (py - boxR) ** 2 <= boxR * boxR;
      if (px < boxR && py >= boxH - boxR) return (px - boxR) ** 2 + (py - (boxH - boxR)) ** 2 <= boxR * boxR;
      if (px >= boxW - boxR && py >= boxH - boxR) return (px - (boxW - boxR)) ** 2 + (py - (boxH - boxR)) ** 2 <= boxR * boxR;
      return true;
    };
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        if (!inside(px, py, w, h, r)) continue;
        if (inside(px - width, py - width, innerW, innerH, innerR)) continue;
        this.set(x + px, y + py, color);
      }
    }
  }

  line(x1, y1, x2, y2, width, color) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(length * 2));
    const r = width / 2;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      this.fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, color);
    }
  }

  text(value, x, y, scale, color) {
    let cursor = x;
    const text = String(value).toUpperCase();
    for (const char of text) {
      const glyph = FONT[char] || FONT[" "];
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < glyph[row].length; col += 1) {
          if (glyph[row][col] === "1") this.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
      cursor += 6 * scale;
    }
    return cursor - x;
  }

  textWidth(value, scale) {
    return String(value).length * 6 * scale - scale;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(canvas) {
  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    canvas.data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writePng(file, canvas) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(canvas));
}

function card(draw) {
  const canvas = new Canvas(360, 252);
  canvas.fillRoundRect(0, 0, 360, 252, 36, hex("#ffffff"));
  canvas.fillCircle(292, 42, 28, hex("#79D7FF"), 70);
  canvas.fillCircle(48, 210, 26, hex("#E8E5FF"), 180);
  draw(canvas);
  return canvas;
}

function documentIcon(color, filled) {
  const canvas = new Canvas(81, 81);
  const ink = hex(color);
  if (filled) canvas.fillRoundRect(22, 14, 38, 52, 8, ink, 28);
  canvas.line(24, 22, 24, 58, 4, ink);
  canvas.line(58, 22, 58, 58, 4, ink);
  canvas.line(24, 20, 58, 20, 4, ink);
  canvas.line(24, 60, 58, 60, 4, ink);
  canvas.line(32, 32, 50, 32, 4, ink);
  canvas.line(32, 42, 50, 42, 4, ink);
  canvas.line(32, 52, 44, 52, 4, ink);
  return canvas;
}

function clockIcon(color, filled) {
  const canvas = new Canvas(81, 81);
  const ink = hex(color);
  if (filled) canvas.fillCircle(40, 40, 24, ink, 28);
  canvas.strokeCircle(40, 40, 22, 4, ink);
  canvas.line(40, 40, 40, 26, 4, ink);
  canvas.line(40, 40, 52, 46, 4, ink);
  return canvas;
}

function personIcon(color, filled) {
  const canvas = new Canvas(81, 81);
  const ink = hex(color);
  const scale = 2.2;
  const ox = 14.1;
  const oy = 6.4;
  const stroke = 4;
  const headX = ox + 12 * scale;
  const headY = oy + 8 * scale;
  const headR = 4 * scale;
  const bodyX = ox + 12 * scale;
  const bodyY = oy + 19 * scale;
  const bodyR = 8 * scale;
  if (filled) {
    canvas.fillCircle(headX, headY, headR, ink, 28);
    for (let y = Math.floor(bodyY); y <= bodyY + bodyR + 2; y += 1) {
      for (let x = Math.floor(bodyX - bodyR); x <= bodyX + bodyR; x += 1) {
        if ((x - bodyX) ** 2 + (y - bodyY) ** 2 <= bodyR * bodyR) canvas.set(x, y, ink, 28);
      }
    }
  }
  canvas.strokeCircle(headX, headY, headR, stroke, ink);
  const cap = 2 * scale;
  canvas.line(bodyX - bodyR, bodyY, bodyX - bodyR, bodyY + cap, stroke, ink);
  canvas.line(bodyX + bodyR, bodyY, bodyX + bodyR, bodyY + cap, stroke, ink);
  let previous = null;
  const steps = 36;
  for (let index = 0; index <= steps; index += 1) {
    const theta = Math.PI - (Math.PI * index) / steps;
    const point = [bodyX + bodyR * Math.cos(theta), bodyY + bodyR * Math.sin(theta)];
    if (previous) canvas.line(previous[0], previous[1], point[0], point[1], stroke, ink);
    previous = point;
  }
  return canvas;
}

const categories = {
  air: (canvas) => {
    const body = hex("#4263FF");
    const accent = hex("#79D7FF");
    canvas.fillRoundRect(48, 78, 264, 78, 16, body);
    canvas.fillRoundRect(68, 96, 150, 18, 8, hex("#ffffff"));
    canvas.fillRoundRect(236, 96, 48, 18, 8, accent);
    canvas.line(90, 176, 130, 196, 8, body);
    canvas.line(150, 176, 190, 196, 8, body);
    canvas.line(210, 176, 250, 196, 8, body);
  },
  washer: (canvas) => {
    const body = hex("#316FD1");
    canvas.fillRoundRect(118, 36, 124, 180, 24, body);
    canvas.fillRoundRect(138, 54, 84, 22, 8, hex("#ffffff"), 220);
    canvas.fillCircle(180, 142, 46, hex("#ffffff"));
    canvas.fillCircle(180, 142, 30, hex("#20BFA4"), 180);
  },
  fridge: (canvas) => {
    const body = hex("#2F8CA3");
    canvas.fillRoundRect(124, 28, 112, 196, 18, body);
    canvas.line(124, 118, 236, 118, 8, hex("#ffffff"));
    canvas.fillRoundRect(140, 52, 16, 36, 8, hex("#ffffff"));
    canvas.fillRoundRect(140, 142, 16, 48, 8, hex("#ffffff"));
    canvas.fillCircle(214, 58, 18, hex("#F6AD5B"));
  },
  heater: (canvas) => {
    const body = hex("#CE4D3D");
    canvas.fillRoundRect(78, 58, 204, 96, 36, body);
    canvas.fillRoundRect(132, 154, 96, 18, 8, hex("#F6AD5B"));
    canvas.line(150, 188, 210, 188, 10, body);
    canvas.line(132, 92, 132, 124, 8, hex("#ffffff"));
    canvas.line(180, 86, 180, 128, 8, hex("#ffffff"));
  },
  kitchen: (canvas) => {
    const body = hex("#7D5A3A");
    canvas.fillRoundRect(70, 48, 220, 28, 10, hex("#F6AD5B"));
    canvas.fillRoundRect(96, 84, 168, 52, 8, body);
    canvas.fillRoundRect(118, 146, 124, 58, 12, hex("#D9861F"));
    canvas.fillCircle(156, 174, 14, hex("#ffffff"));
    canvas.fillCircle(204, 174, 14, hex("#ffffff"));
  },
  water: (canvas) => {
    const body = hex("#28666E");
    canvas.fillRoundRect(70, 58, 70, 36, 10, hex("#51A3A3"));
    canvas.line(104, 76, 230, 76, 16, body);
    canvas.line(230, 76, 230, 132, 16, body);
    canvas.fillCircle(196, 168, 36, hex("#79D7FF"));
    canvas.line(96, 188, 150, 188, 12, body);
  },
  cleaning: (canvas) => {
    const body = hex("#2F8F68");
    canvas.fillRoundRect(78, 78, 160, 96, 18, body);
    canvas.line(238, 96, 280, 96, 12, hex("#316FD1"));
    canvas.line(280, 96, 280, 146, 12, hex("#316FD1"));
    canvas.line(238, 146, 280, 146, 12, hex("#316FD1"));
    canvas.fillCircle(118, 118, 10, hex("#ffffff"));
    canvas.fillCircle(158, 118, 10, hex("#ffffff"));
    canvas.fillCircle(198, 118, 10, hex("#ffffff"));
  },
  default: (canvas) => {
    canvas.fillRoundRect(118, 46, 124, 150, 28, hex("#4263FF"));
    canvas.fillCircle(180, 168, 28, hex("#20BFA4"));
  },
};

const brands = [
  ["gree", "GREE", "#0B7F72"],
  ["midea", "MIDEA", "#1877C9"],
  ["haier", "HAIER", "#139ED9"],
  ["aux", "AUX", "#D12D33"],
  ["siemens", "SIEMENS", "#08706F"],
  ["other", "OTHER", "#5F6F6C"],
];

writePng(path.join(root, "images/tab-quote.png"), documentIcon("#8A93AA", false));
writePng(path.join(root, "images/tab-quote-active.png"), documentIcon("#5264ED", true));
writePng(path.join(root, "images/tab-history.png"), clockIcon("#8A93AA", false));
writePng(path.join(root, "images/tab-history-active.png"), clockIcon("#5264ED", true));
writePng(path.join(root, "images/tab-mine.png"), personIcon("#8A93AA", false));
writePng(path.join(root, "images/tab-mine-active.png"), personIcon("#5264ED", true));

for (const [name, draw] of Object.entries(categories)) {
  writePng(path.join(root, "images/categories", `${name}.png`), card(draw));
}

const windowsReserved = new Set(["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"]);

function brandPngName(id) {
  const base = String(id).toLowerCase();
  return (windowsReserved.has(base) ? `${base}-brand` : base) + ".png";
}

for (const [id, label, color] of brands) {
  const canvas = new Canvas(320, 144);
  const ink = hex(color);
  canvas.fillRoundRect(4, 4, 312, 136, 24, hex("#ffffff"));
  canvas.strokeRoundRect(4, 4, 312, 136, 24, 6, ink);
  canvas.fillCircle(58, 72, 28, ink, 36);
  canvas.line(40, 78, 58, 58, 6, ink);
  canvas.line(58, 58, 76, 78, 6, ink);
  const scale = label.length > 6 ? 3 : 4;
  canvas.text(label, 96, 58, scale, ink);
  writePng(path.join(root, "images/brands", brandPngName(id)), canvas);
}

console.log("wrote miniprogram png assets");
