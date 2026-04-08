import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import { renderHtmlToBmp, renderTextToBmp } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// BMP cache: deviceMac -> { buffer, generatedAt }
const bmpCache = new Map<string, { buffer: Buffer; generatedAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

// ─── Device API ────────────────────────────────────────────────

/**
 * GET /api/setup
 * Device registration. The device sends its MAC address in the ID header.
 * Returns an API key and friendly ID.
 */
app.get("/api/setup", (req, res) => {
  const mac = req.headers["id"] as string;
  if (!mac) {
    res.status(400).json({ error: "Missing ID header (MAC address)" });
    return;
  }

  // Check if device already exists
  const existing = db
    .prepare("SELECT api_key, friendly_id FROM devices WHERE mac_address = ?")
    .get(mac) as { api_key: string; friendly_id: string } | undefined;

  if (existing) {
    console.log(`[setup] Device ${mac} re-registered`);
    res.json({
      status: 200,
      api_key: existing.api_key,
      friendly_id: existing.friendly_id,
      message: "Device already registered",
    });
    return;
  }

  const apiKey = crypto.randomUUID();
  const friendlyId = `TRMNL-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  db.prepare(
    "INSERT INTO devices (mac_address, api_key, friendly_id) VALUES (?, ?, ?)"
  ).run(mac, apiKey, friendlyId);

  console.log(`[setup] New device registered: ${friendlyId} (${mac})`);
  res.json({
    status: 200,
    api_key: apiKey,
    friendly_id: friendlyId,
    message: "Device registered successfully",
  });
});

/**
 * GET /api/display
 * Returns the next screen for the device as a BMP image URL.
 * Headers: ID (MAC), Access-Token, Refresh-Rate, Battery-Voltage, FW-Version, RSSI
 */
app.get("/api/display", async (req, res) => {
  const mac = req.headers["id"] as string;
  if (!mac) {
    res.status(400).json({ error: "Missing ID header" });
    return;
  }

  // Update device telemetry
  const batteryVoltage = req.headers["battery-voltage"] as string;
  const fwVersion = req.headers["fw-version"] as string;
  const rssi = req.headers["rssi"] as string;
  const refreshRate = req.headers["refresh-rate"] as string;

  db.prepare(`
    UPDATE devices SET
      battery_voltage = COALESCE(?, battery_voltage),
      fw_version = COALESCE(?, fw_version),
      rssi = COALESCE(?, rssi),
      refresh_rate = COALESCE(?, refresh_rate),
      last_seen_at = datetime('now')
    WHERE mac_address = ?
  `).run(
    batteryVoltage || null,
    fwVersion || null,
    rssi ? parseInt(rssi) : null,
    refreshRate ? parseInt(refreshRate) : null,
    mac
  );

  // Get the device's configured refresh rate
  const device = db
    .prepare("SELECT refresh_rate FROM devices WHERE mac_address = ?")
    .get(mac) as { refresh_rate: number } | undefined;

  // Get the next active screen (round-robin based on time)
  const screens = db
    .prepare("SELECT * FROM screens WHERE active = 1 ORDER BY sort_order ASC")
    .all() as { id: number; html: string; name: string }[];

  if (screens.length === 0) {
    res.json({
      status: 0,
      image_url: `http://${req.headers.host}/api/bitmap/empty.png`,
      filename: "empty.bmp",
      refresh_rate: device?.refresh_rate || 900,
      reset_firmware: false,
      update_firmware: false,
      firmware_url: null,
      special_function: "none",
    });
    return;
  }

  // Simple rotation: pick screen based on current minute
  const screenIndex = Math.floor(Date.now() / 60000) % screens.length;
  const screen = screens[screenIndex];

  // Generate BMP filename
  const filename = `${mac.replace(/:/g, "")}_${Date.now()}.png`;

  // Pre-generate and cache the BMP
  try {
    const bmp = await renderHtmlToBmp(screen.html);
    bmpCache.set(filename, { buffer: bmp, generatedAt: Date.now() });

    console.log(`[display] Serving screen "${screen.name}" to ${mac}`);
    res.json({
      status: 0,
      image_url: `http://${req.headers.host}/api/bitmap/${filename}`,
      filename,
      refresh_rate: device?.refresh_rate || 900,
      reset_firmware: false,
      update_firmware: false,
      firmware_url: null,
      special_function: "none",
    });
  } catch (err) {
    console.error("[display] Render error:", err);
    res.status(500).json({ error: "Failed to render screen" });
  }
});

/**
 * GET /api/bitmap/:filename
 * Serves the pre-rendered BMP image.
 */
app.get("/api/bitmap/:filename", async (req, res) => {
  const { filename } = req.params;
  const cached = bmpCache.get(filename);

  if (cached) {
    res.set("Content-Type", "image/png");
    res.send(cached.buffer);
    // Cleanup old entries
    bmpCache.delete(filename);
    return;
  }

  // If not cached, generate a fallback
  try {
    const bmp = await renderTextToBmp("TRMNL", "No content available");
    res.set("Content-Type", "image/png");
    res.send(bmp);
  } catch {
    res.status(404).json({ error: "Bitmap not found" });
  }
});

/**
 * POST /api/log
 * Receives device-side error logs.
 */
app.post("/api/log", (req, res) => {
  const mac = req.headers["id"] as string;
  const { message, metadata } = req.body;

  db.prepare(
    "INSERT INTO logs (device_mac, message, metadata) VALUES (?, ?, ?)"
  ).run(mac || "unknown", message || "", JSON.stringify(metadata || {}));

  console.log(`[log] ${mac}: ${message}`);
  res.json({ status: 0 });
});

// ─── Admin Web UI API ──────────────────────────────────────────

/** List all devices */
app.get("/api/devices", (_req, res) => {
  const devices = db.prepare("SELECT * FROM devices ORDER BY last_seen_at DESC").all();
  res.json(devices);
});

/** List all screens */
app.get("/api/screens", (_req, res) => {
  const screens = db.prepare("SELECT * FROM screens ORDER BY sort_order ASC").all();
  res.json(screens);
});

/** Create a new screen */
app.post("/api/screens", (req, res) => {
  const { name, html } = req.body;
  if (!name || !html) {
    res.status(400).json({ error: "name and html are required" });
    return;
  }
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as m FROM screens")
    .get() as { m: number | null };
  const result = db
    .prepare("INSERT INTO screens (name, html, sort_order) VALUES (?, ?, ?)")
    .run(name, html, (maxOrder.m || 0) + 1);
  res.json({ id: result.lastInsertRowid, name, html });
});

/** Update a screen */
app.put("/api/screens/:id", (req, res) => {
  const { name, html, active } = req.body;
  db.prepare(
    "UPDATE screens SET name = COALESCE(?, name), html = COALESCE(?, html), active = COALESCE(?, active) WHERE id = ?"
  ).run(name || null, html || null, active ?? null, req.params.id);
  res.json({ ok: true });
});

/** Delete a screen */
app.delete("/api/screens/:id", (req, res) => {
  db.prepare("DELETE FROM screens WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/** Preview a screen as BMP */
app.get("/api/screens/:id/preview", async (req, res) => {
  const screen = db
    .prepare("SELECT html FROM screens WHERE id = ?")
    .get(req.params.id) as { html: string } | undefined;

  if (!screen) {
    res.status(404).json({ error: "Screen not found" });
    return;
  }

  try {
    const bmp = await renderHtmlToBmp(screen.html);
    res.set("Content-Type", "image/png");
    res.send(bmp);
  } catch (err) {
    res.status(500).json({ error: "Render failed" });
  }
});

/** Get recent logs */
app.get("/api/logs", (_req, res) => {
  const logs = db
    .prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(logs);
});

// ─── Start ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║         TRMNL BYOS Server                    ║
║         http://localhost:${PORT}               ║
╠══════════════════════════════════════════════╣
║  Device API:                                 ║
║    GET  /api/setup    - Device registration  ║
║    GET  /api/display  - Get next screen      ║
║    POST /api/log      - Device logs          ║
║                                              ║
║  Admin API:                                  ║
║    GET  /api/devices  - List devices         ║
║    CRUD /api/screens  - Manage screens       ║
║    GET  /api/logs     - View logs            ║
║                                              ║
║  Web UI: http://localhost:${PORT}              ║
╚══════════════════════════════════════════════╝
  `);
});
