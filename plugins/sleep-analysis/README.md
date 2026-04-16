# Sleep Analysis

Nightly sleep breakdown with hypnogram visualization.

## API Endpoint

`GET /api/fitness/summary` (LaraPaper server, port 8000) -- sleep data is part of the fitness summary response.

## Expected Fields

| Field | Type | Description |
|-------|------|-------------|
| `available` | boolean | Whether data is available |
| `date` | string | Current date (ISO format) |
| `sleep` | object | Sleep data object (nil when no data) |
| `sleep.total_sleep_min` | number | Total sleep duration in minutes |
| `sleep.deep_sleep_min` | number | Deep sleep minutes |
| `sleep.light_sleep_min` | number | Light sleep minutes |
| `sleep.rem_sleep_min` | number | REM sleep minutes |
| `sleep.awake_min` | number | Awake minutes |
| `sleep.sleep_score` | number | Sleep quality score (0-100) |
| `sleep.start_time` | string | Bedtime (HH:MM) |
| `sleep.end_time` | string | Wake time (HH:MM) |
| `sleep.sleep_date` | string | Date of sleep (YYYY-MM-DD) |
| `sleep.phases` | array | Sleep phase sequence |
| `sleep.phases[].phase` | string | Phase type: "deep", "light", "rem", "awake" |
| `sleep.phases[].duration_min` | number | Phase duration in minutes |

## Configuration

- `server_url` custom field overrides the API base URL used for polling.

## Refresh Interval

15 minutes

## Templates

- `full.liquid` -- Duration, score, phase breakdown, full-width SVG hypnogram
- `half_horizontal.liquid` -- Compact: score, phase table with percentages, mini hypnogram

## Known Issues

- Score label "Schlecht" (red) triggers at score < 50.
- Awake phases render in red in the half_horizontal hypnogram for visibility.
