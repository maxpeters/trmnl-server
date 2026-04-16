# Wetter Koeln (Weather)

Current weather, 24h temperature/rain forecast chart with Kita drop-off/pickup time overlays.

## API Endpoint

`GET /api/weather` (LaraPaper server, port 8000)

## Expected Fields

| Field | Type | Description |
|-------|------|-------------|
| `available` | boolean | Whether data is available |
| `updated_at` | string | Last update timestamp |
| `current.temp` | number | Current temperature |
| `current.description` | string | Weather description (German) |
| `daily.today.min` | number | Daily low temperature |
| `daily.today.max` | number | Daily high temperature |
| `daily.today.precipitation_prob` | number | Daily rain probability (0-100) |
| `daily.today.sunrise` | string | Sunrise time (HH:MM) |
| `daily.today.sunset` | string | Sunset time (HH:MM) |
| `hourly` | array | Hourly forecast (24 entries) |
| `hourly[].time` | string | Hour (HH:MM) |
| `hourly[].temp` | number | Temperature |
| `hourly[].precipitation_prob` | number | Rain probability (0-100) |
| `bike_forecast` | object | Optional cycling weather advisory |
| `bike_forecast.status` | string | "wet" or "dry" |
| `bike_forecast.label` | string | Short label |
| `bike_forecast.message` | string | Advisory message |

## Refresh Interval

15 minutes

## Templates

- `full.liquid` -- Current temp/description, min/max, 24h SVG chart (temp line + rain bars), Kita time overlays (red dot pattern), legend
- `half_horizontal.liquid` -- Compact: current weather + bike forecast left, chart right

## Known Issues

- Kita times (Bring 7:30-9:30, Abhol 13:30-16:30) are hardcoded in full template.
- Rain probability > 50% renders in red (warning accent).
- Now marker uses TRMNL render timezone context instead of a fixed UTC offset hack.
