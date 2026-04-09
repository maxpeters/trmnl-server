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
| Microcontroller | **DFRobot Firebeetle ESP32 V1.0** (ESP32-WROOM-32E) | 240MHz, WiFi, 4MB Flash |
| Display | **Waveshare 7.5" E-Paper HAT (B)** Rev2.2, Panel: **075RW-Z08 v3** | 800x480, 3-Farben (rot/schwarz/weiss), SPI, Chip: UC81xx |
| Batterie | **10.000mAh LiPo** | 3.7V |
| Server | **MacBook** (macOS) | Node.js, lokales Netzwerk |

### E-Ink Display Wiring (SPI)

Verkabelung vom Waveshare e-Paper Driver HAT Rev2.2 zum DFRobot Firebeetle ESP32:

| HAT Pin | Kabelfarbe | ESP32 Board-Label | ESP32 GPIO |
|---------|------------|-------------------|------------|
| VCC     | grau       | 3V                | 3.3V       |
| GND     | braun      | GND               | GND        |
| DIN     | blau       | MO (MOSI)         | GPIO 23    |
| CLK     | gelb       | SCK               | GPIO 18    |
| CS      | orange     | D9                | GPIO 2     |
| DC      | gruen      | SCL               | GPIO 22    |
| RST     | weiss      | SDA               | GPIO 21    |
| BUSY    | lila       | D7                | GPIO 13    |

> Diese Pins sind in der TRMNL Firmware unter `src/DEV_Config.h` im `BOARD_WAVESHARE_ESP32_DRIVER` Block konfiguriert. Bei anderem Board muessen die GPIOs dort angepasst werden.

### 3-Farben Display

Das Waveshare 7.5" (B) ist ein 3-Farben Display (rot/schwarz/weiss). Der passende Treiber `EP75R_800x480` wird ueber das Build-Flag `BOARD_XIAO_EPAPER_DISPLAY_3CLR` aktiviert. Ohne diese Anpassung wird nur schwarz/weiss gerendert.

> TODO: Display-Treiber in `src/display.cpp` fuer die Kombination ESP32 + 3-Farben Display auf `EP75R_800x480` umstellen.

## Firmware flashen

### 1. PlatformIO installieren

```bash
brew install platformio
```

> Falls `intelhex` Fehler beim Build auftreten:
> ```bash
> # PlatformIO Python finden und intelhex dort installieren
> pio system info  # zeigt Python Executable
> /pfad/zum/platformio/python -m pip install intelhex
> ```

### 2. Firmware klonen

```bash
git clone https://github.com/usetrmnl/firmware.git trmnl-firmware
cd trmnl-firmware
```

### 3. Pin-Mapping anpassen (falls noetig)

Die GPIO-Zuordnung in `src/DEV_Config.h` unter `BOARD_WAVESHARE_ESP32_DRIVER` muss zum eigenen Wiring passen. Siehe Tabelle oben.

### 4. Bauen und flashen

ESP32 per USB anschliessen, dann:

```bash
pio run -e waveshare-esp32-driver --target upload
```

### 5. Flash komplett loeschen (bei Problemen)

Falls der ESP32 alte WiFi-Credentials behaelt oder sich mit der TRMNL Cloud statt dem lokalen Server verbindet:

```bash
esptool.py --port /dev/cu.wchusbserial110 erase_flash
pio run -e waveshare-esp32-driver --target upload
```

### 6. Device konfigurieren

Nach dem Flashen startet der ESP32 im WiFi AP-Modus:

1. Mit dem WLAN des ESP32 verbinden (Handy oder Laptop)
2. Captive Portal oeffnet sich automatisch
3. Eigenes WLAN eingeben (SSID + Passwort)
4. **Server URL** eingeben: `http://macbookpro.fritz.box:3000`
5. Der ESP32 startet neu und registriert sich automatisch beim Server via `/api/setup`

### Serial Monitor

Zum Debuggen die serielle Ausgabe des ESP32 mitlesen:

```bash
cd ~/trmnl-firmware
pio device monitor -e waveshare-esp32-driver
```

Zeigt WiFi-Verbindung, API-Calls, Display-Updates und Fehlermeldungen in Echtzeit.

**Tipps:**
- ESP32 muss per USB verbunden sein
- Baudrate wird automatisch aus `platformio.ini` uebernommen (115200)
- Beenden mit `Ctrl+C`
- Falls kein Output kommt: USB-Kabel pruefen (manche Kabel sind nur Ladekabel ohne Daten)

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
