# AI Fitness Auslastung (Gym Occupancy)

Live occupancy percentage for AI Fitness Agnesviertel with today vs. average chart.

## API Endpoint

`GET /api/gym` (LaraPaper server, port 8000)

## Expected Fields

| Field | Type | Description |
|-------|------|-------------|
| `current.percentage` | number | Current occupancy (0-100) |
| `today` | array | Hourly occupancy readings for today |
| `today[].hour` | number | Hour (7-22) |
| `today[].percentage` | number | Occupancy percentage |
| `average` | array | Historical hourly averages |
| `average[].hour` | number | Hour (7-22) |
| `average[].avg_percentage` | number | Average occupancy percentage |
| `updated_at` | string | Last update timestamp |

## Configuration

- `server_url` custom field overrides the API base URL used for polling.

## Refresh Interval

15 minutes

## Templates

- `full.liquid` -- Large percentage display, occupancy status label, best-time recommendation, SVG chart (today solid line, average dashed area, red dot for current)
- `half_horizontal.liquid` -- Compact: percentage + status left, chart right

## Known Issues

- Gym name "Agnesviertel" is hardcoded in full template.
- Chart x-axis starts at 7:00 (gym opening time).
- Now marker uses TRMNL render timezone context instead of a fixed UTC offset hack.
