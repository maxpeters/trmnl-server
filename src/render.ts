import sharp from "sharp";

// TRMNL display: 800x480, 1-bit black/white BMP
const WIDTH = 800;
const HEIGHT = 480;

/**
 * Renders HTML content to a 1-bit BMP suitable for the TRMNL e-ink display.
 * Uses sharp to create a simple SVG-based render and convert to BMP.
 */
export async function renderHtmlToBmp(html: string): Promise<Buffer> {
  // Wrap HTML in an SVG foreignObject for rendering via sharp
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <foreignObject width="${WIDTH}" height="${HEIGHT}">
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="width:${WIDTH}px;height:${HEIGHT}px;background:white;color:black;overflow:hidden;">
          ${html}
        </div>
      </foreignObject>
    </svg>`;

  const bmp = await sharp(Buffer.from(svg))
    .resize(WIDTH, HEIGHT)
    .threshold(128) // convert to 1-bit black/white
    .toFormat("bmp" as keyof sharp.FormatEnum) // BMP output
    .toBuffer();

  return bmp;
}

/**
 * Generates a simple text-based screen as BMP.
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
