#!/usr/bin/env python3
"""
Local TRMNL plugin preview - renders via the LaraPaper server and opens in browser.

Usage:
    python3 preview.py <plugin-name> [full|half_horizontal]

Example:
    python3 preview.py wetter-koeln
    python3 preview.py gym-occupancy half_horizontal
"""

import sys
import os
import subprocess
import webbrowser
import base64

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTAINER = "prod-app-1"


def docker_exec(cmd):
    result = subprocess.run(
        ["docker", "exec", CONTAINER, "sh", "-c", cmd],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)
    return result.stdout


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    plugin_name = sys.argv[1]
    size = sys.argv[2] if len(sys.argv) > 2 else "full"

    plugin_dir = os.path.join(SCRIPT_DIR, plugin_name)
    if not os.path.isdir(plugin_dir):
        print(f"Error: Plugin directory '{plugin_dir}' not found")
        sys.exit(1)

    template_file = os.path.join(plugin_dir, f"{size}.liquid")
    if not os.path.exists(template_file):
        print(f"Error: Template '{template_file}' not found")
        sys.exit(1)

    # Find plugin name mapping
    name_map = {
        "wetter-koeln": "Wetter Koeln",
        "gym-occupancy": "AI Fitness Auslastung",
        "miflora-plants": "MiFlora Pflanzen",
        "sleep-analysis": "Sleep Analysis",
        "fitness-health": "Fitness & Health",
    }
    db_name = name_map.get(plugin_name, plugin_name)

    # Copy liquid files directly into container
    files_to_upload = {}
    for f, col in [("full.liquid", "render_markup"), ("half_horizontal.liquid", "render_markup_half_horizontal")]:
        fp = os.path.join(plugin_dir, f)
        if os.path.exists(fp):
            with open(fp, "r") as fh:
                files_to_upload[col] = base64.b64encode(fh.read().encode()).decode()

    # Build PHP update using base64 decode (avoids all escaping issues)
    update_parts = []
    for col, b64 in files_to_upload.items():
        update_parts.append(f"'{col}' => base64_decode('{b64}')")

    update_array = ", ".join(update_parts)

    print(f"Uploading '{plugin_name}' to server...")
    out = docker_exec(
        f'php /var/www/html/artisan tinker --execute="'
        f'\\$p = \\App\\Models\\Plugin::where(\'name\', \'{db_name}\')->first();'
        f'if (!\\$p) {{ echo \'NOT FOUND\'; exit; }}'
        f'\\DB::table(\'plugins\')->where(\'id\', \\$p->id)->update([{update_array}]);'
        f'echo \'OK\';'
        f'"'
    )
    print(f"  {out.strip()}")

    # Render the plugin via server
    print(f"Rendering {size} preview...")
    html = docker_exec(
        f'php /var/www/html/artisan tinker --execute="'
        f'\\$p = \\App\\Models\\Plugin::where(\'name\', \'{db_name}\')->first();'
        f'echo \\$p->render(\'{size}\', true);'
        f'"'
    )

    # For half sizes, remove the mashup wrapper (templates have their own view wrapper)
    if "half" in size:
        html = html.replace('mashup mashup--1Tx1B', '')
        html = html.replace('mashup mashup--1Bx1T', '')

    # Save and open
    out_path = os.path.join(SCRIPT_DIR, f".preview_{plugin_name}_{size}.html")
    with open(out_path, "w") as f:
        f.write(html)

    print(f"Preview: {out_path}")
    webbrowser.open(f"file://{out_path}")


if __name__ == "__main__":
    main()
