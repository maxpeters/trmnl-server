# TRMNL BYOS Server

Self-hosted server for [TRMNL](https://trmnl.com) e-ink displays, designed to run on a MacBook.

## Quick Start

```bash
npm install
npm run build
node dist/server.js
```

Server starts at `http://localhost:3000`.

## autostart (macOS)

Der Server läuft als LaunchAgent und startet automatisch beim Mac-Login.
Bei jedem Start wird automatisch `git pull` + `npm run build` gemacht — d.h. einfach pushen und neu starten.

**Server neu starten (z.B. nach einem Push):**

```bash
launchctl stop com.maxpeters.trmnl-server
launchctl start com.maxpeters.trmnl-server
```

**Logs:**

```bash
tail -f ~/Projects/trmnl-server/trmnl-server.log
```

**Server-URL im lokalen Netzwerk:** `http://MacBookPro.fritz.box:3000`

## How it works

The TRMNL device (ESP32 + e-ink) polls this server periodically:

1. **`GET /api/setup`** — Device registers with its MAC address, gets an API key
2. **`GET /api/display`** — Device requests the next screen, gets a BMP image URL
3. **`POST /api/log`** — Device sends error logs

The server renders HTML screens to 800x480 1-bit BMP images suitable for the e-ink display.

## Hardware

### Unsere Komponenten

| Komponente | Modell | Details |
|------------|--------|---------|
| Microcontroller | **ESP32-WROOM-32E** (DevKit) | 240MHz, WiFi, 4MB Flash |
| Display | **Waveshare 7.5" E-Paper HAT (B)** | 800x480, 3-Farben (rot/schwarz/weiss), SPI |
| Batterie | **10.000mAh LiPo** | 3.7V |
| Server | **MacBook** (macOS) | Node.js, lokales Netzwerk |

### E-Ink Display Wiring (SPI)

Die Pin-Belegung fuer den ESP32-WROOM-32E mit dem Waveshare E-Paper Driver Board:

| E-Paper Pin | ESP32 GPIO |
|-------------|------------|
| DIN / MOSI  | GPIO 14    |
| CLK / SCK   | GPIO 13    |
| CS          | GPIO 15    |
| DC          | GPIO 27    |
| RST         | GPIO 26    |
| BUSY        | GPIO 25    |

Diese Pins entsprechen dem `waveshare-esp32-driver` Environment in der TRMNL Firmware (`src/DEV_Config.h`).

### 3-Farben Display Hinweis

Das Waveshare 7.5" (B) ist ein 3-Farben Display (rot/schwarz/weiss). In der TRMNL Firmware wird der passende Treiber `EP75R_800x480` ueber das Build-Flag `BOARD_XIAO_EPAPER_DISPLAY_3CLR` aktiviert. Dieses Flag ist aktuell nur im `TRMNL_7inch5_OG_DIY_Kit_3CLR` Environment (ESP32-S3) konfiguriert.

Fuer unseren ESP32-WROOM-32E muss ein **custom PlatformIO Environment** in `platformio.ini` erstellt werden:

```ini
[env:custom_esp32_3clr]
extends = env:esp32_base
board = esp32dev
board_build.f_cpu = 240000000L
board_build.f_flash = 80000000L
board_build.flash_mode = dio
build_flags =
    ${env:esp32_base.build_flags}
    -D BOARD_WAVESHARE_ESP32_DRIVER
    -D PNG_MAX_BUFFERED_PIXELS=6432
```

> TODO: Den Display-Treiber in `src/display.cpp` fuer diese Kombination auf `EP75R_800x480` umstellen, damit der 3-Farben Modus genutzt wird. Ohne Anpassung wird nur schwarz/weiss gerendert.

## Firmware flashen

### 1. PlatformIO installieren

```bash
# via Homebrew
brew install platformio

# oder via pip
pip install platformio
```

### 2. Firmware klonen

```bash
git clone https://github.com/usetrmnl/firmware.git trmnl-firmware
cd trmnl-firmware
```

### 3. Custom Environment anlegen

Das oben beschriebene `[env:custom_esp32_3clr]` Environment in `platformio.ini` einfuegen.

### 4. Bauen und flashen

ESP32 per USB anschliessen, dann:

```bash
pio run -e custom_esp32_3clr --target upload
```

### 5. Device konfigurieren

Nach dem Flashen startet der ESP32 im WiFi AP-Modus:

1. Mit dem WLAN `TRMNL-XXXX` verbinden (Handy oder Laptop)
2. Captive Portal oeffnet sich automatisch
3. Eigenes WLAN eingeben (SSID + Passwort)
4. **Server URL** auf die IP des MacBooks setzen, z.B. `http://192.168.1.100:3000`
5. Der ESP32 startet neu und registriert sich automatisch beim Server via `/api/setup`

## Admin UI

Open `http://localhost:3000` in your browser to:
- Create/edit/delete screens (HTML content)
- Preview screens as 800x480 BMP
- View registered devices and their telemetry
- Browse device logs

## Tech Stack

- **Express** — HTTP server
- **SQLite** (better-sqlite3) — Device & screen storage
- **Sharp** — HTML-to-BMP rendering for e-ink
- **TypeScript** — Type safety

## API Reference

### Device Endpoints

| Method | Path | Headers | Description |
|--------|------|---------|-------------|
| GET | `/api/setup` | `ID: <MAC>` | Register device |
| GET | `/api/display` | `ID: <MAC>`, `Access-Token`, `Battery-Voltage`, `FW-Version`, `RSSI` | Get next screen |
| POST | `/api/log` | `ID: <MAC>`, `Access-Token` | Submit error log |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List all devices |
| GET | `/api/screens` | List all screens |
| POST | `/api/screens` | Create screen `{name, html}` |
| PUT | `/api/screens/:id` | Update screen |
| DELETE | `/api/screens/:id` | Delete screen |
| GET | `/api/screens/:id/preview` | Preview as BMP |
| GET | `/api/logs` | Recent device logs |
