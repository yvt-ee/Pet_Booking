// web/src/components/home/HowItWorks.jsx
import React from "react";

export default function HowItWorks() {
  return (
    <section style={{ marginTop: 12 }}>
      <div style={sectionHead}>
        <div style={h2}>How it works</div>
        <div style={sub}>A simple workflow designed for clarity and daily transparency.</div>
      </div>

      <div style={row}>
        <Step n="1" title="Choose service + dates">
          Pick a service and provide your pet details.
        </Step>
        <Step n="2" title="Chat opens immediately">
          Ask questions, share routines, and align on expectations.
        </Step>
        <Step n="3" title="Optional Meet & Greet ($15)">
          Request a meet inside chat before confirmation.
        </Step>
        <Step n="4" title="Confirm, pay, and get daily updates">
          Daily logs (mood/health) and photos during the booking.
        </Step>
      </div>
    </section>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={card}>
      <div style={top}>
        <div style={badge}>{n}</div>
        <div style={{ fontWeight: 950 }}>{title}</div>
      </div>
      <div style={body}>{children}</div>
    </div>
  );
}

const sectionHead = { display: "grid", gap: 6, marginBottom: 10 };
const h2 = { fontSize: 18, fontWeight: 900 };
const sub = { fontSize: 12, opacity: 0.7 };

const row = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
};

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
  display: "grid",
  gap: 10,
};

const top = { display: "flex", alignItems: "center", gap: 10 };
const badge = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
};
const body = { fontSize: 13, opacity: 0.85, lineHeight: 1.5 };