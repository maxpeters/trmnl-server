# TRMNL Display Setup

Setup-Anleitung fuer unser TRMNL e-ink Display mit eigener Hardware.

## Hardware

| Komponente | Modell | Details |
|------------|--------|---------|
| Microcontroller | **DFRobot Firebeetle ESP32 V1.0** (ESP32-WROOM-32E) | 240MHz, WiFi, 4MB Flash |
| Display | **Waveshare 7.5" E-Paper HAT (B)** Rev2.2, Panel: **075RW-Z08 v3** | 800x480, 3-Farben (rot/schwarz/weiss), SPI, Chip: UC8179 |
| Batterie | **10.000mAh LiPo** | 3.7V |
| Server | **LaraPaper** (Docker) | Laeuft auf MacBook oder Raspberry Pi |

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

## Server: LaraPaper (Docker)

Wir nutzen [LaraPaper](https://github.com/usetrmnl/larapaper) als BYOS Server — den offiziellen Community-Server fuer TRMNL.

### Server starten

```bash
git clone https://github.com/usetrmnl/larapaper.git
cd larapaper/docker/prod
```

Vor dem ersten Start muss ein `APP_KEY` in der `docker-compose.yml` gesetzt werden:

```bash
# Key generieren
echo "base64:$(openssl rand -base64 32)"
```

Den generierten Key in `docker-compose.yml` eintragen (Zeile ist auskommentiert):

```yaml
environment:
    - APP_KEY=base64:deinGenerierterKey...
```

Dann starten:

```bash
docker compose up -d
```

Server laeuft auf `http://localhost:4567`.

### Server stoppen/neustarten

```bash
cd larapaper/docker/prod
docker compose restart   # Neustart
docker compose down      # Stoppen
docker compose up -d     # Starten
```

### LaraPaper Einstellungen

Im LaraPaper Dashboard unter Device Settings:

- **Image Format:** `BMP3 1-bit sRGB 2c`
- **Maximum Compatibility:** aktiviert
- **Permit Auto-Join:** aktiviert (oben rechts)

## Firmware

### Voraussetzungen

```bash
brew install platformio
```

### Firmware klonen und patchen

```bash
git clone https://github.com/usetrmnl/firmware.git trmnl-firmware
cd trmnl-firmware
```

### Patches fuer unser Display

Die Original-Firmware muss fuer das 3-Farben Waveshare Panel angepasst werden. Alle Patches sind in diesem Repo dokumentiert.

#### 1. Pin-Mapping (`src/DEV_Config.h`)

Im `BOARD_WAVESHARE_ESP32_DRIVER` Block:

```cpp
#define EPD_SCK_PIN  18   // CLK  -> SCK  (GPIO 18) - gelb
#define EPD_MOSI_PIN 23   // DIN  -> MOSI (GPIO 23) - blau
#define EPD_CS_PIN   2    // CS   -> D9   (GPIO 2)  - orange
#define EPD_RST_PIN  21   // RST  -> SDA  (GPIO 21) - weiss
#define EPD_DC_PIN   22   // DC   -> SCL  (GPIO 22) - gruen
#define EPD_BUSY_PIN 13   // BUSY -> D7   (GPIO 13) - lila
```

#### 2. 3-Farben Treiber aktivieren (`platformio.ini`)

Im `[env:waveshare-esp32-driver]` Block:

```ini
build_flags =
    ${env:esp32_base.build_flags}
    -D BOARD_WAVESHARE_ESP32_DRIVER
    -D EPD_3CLR
```

#### 3. Display-Treiber Profil (`src/display.cpp`)

Eigenen Block fuer `BOARD_WAVESHARE_ESP32_DRIVER` mit `EPD_3CLR` und ohne hinzufuegen (nach dem `BOARD_SEEED_RETERMINAL_E1002` Block):

```cpp
#elif defined(BOARD_WAVESHARE_ESP32_DRIVER) && defined(EPD_3CLR)
    {EP75R_800x480, EP75R_800x480},
    {EP75R_800x480, EP75R_800x480},
    {EP75R_800x480, EP75R_800x480},
};
BBEPAPER bbep(EP75R_800x480);
#elif defined(BOARD_WAVESHARE_ESP32_DRIVER)
    {EP75_800x480, EP75_800x480_4GRAY},
    {EP75_800x480, EP75_800x480_4GRAY},
    {EP75_800x480, EP75_800x480_4GRAY},
};
BBEPAPER bbep(EP75_800x480);
```

#### 4. Rote Ebene leeren fuer B/W Bilder (`src/display.cpp`)

Nach `bbep.writePlane()` im BMP-Pfad (~Zeile 1400):

```cpp
bbep.writePlane();
if (bbep.capabilities() & BBEP_3COLOR) {
    // 3-color panel: clear red plane (0x00 = no red pixels on UC8179)
    bbep.startWrite(PLANE_1);
    uint8_t zeroLine[100];
    memset(zeroLine, 0x00, sizeof(zeroLine));
    int rowBytes = bbep.width() / 8;
    for (int y = 0; y < bbep.height(); y++) {
        bbep.writeData(zeroLine, rowBytes);
    }
}
```

Im PNG-Pfad: gleicher Clear nach `png->close()` fuer PLANE_1 (statt invertierte Bilddaten).

#### 5. BMP-Daten invertieren fuer 3-Farben CDI (`src/display.cpp`)

Vor `bbep.setBuffer()` im BMP-Pfad:

```cpp
if (bbep.capabilities() & BBEP_3COLOR) {
    uint8_t *p = image_buffer + 62;
    int bufSize = (bbep.width() * bbep.height()) / 8;
    for (int i = 0; i < bufSize; i++) p[i] = ~p[i];
}
```

#### 6. FULL Refresh erzwingen (`src/display.cpp`)

Im Refresh-Block:

```cpp
#ifdef BOARD_WAVESHARE_ESP32_DRIVER
    iRefreshMode = REFRESH_FULL;
    bWait = 1;
#else
    if (!bWait) iRefreshMode = REFRESH_PARTIAL;
#endif
```

#### 7. Booster Soft-Start fuer 075RW-Z08 v3 (bb_epaper Library)

In `.pio/libdeps/waveshare-esp32-driver/bb_epaper/src/bb_ep.inl`, `epd75r_init[]` Booster-Befehl hinzufuegen:

```c
const uint8_t epd75r_init[] PROGMEM = {
    5, 0x06, 0x17, 0x17, 0x28, 0x17, // booster soft-start (075RW-Z08 v3)
    5, 0x01, 0x07, 0x07, 0x3f, 0x3f, // power setting
    1, 0x04, // power on
    BUSY_WAIT,
    // ... rest bleibt gleich
};
```

#### 8. BUSY Timeout erhoehen (bb_epaper Library)

In `bb_ep.inl`, `bbepWaitBusy()`:

```c
iMaxTime = 30000; // 30s timeout fuer alle Panels
```

### Bauen und flashen

```bash
# Flash komplett loeschen (erster Flash oder bei Problemen)
esptool.py --port /dev/cu.wchusbserial110 erase_flash

# Firmware flashen
pio run -e waveshare-esp32-driver --target upload
```

### Device konfigurieren

Nach dem Flashen startet der ESP32 im WiFi AP-Modus:

1. Mit dem WLAN des ESP32 verbinden (Handy oder Laptop)
2. Captive Portal oeffnet sich automatisch
3. Eigenes WLAN eingeben (SSID + Passwort)
4. **Server URL** eingeben: `http://<SERVER-IP>:4567`
5. ESP32 startet neu und registriert sich bei LaraPaper

### Serial Monitor

```bash
cd ~/trmnl-firmware
pio device monitor -e waveshare-esp32-driver
```

**Tipps:**
- Beenden mit `Ctrl+C`
- Falls kein Output: USB-Kabel pruefen (manche sind nur Ladekabel)

## TODO

- [ ] Roten Kanal nutzen (aktuell nur B/W, rote Ebene wird geleert)
- [ ] LaraPaper als LaunchAgent/systemd Service einrichten fuer Autostart
- [ ] Docker auf dem anderen Mac aufsetzen
