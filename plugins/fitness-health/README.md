# Fitness & Health

Daily fitness summary from Apple Health via Garmin Connect.

## API Endpoint

`GET /api/fitness/summary` (LaraPaper server, port 8000)

## Expected Fields

| Field | Type | Description |
|-------|------|-------------|
| `available` | boolean | Whether data is available |
| `date` | string | Current date (ISO format) |
| `daily.steps` | number | Step count |
| `daily.distance_km` | number | Distance in km |
| `daily.active_calories` | number | Active calories burned |
| `daily.resting_hr` | number | Resting heart rate |
| `daily.min_hr` | number | Minimum heart rate |
| `daily.max_hr` | number | Maximum heart rate |
| `last_activity.name` | string | Workout name |
| `last_activity.duration_min` | number | Duration in minutes |
| `last_activity.distance_km` | number | Distance (0 for non-distance workouts) |
| `last_activity.calories` | number | Calories burned |
| `last_activity.avg_hr` | number | Average heart rate |
| `last_activity.max_hr` | number | Max heart rate |
| `last_activity.start_time` | string | Datetime of workout start |
| `week_summary.activities_count` | number | Workouts this week |
| `week_summary.total_duration_min` | number | Total workout minutes |
| `week_summary.zone2_minutes` | number | Zone 2 cardio minutes |
| `hr_zones.zone2_low` | number | Zone 2 lower bound (bpm) |
| `hr_zones.zone2_high` | number | Zone 2 upper bound (bpm) |

## Refresh Interval

15 minutes

## Templates

- `full.liquid` -- Steps, calories, HR, last workout, weekly summary
- `half_horizontal.liquid` -- Compact layout: steps hero, HR, workout + week

## Known Issues

None.
