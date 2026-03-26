// web/src/components/home/ReviewsWall.jsx
import React, { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:8080";

function stars(n) {
  const x = Math.max(0, Math.min(5, Number(n || 0)));
  return "★★★★★☆☆☆☆☆".slice(5 - x, 10 - x);
}

export default function ReviewsWall() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const r = await fetch(`${API_BASE}/reviews/public?limit=9`);
        const d = await r.json();

        if (!r.ok) {
          throw new Error(d?.error || "Failed to load reviews");
        }

        if (!cancelled) {
          setItems(d.reviews || []);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Failed to load reviews");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={{ marginTop: 12 }}>
      <div style={head}>
        <div style={h2}>Reviews</div>
        <div style={sub}>Recent client feedback from completed bookings.</div>
      </div>

      <div style={card}>
        {loading ? <div style={{ opacity: 0.7 }}>Loading reviews…</div> : null}
        {err ? <div style={{ color: "#b00020", marginBottom: 10 }}>{err}</div> : null}

        {!loading && !err && !items.length ? (
          <div style={{ opacity: 0.7 }}>No reviews yet.</div>
        ) : null}

        {!loading && !err && !!items.length ? (
          <div style={grid}>
            {items.map((r) => (
              <div key={r.id} style={item}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: 13 }}>
                    Client {r.client_initial ? `${r.client_initial}.` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{stars(r.rating)}</div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  {r.service_type} 
                </div>

                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    opacity: 0.9,
                    marginTop: 8,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.comment || "—"}
                </div>

                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : null}
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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
};

const item = {
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};