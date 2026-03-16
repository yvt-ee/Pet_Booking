// server/src/services/pricing.js
// Pricing rules:
// - 24h = 1 day unit
// - extra hours > 12 => +0.5 day unit (else +0)
// - First dog: base_rate_per_day on normal units; holiday_rate_per_day on holiday units
// - Additional dogs: additional_dog_rate_per_day (applies to all units)
// - First cat: cat_rate_per_day (applies to all units)
// - Additional cats: additional_cat_rate_per_day (applies to all units)
// - Holidays are determined per "unit start date" in local time (America/Los_Angeles by default)

const DEFAULT_TZ = "America/Los_Angeles";

/**
 * @typedef {'DOG'|'CAT'|'OTHER'} PetType
 * @typedef {{ id: string, pet_type: PetType }} PetLite
 * @typedef {{
 *   base_rate_per_day: number|string,
 *   holiday_rate_per_day: number|string,
 *   cat_rate_per_day: number|string,
 *   additional_dog_rate_per_day: number|string,
 *   additional_cat_rate_per_day: number|string
 * }} ServiceRates
 */

/**
 * Convert to finite number (supports numeric strings).
 */
function num(x) {
  const n = typeof x === "string" ? Number(x) : x;
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${x}`);
  return n;
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function startOfDayLocal(date, tz) {
  // For MVP, use system local time when tz === local machine tz.
  // In production, use a timezone library (luxon/date-fns-tz) for strict TZ.
  // Since your app runs in Seattle most likely, this is OK for now.
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addHours(d, h) {
  return new Date(d.getTime() + h * 3600 * 1000);
}

/**
 * @param {Date} d
 * @param {string} tz
 * @returns {string} 'YYYY-MM-DD' in local time
 */
function ymdLocal(d, tz) {
  // MVP: local time formatting. If server TZ differs, use luxon later.
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compute billable day units:
 * fullDays + (extraHours > 12 ? 0.5 : 0)
 */
export function computeDayUnits(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) throw new Error("Invalid time range");

  const hours = ms / 3600e3;

  // Rule:
  // - <24h => 1 day
  // - >=24h => full days + (0..12h => +0.5, >12h => +1)
  if (hours < 24) {
    return {
      hours: round2(hours),
      fullDays: 0,
      extraHours: round2(hours),
      dayUnits: 1,
      hasHalf: false, // special-case: we bill as 1 full day
      remainderRule: "<24h => 1 day",
    };
  }

  const fullDays = Math.floor(hours / 24);
  const extraHours = hours - fullDays * 24;

  let extraUnits = 0;
  if (extraHours === 0) extraUnits = 0;
  else if (extraHours <= 12) extraUnits = 0.5;
  else extraUnits = 1;

  const dayUnits = fullDays + extraUnits;

  return {
    hours: round2(hours),
    fullDays,
    extraHours: round2(extraHours),
    dayUnits,
    hasHalf: extraUnits === 0.5, // only meaningful when >=24h
    remainderRule: "extra 0..12h => +0.5, >12h => +1",
  };
}

/**
 * Determine holiday units by splitting into "units":
 * - each 24h block contributes 1 unit, holiday if unit_start local date is in holidaySet
 * - optional 0.5 block contributes 0.5 unit, holiday if its unit_start local date is in holidaySet
 *
 * @param {string|Date} startAt
 * @param {{ fullDays:number, hasHalf:boolean }} unitsMeta
 * @param {Set<string>} holidaySet - set of 'YYYY-MM-DD'
 * @param {string} tz
 */
export function computeHolidayUnits(startAt, unitsMeta, holidaySet, tz = DEFAULT_TZ) {
  const start = new Date(startAt);
  let holidayUnits = 0;

  function unitTouchesHoliday(unitStart, unitEnd) {
    // 检查 unitStart 所在日期、以及 unitEnd-1ms 所在日期（覆盖跨日）
    const startKey = ymdLocal(unitStart, tz);
    const endKey = ymdLocal(new Date(unitEnd.getTime() - 1), tz);
    if (holidaySet.has(startKey) || holidaySet.has(endKey)) return true;

    // 如果你担心跨多天（理论上 unit 最多 24h 或 12h），
    // 这里已经足够；24h最多跨到 next day。
    return false;
  }

  // full 24h blocks
  for (let k = 0; k < unitsMeta.fullDays; k++) {
    const unitStart = addHours(start, 24 * k);
    const unitEnd = addHours(unitStart, 24);
    if (unitTouchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  }

  // optional half-day block (0.5) => 12h
  if (unitsMeta.hasHalf) {
    const unitStart = addHours(start, 24 * unitsMeta.fullDays);
    const unitEnd = addHours(unitStart, 12);
    if (unitTouchesHoliday(unitStart, unitEnd)) holidayUnits += 0.5;
  }

  return holidayUnits;
}

/**
 * Main pricing function.
 *
 * @param {Object} args
 * @param {string|Date} args.start_at
 * @param {string|Date} args.end_at
 * @param {PetLite[]} args.pets
 * @param {ServiceRates} args.rates
 * @param {string[]} args.holiday_dates - array of 'YYYY-MM-DD'
 * @param {string} [args.tz]
 */
export function quoteBooking({ start_at, end_at, pets, rates, holiday_dates = [], tz = DEFAULT_TZ }) {
  const r = {
    base: num(rates.base_rate_per_day),
    holiday: num(rates.holiday_rate_per_day),
    cat: num(rates.cat_rate_per_day),
    addDog: num(rates.additional_dog_rate_per_day),
    addCat: num(rates.additional_cat_rate_per_day),
  };

  const { hours, fullDays, extraHours, dayUnits, hasHalf } = computeDayUnits(start_at, end_at);

  const holidaySet = new Set((holiday_dates || []).map(String));
  const holidayUnits = computeHolidayUnits(start_at, { fullDays, hasHalf }, holidaySet, tz);
  const normalUnits = round2(dayUnits - holidayUnits);

  // pet counts
  const dogs = (pets || []).filter((p) => p.pet_type === "DOG").length;
  const cats = (pets || []).filter((p) => p.pet_type === "CAT").length;

  // First dog uses base/holiday split; additional dogs use addDog across all units
  const firstDogNormal = dogs >= 1 ? normalUnits * r.base : 0;
  const firstDogHoliday = dogs >= 1 ? holidayUnits * r.holiday : 0;
  const additionalDogs = Math.max(dogs - 1, 0) * dayUnits * r.addDog;

  // Cats: first cat uses cat_rate across all units; additional cats use addCat across all units
  const firstCat = cats >= 1 ? dayUnits * r.cat : 0;
  const additionalCats = Math.max(cats - 1, 0) * dayUnits * r.addCat;

  const dogsCost = round2(firstDogNormal + firstDogHoliday + additionalDogs);
  const catsCost = round2(firstCat + additionalCats);
  const total = round2(dogsCost + catsCost);

  return {
    duration: {
      hours: round2(hours),
      full_days: fullDays,
      extra_hours: round2(extraHours),
      day_units: dayUnits,
      rule: "24h=1, extra>12h => +0.5",
    },
    units: {
      normal_units: normalUnits,
      holiday_units: holidayUnits,
      tz,
    },
    pets: { dogs, cats },
    rates: {
      base_rate_per_day: r.base,
      holiday_rate_per_day: r.holiday,
      cat_rate_per_day: r.cat,
      additional_dog_rate_per_day: r.addDog,
      additional_cat_rate_per_day: r.addCat,
    },
    breakdown: {
      first_dog_normal: round2(firstDogNormal),
      first_dog_holiday: round2(firstDogHoliday),
      additional_dogs: round2(additionalDogs),
      first_cat: round2(firstCat),
      additional_cats: round2(additionalCats),
      dogs_cost: dogsCost,
      cats_cost: catsCost,
      total,
    },
  };
}