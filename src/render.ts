import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TRMNL display: 800x480, 1-bit black/white
const WIDTH = 800;
const HEIGHT = 480;

// Load fonts once at startup
const interRegular = fs.readFileSync(
  path.join(__dirname, "..", "fonts", "Inter-Regular.ttf")
);
const interBold = fs.readFileSync(
  path.join(__dirname, "..", "fonts", "Inter-Bold.ttf")
);

/**
 * Converts a simple HTML-like structure to Satori-compatible React elements.
 */
function parseHtmlToSatori(html: string): any {
  html = html.trim();

  const elements: any[] = [];
  let pos = 0;

  while (pos < html.length) {
    if (html[pos] === "<") {
      const closeAngle = html.indexOf(">", pos);
      if (closeAngle === -1) break;

      const tagContent = html.slice(pos + 1, closeAngle);

      // Self-closing tag
      if (tagContent.endsWith("/") || tagContent.startsWith("br") || tagContent.startsWith("hr")) {
        const tagName = tagContent.replace(/[\s/].*/s, "");
        if (tagName === "br") {
          elements.push({ type: "div", props: { style: { height: "8px" }, children: [] } });
        } else if (tagName === "hr") {
          elements.push({
            type: "div",
            props: {
              style: { borderBottom: "2px solid black", width: "100%", margin: "16px 0" },
              children: [],
            },
          });
        }
        pos = closeAngle + 1;
        continue;
      }

      // Closing tag — skip
      if (tagContent.startsWith("/")) {
        pos = closeAngle + 1;
        continue;
      }

      // Opening tag
      const tagName = tagContent.replace(/[\s>].*/s, "").toLowerCase();
      const styleMatch = tagContent.match(/style="([^"]*)"/);
      const style = styleMatch ? parseCssToObject(styleMatch[1]) : {};

      const closeTag = `</${tagName}>`;
      const closePos = findMatchingClose(html, pos, tagName);
      if (closePos === -1) {
        pos = closeAngle + 1;
        continue;
      }

      const innerHtml = html.slice(closeAngle + 1, closePos);
      const children = parseHtmlToSatori(innerHtml);

      const tagStyles: Record<string, any> = {
        h1: { fontSize: "48px", fontWeight: 700, margin: "0" },
        h2: { fontSize: "36px", fontWeight: 700, margin: "0" },
        h3: { fontSize: "28px", fontWeight: 700, margin: "0" },
        p: { fontSize: "20px", margin: "8px 0" },
        strong: { fontWeight: 700 },
        em: { fontStyle: "italic" },
      };

      const baseStyle = tagStyles[tagName] || {};
      const mergedStyle = { ...baseStyle, ...style };

      elements.push({
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", ...mergedStyle },
          children: Array.isArray(children) ? children : [children],
        },
      });

      pos = closePos + closeTag.length;
    } else {
      const nextTag = html.indexOf("<", pos);
      const text = html.slice(pos, nextTag === -1 ? html.length : nextTag).trim();
      if (text) {
        elements.push(text);
      }
      pos = nextTag === -1 ? html.length : nextTag;
    }
  }

  return elements.length === 1 ? elements[0] : elements;
}

function findMatchingClose(html: string, startPos: number, tagName: string): number {
  let depth = 0;
  let pos = startPos;
  const closePattern = `</${tagName}>`;

  while (pos < html.length) {
    const nextOpen = html.indexOf(`<${tagName}`, pos + 1);
    const nextClose = html.indexOf(closePattern, pos + 1);

    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const charAfter = html[nextOpen + tagName.length + 1];
      if (charAfter === " " || charAfter === ">" || charAfter === "/") {
        depth++;
      }
      pos = nextOpen;
    } else {
      if (depth === 0) return nextClose;
      depth--;
      pos = nextClose;
    }
  }
  return -1;
}

function parseCssToObject(css: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const rule of css.split(";")) {
    const colonIdx = rule.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = rule.slice(0, colonIdx).trim();
    const val = rule.slice(colonIdx + 1).trim();
    if (prop && val) {
      const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camelProp] = val;
    }
  }
  return style;
}

/**
 * Renders HTML content to a 1-bit PNG suitable for the TRMNL e-ink display.
 * Pipeline: HTML -> Satori (SVG) -> Resvg (PNG) -> Sharp (threshold to 1-bit PNG)
 */
export async function renderHtmlToBmp(html: string): Promise<Buffer> {
  const children = parseHtmlToSatori(html);

  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        width: "100%",
        height: "100%",
        background: "white",
        color: "black",
        fontFamily: "Inter",
      },
      children: Array.isArray(children) ? children : [children],
    },
  };

  // Satori: element tree -> SVG
  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
  });

  // Resvg: SVG -> PNG
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  });
  const pngBuffer = resvg.render().asPng();

  // Sharp: threshold to 1-bit raw pixels
  const raw = await sharp(pngBuffer)
    .threshold(128)
    .toColorspace("b-w")
    .raw()
    .toBuffer();

  // Build 1-bit BMP (bottom-up, padded to 4-byte rows)
  const rowBytes = Math.ceil(WIDTH / 8);
  const paddedRowBytes = Math.ceil(rowBytes / 4) * 4;
  const imageSize = paddedRowBytes * HEIGHT;
  const headerSize = 14 + 40 + 8; // BMP header + DIB header + 2-color palette
  const fileSize = headerSize + imageSize;

  const bmp = Buffer.alloc(fileSize);
  // BMP file header
  bmp.write("BM", 0);
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(headerSize, 10);
  // DIB header (BITMAPINFOHEADER)
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(WIDTH, 18);
  bmp.writeInt32LE(HEIGHT, 22);
  bmp.writeUInt16LE(1, 26); // planes
  bmp.writeUInt16LE(1, 28); // bits per pixel
  bmp.writeUInt32LE(0, 30); // no compression
  bmp.writeUInt32LE(imageSize, 34);
  // Color palette: 0=black, 1=white
  bmp.writeUInt32LE(0x00000000, 54); // black
  bmp.writeUInt32LE(0x00FFFFFF, 58); // white

  // Convert raw 8-bit grayscale to 1-bit, bottom-up
  for (let y = 0; y < HEIGHT; y++) {
    const srcRow = y * WIDTH;
    const dstRow = headerSize + (HEIGHT - 1 - y) * paddedRowBytes;
    for (let x = 0; x < WIDTH; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8 && (x + bit) < WIDTH; bit++) {
        if (raw[srcRow + x + bit] > 128) {
          byte |= (0x80 >> bit); // white = 1
        }
      }
      bmp[dstRow + (x >> 3)] = byte;
    }
  }

  return bmp;
}

/**
 * Generates a simple text-based screen.
 */
export async function renderTextToBmp(
  title: string,
  subtitle?: string
): Promise<Buffer> {
  const html = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;font-family:sans-serif;">
      <div style="text-align:center;">
        <h1 style="font-size:48px;margin:0;">${escapeHtml(title)}</h1>
        ${subtitle ? `<p style="font-size:24px;color:#666;margin-top:16px;">${escapeHtml(subtitle)}</p>` : ""}
      </div>
    </div>`;
  return renderHtmlToBmp(html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
