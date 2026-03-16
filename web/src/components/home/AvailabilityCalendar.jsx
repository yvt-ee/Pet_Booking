// web/src/components/home/AvailabilityCalendar.jsx
import React, { useMemo, useState } from "react";

const TZ = "America/Los_Angeles";

// 你可以先手动维护忙碌区间（未来可替换为后端/Google Calendar）
const busyRanges = [
  // { start: "2026-03-10T00:00:00-08:00", end: "2026-03-12T23:59:59-08:00" },
];

function toDate(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function AvailabilityCalendar({ days = 30 }) {
  const [cursor, setCursor] = useState(startOfDay(new Date()));

  const busy = useMemo(() => {
    return busyRanges
      .map((r) => ({ start: toDate(r.start), end: toDate(r.end) }))
      .filter((r) => r.start && r.end && r.end > r.start);
  }, []);

  const items = useMemo(() => {
    const out = [];
    const todayStart = startOfDay(new Date());

    for (let i = 0; i < days; i++) {
      const day = addDays(cursor, i);
      const dayStart = startOfDay(day);
      const dayEnd = addDays(dayStart, 1);

      // “今天之前”统一置灰（不含今天）
      const isPast = dayEnd <= todayStart;
      const isBusy = busy.some((r) => overlaps(dayStart, dayEnd, r.start, r.end));

      out.push({
        date: dayStart,
        label: dayStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        isPast,
        isAvailable: !isPast && !isBusy,
      });
    }
    return out;
  }, [busy, cursor, days]);

  return (
    <section style={{ marginTop: 12 }}>
      <div style={head}>
        <div style={h2}>Availability</div>
        <div style={sub}>
          My next {days} days. Green = available. Gray = booked/unavailable. Light gray = past dates.
        </div>
      </div>

      <div style={card}>
        <div style={toolbar}>
          <button style={btn2} onClick={() => setCursor(addDays(cursor, -7))}>
            ← Prev
          </button>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {cursor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} ({TZ})
          </div>
          <button style={btn2} onClick={() => setCursor(addDays(cursor, 7))}>
            Next →
          </button>
        </div>

        <div style={grid}>
          {items.map((it) => (
            <div key={it.date.toISOString()} style={cell(it.isAvailable, it.isPast)}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>{it.label}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {it.isPast ? "Past" : it.isAvailable ? "Available" : "Booked"}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Tip: This is an MVP view. Later we can sync this with Google Calendar or your booking table.
        </div>
      </div>
    </section>
  );
}

const head = { display: "grid", gap: 6, marginBottom: 10 };
const h2 = { fontSize: 18, fontWeight: 900 };
const sub = { fontSize: 12, opacity: 0.7 };

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
};

const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 10,
};

const btn2 = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const cell = (isAvailable, isPast) => ({
  borderRadius: 14,
  border: "1px solid #eee",
  padding: 10,
  background: isPast
    ? "rgba(0,0,0,0.03)"
    : isAvailable
      ? "rgba(10,122,47,0.08)"
      : "rgba(0,0,0,0.04)",
  opacity: isPast ? 0.55 : 1,
});