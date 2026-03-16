-- server/src/db/sql/900_seed_holidays.sql
-- Seed: Holidays + Peak seasons (Seattle Public Schools breaks + US federal holidays + custom peaks)
-- Safe to re-run (upsert by holiday_date)

CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT
);


-- =========================
-- US Federal Holidays (2026) (good default peak signals)
-- =========================
INSERT INTO holidays(holiday_date, name)
VALUES
  ('2026-01-01', 'Federal: New Year''s Day'),
  ('2026-02-16', 'Federal: Presidents Day'),
  ('2026-06-19', 'Federal: Juneteenth'),
  ('2026-07-03', 'Federal: Independence Day (Observed)'),
  ('2026-09-07', 'Federal: Labor Day'),
  ('2026-10-12', 'Federal: Columbus Day'),
  ('2026-11-11', 'Federal: Veterans Day'),
  ('2026-11-26', 'Federal: Thanksgiving Day'),
  ('2026-12-25', 'Federal: Christmas Day')
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;

-- =========================
-- Custom "Peak" add-ons (optional)
-- =========================

-- Thanksgiving week as peak (Mon-Sun). Comment out if you don't want whole week.
INSERT INTO holidays(holiday_date, name)
SELECT d::date, 'Peak: Thanksgiving Week (custom)'
FROM generate_series('2026-11-23'::date, '2026-11-29'::date, '1 day') AS d
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;

-- Christmas/New Year extended peak (custom). Comment out if too aggressive.
INSERT INTO holidays(holiday_date, name)
SELECT d::date, 'Peak: Holiday Season (custom)'
FROM generate_series('2025-12-20'::date, '2026-01-05'::date, '1 day') AS d
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;

-- Easter weekend peaks (custom)
INSERT INTO holidays(holiday_date, name)
VALUES
  ('2026-04-03', 'Peak: Good Friday (custom)'),
  ('2026-04-05', 'Peak: Easter Sunday (custom)')
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;