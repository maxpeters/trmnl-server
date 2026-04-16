# MiFlora Pflanzen (Plant Monitor)

Moisture, temperature, light, and battery for Xiaomi MiFlora plant sensors with 7-day moisture trend charts and watering predictions.

## API Endpoint

`GET /api/plants/data?days=7` (MiFlora dashboard, port 8420)

## Expected Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | Data timestamp |
| `analyses` | array | Per-plant analysis objects |
| `analyses[].sensor_name` | string | Plant/sensor display name |
| `analyses[].latest_reading.moisture` | number | Soil moisture (0-100%) |
| `analyses[].latest_reading.temperature` | number | Temperature in C |
| `analyses[].latest_reading.light` | number | Light in lux |
| `analyses[].latest_reading.battery` | number | Sensor battery (0-100%) |
| `analyses[].prediction.status` | string | "dry" when needs watering |
| `analyses[].prediction.days_until_dry` | number | Estimated days until dry |
| `chart_data` | object | Keyed by sensor_name |
| `chart_data[name].moisture` | array | Array of [timestamp, value] pairs |

## Refresh Interval

30 minutes

## Templates

- `full.liquid` -- 3-column grid: moisture hero, 7-day sparkline with dry threshold (red dashed), temperature/light/battery, watering prediction
- `half_horizontal.liquid` -- Compact row: moisture, temperature, battery, watering status per plant

## Known Issues

- Chart dry threshold is hardcoded at 15%.
- Grid assumes 3 plants max (`grid--cols-3`).
