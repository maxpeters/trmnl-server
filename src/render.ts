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

  // Sharp: threshold to 1-bit black/white PNG (bilevel)
  const output = await sharp(pngBuffer)
    .threshold(128)
    .toColorspace("b-w")
    .png({ colours: 2, effort: 1 })
    .toBuffer();

  return output;
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
