#!/usr/bin/env python3
"""
Local TRMNL plugin preview via the running LaraPaper Docker container.

Usage:
    python3 preview.py <plugin-name> [full|half_horizontal] [--container NAME] [--no-open]
    python3 preview.py <plugin-name> [full|half_horizontal] --png [--container NAME] [--no-open]
    python3 preview.py --list

Examples:
    python3 preview.py wetter-koeln
    python3 preview.py gym-occupancy half_horizontal
    python3 preview.py sleep-analysis full --png
    python3 preview.py --container prod-app-1 sleep-analysis full
"""

import argparse
import base64
import subprocess
import sys
import webbrowser
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SIZES = {"full", "half_horizontal"}
NAME_MAP = {
    "wetter-koeln": "Wetter Koeln",
    "gym-occupancy": "AI Fitness Auslastung",
    "miflora-plants": "MiFlora Pflanzen",
    "sleep-analysis": "Sleep Analysis",
    "fitness-health": "Fitness & Health",
}
TRMNL_CSS_URL = "https://trmnl.com/css/2.3.7/plugins.css"
TRMNL_JS_URL = "https://trmnl.com/js/2.3.7/plugins.js"
LOCAL_CSS_NAME = ".preview_trmnl_plugins.css"
LOCAL_JS_NAME = ".preview_trmnl_plugins.js"
SCREENSHOT_SCRIPT = ".preview_screenshot.mjs"


def fail(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(1)


def run(command: list[str], *, capture_output: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(command, capture_output=capture_output, text=True)


def list_plugins() -> list[str]:
    return sorted(
        p.name for p in SCRIPT_DIR.iterdir()
        if p.is_dir() and not p.name.startswith('.')
    )


def detect_container() -> str:
    result = run(["docker", "ps", "--format", "{{.Names}}"])
    if result.returncode != 0:
        fail(result.stderr.strip() or "docker ps failed")

    names = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    preferred = [
        name for name in names
        if name in {"prod-app-1", "trmnl-server-app-1", "docker-app-1"}
    ]
    if preferred:
        return preferred[0]

    larapaperish = [name for name in names if "app" in name and ("trmnl" in name or "prod" in name or "lara" in name)]
    if len(larapaperish) == 1:
        return larapaperish[0]
    if len(larapaperish) > 1:
        fail(f"multiple possible containers found: {', '.join(larapaperish)}. Pass --container.")

    fail("no running LaraPaper app container found. Start docker compose first.")


def docker_exec(container: str, cmd: str) -> str:
    result = run(["docker", "exec", container, "sh", "-lc", cmd])
    if result.returncode != 0:
        fail(result.stderr.strip() or result.stdout.strip() or "docker exec failed")
    return result.stdout


def ensure_local_assets() -> tuple[Path, Path]:
    css_path = SCRIPT_DIR / LOCAL_CSS_NAME
    js_path = SCRIPT_DIR / LOCAL_JS_NAME

    if not css_path.exists():
        result = run(["curl", "-fsSL", TRMNL_CSS_URL, "-o", str(css_path)])
        if result.returncode != 0:
            fail("failed to download TRMNL CSS asset")

    if not js_path.exists():
        result = run(["curl", "-fsSL", TRMNL_JS_URL, "-o", str(js_path)])
        if result.returncode != 0:
            fail("failed to download TRMNL JS asset")

    return css_path, js_path


def localize_assets(html: str) -> str:
    replacements = [
        (f'href="{TRMNL_CSS_URL}"', f'href="{LOCAL_CSS_NAME}"'),
        (f"href='{TRMNL_CSS_URL}'", f"href='{LOCAL_CSS_NAME}'"),
        (f'src="{TRMNL_JS_URL}"', f'src="{LOCAL_JS_NAME}"'),
        (f"src='{TRMNL_JS_URL}'", f"src='{LOCAL_JS_NAME}'"),
    ]
    for old, new in replacements:
        html = html.replace(old, new)
    return html


def ensure_screenshot_script() -> Path:
    script_path = SCRIPT_DIR / SCREENSHOT_SCRIPT
    script_path.write_text(
        """
import puppeteer from 'puppeteer';

const [url, outPath, width, height] = process.argv.slice(2);

if (!url || !outPath || !width || !height) {
  console.error('Missing args');
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(width), height: Number(height), deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, fullPage: false, type: 'png' });
} finally {
  await browser.close();
}
""".strip()
        + "\n"
    )
    return script_path


def render_png(local_html_path: Path, png_path: Path, size: str) -> None:
    ensure_local_assets()
    script_path = ensure_screenshot_script()
    dims = (800, 480) if size == "full" else (400, 240)

    result = run([
        "node",
        str(script_path),
        local_html_path.resolve().as_uri(),
        str(png_path),
        str(dims[0]),
        str(dims[1]),
    ])
    if result.returncode != 0:
        fail(result.stderr.strip() or result.stdout.strip() or "failed to render PNG screenshot")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("plugin", nargs="?", help="Plugin directory name inside plugins/")
    parser.add_argument("size", nargs="?", default="full", help="full or half_horizontal")
    parser.add_argument("--container", dest="container", help="Docker container name")
    parser.add_argument("--no-open", action="store_true", help="Do not open preview in browser")
    parser.add_argument("--png", action="store_true", help="Also export a PNG screenshot")
    parser.add_argument("--list", action="store_true", help="List available plugins")
    return parser


def main() -> None:
    args = build_parser().parse_args()

    if args.list:
        print("Available plugins:")
        for name in list_plugins():
            print(f"- {name}")
        return

    if not args.plugin:
        fail("missing plugin name. Use --list to see options.")

    plugin_name = args.plugin
    size = args.size
    if size not in DEFAULT_SIZES:
        fail(f"invalid size '{size}'. Use one of: {', '.join(sorted(DEFAULT_SIZES))}")

    plugin_dir = SCRIPT_DIR / plugin_name
    if not plugin_dir.is_dir():
        fail(f"plugin directory '{plugin_dir}' not found")

    template_file = plugin_dir / f"{size}.liquid"
    if not template_file.exists():
        fail(f"template '{template_file}' not found")

    container = args.container or detect_container()
    db_name = NAME_MAP.get(plugin_name, plugin_name)

    files_to_upload = {}
    for filename, column in [("full.liquid", "render_markup"), ("half_horizontal.liquid", "render_markup_half_horizontal")]:
        fp = plugin_dir / filename
        if fp.exists():
            files_to_upload[column] = base64.b64encode(fp.read_bytes()).decode()

    if not files_to_upload:
        fail("no liquid templates found to upload")

    update_array = ", ".join(
        f"'{column}' => base64_decode('{payload}')"
        for column, payload in files_to_upload.items()
    )

    print(f"Using container: {container}")
    print(f"Uploading '{plugin_name}' to LaraPaper...")
    out = docker_exec(
        container,
        (
            "php /var/www/html/artisan tinker --execute=\""
            f"\\$p = \\App\\Models\\Plugin::where('name', '{db_name}')->first();"
            "if (!\\$p) { echo 'NOT FOUND'; exit(1); }"
            f"\\DB::table('plugins')->where('id', \\$p->id)->update([{update_array}]);"
            "echo 'OK';"
            "\""
        ),
    ).strip()
    if out != "OK":
        fail(f"unexpected upload result: {out}")

    print(f"Rendering {size} preview...")
    html = docker_exec(
        container,
        (
            "php /var/www/html/artisan tinker --execute=\""
            f"\\$p = \\App\\Models\\Plugin::where('name', '{db_name}')->first();"
            "if (!\\$p) { echo 'NOT FOUND'; exit(1); }"
            f"echo \\$p->render('{size}', true);"
            "\""
        ),
    )

    if "half" in size:
        html = html.replace('mashup mashup--1Tx1B', '')
        html = html.replace('mashup mashup--1Bx1T', '')

    out_path = SCRIPT_DIR / f".preview_{plugin_name}_{size}.html"
    out_path.write_text(html)
    print(f"Preview HTML: {out_path}")

    local_html_path = SCRIPT_DIR / f".preview_{plugin_name}_{size}_local.html"
    local_html_path.write_text(localize_assets(html))

    if args.png:
        png_path = SCRIPT_DIR / f".preview_{plugin_name}_{size}.png"
        render_png(local_html_path, png_path, size)
        print(f"Preview PNG: {png_path}")

    if not args.no_open:
        webbrowser.open(out_path.as_uri())


if __name__ == "__main__":
    main()
