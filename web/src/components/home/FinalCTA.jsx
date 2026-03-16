// web/src/components/home/FinalCTA.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function FinalCTA() {
  const nav = useNavigate();

  return (
    <section style={{ marginTop: 12 }}>
      <div style={card}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={title}>Ready to book?</div>
          <div style={sub}>
            Start a request to open chat. You can ask questions first and only confirm when you’re comfortable.
          </div>
        </div>

        <div style={row}>
          <button onClick={() => nav("/book?from=cta")} style={primaryBtn}>
            Book now
          </button>
          <button onClick={() => nav("/portal")} style={secondaryBtn}>
            Client portal
          </button>
        </div>
      </div>
    </section>
  );
}

const card = {
  background: "#111",
  border: "1px solid #111",
  borderRadius: 18,
  padding: 18,
  color: "#fff",
  boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const title = { fontSize: 18, fontWeight: 950 };
const sub = { fontSize: 13, opacity: 0.85, maxWidth: 720, lineHeight: 1.6 };

const row = { display: "flex", gap: 10, flexWrap: "wrap" };

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #fff",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
};

const secondaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.35)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};