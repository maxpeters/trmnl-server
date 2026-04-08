# TRMNL BYOS Server

Self-hosted server for [TRMNL](https://trmnl.com) e-ink displays, designed to run on a MacBook.

## Quick Start

```bash
npm install
npm run dev
```

Server starts at `http://localhost:3000`.

## How it works

The TRMNL device (ESP32 + e-ink) polls this server periodically:

1. **`GET /api/setup`** — Device registers with its MAC address, gets an API key
2. **`GET /api/display`** — Device requests the next screen, gets a BMP image URL
3. **`POST /api/log`** — Device sends error logs

The server renders HTML screens to 800x480 1-bit BMP images suitable for the e-ink display.

## Hardware Setup

### Supported Board

**ESP32-WROOM-32E** (DevKit) — the TRMNL firmware supports this via the `esp32dev` build target.

### E-Ink Display Wiring (SPI)

| E-Paper Pin | ESP32 Pin |
|-------------|-----------|
| DIN / MOSI  | MO        |
| CLK / SCK   | SCK       |
| CS          | GPIO 5    |
| DC          | GPIO 17   |
| RST         | RST       |
| BUSY        | GPIO 4    |

> Pin-Belegung kann je nach E-Paper-Modell abweichen. Die genauen GPIOs sind in der Firmware-Config unter dem `esp32dev` Environment definiert.

### Firmware flashen

#### 1. PlatformIO installieren

```bash
# via Homebrew
brew install platformio

# oder via pip
pip install platformio
```

#### 2. Firmware klonen

```bash
git clone https://github.com/usetrmnl/firmware.git trmnl-firmware
cd trmnl-firmware
```

#### 3. Bauen und flashen

ESP32 per USB anschliessen, dann:

```bash
pio run -e esp32dev --target upload
```

Das Target `esp32dev` ist fuer den generischen ESP32 (240MHz, DIO Flash-Mode) — passt zum WROOM-32E.

#### 4. Device konfigurieren

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
