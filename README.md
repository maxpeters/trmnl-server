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

## Device Setup

Point your TRMNL device to this server's IP. If your MacBook is at `192.168.1.100`:

1. Flash TRMNL firmware on your ESP32: https://github.com/usetrmnl/firmware
2. During WiFi setup, set the server URL to `http://192.168.1.100:3000`
3. The device will auto-register via `/api/setup`

## Admin UI

Open `http://localhost:3000` in your browser to:
- Create/edit/delete screens (HTML content)
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
