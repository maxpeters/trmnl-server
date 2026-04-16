#!/usr/bin/env python3
"""
Local TRMNL plugin preview via the running LaraPaper Docker container.

Usage:
    python3 preview.py <plugin-name> [full|half_horizontal] [--container NAME] [--no-open]
    python3 preview.py --list

Examples:
    python3 preview.py wetter-koeln
    python3 preview.py gym-occupancy half_horizontal
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("plugin", nargs="?", help="Plugin directory name inside plugins/")
    parser.add_argument("size", nargs="?", default="full", help="full or half_horizontal")
    parser.add_argument("--container", dest="container", help="Docker container name")
    parser.add_argument("--no-open", action="store_true", help="Do not open preview in browser")
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

    print(f"Preview: {out_path}")
    if not args.no_open:
        webbrowser.open(out_path.as_uri())


if __name__ == "__main__":
    main()
