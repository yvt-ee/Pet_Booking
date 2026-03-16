// web/src/components/home/Hero.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";

export default function Hero() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(false);

  async function handleBookNow() {
    setChecking(true);
    try {
      await api.clientMe(); // already logged in
      nav("/book");
    } catch {
      nav("/portal?intent=book");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section style={wrap}>
      <div style={grid}>
        <div style={left}>
          <div style={avatarWrap}>
            <img
              alt="Yvette"
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80"
              style={avatar}
            />
          </div>

          <div style={chips}>
            <Chip>Seattle</Chip>
            <Chip>Daily updates</Chip>
            <Chip>49 Reviews</Chip>
            <Chip>🌟 4.9</Chip>
            <Chip>Since 2025</Chip>
          </div>
        </div>

        <div style={right}>
          <div style={title}>Trusted solo pet sitting in Seattle</div>
          <div style={subtitle}>
            Hi, I&apos;m Yvette. I offer boarding, daycare, house sitting, drop-ins, and walks — with
            daily mood/health notes and photo updates so you always know how your pet is doing.
          </div>

          <div style={ctaRow}>
            <button onClick={handleBookNow} style={primaryBtn} disabled={checking}>
              {checking ? "Checking..." : "Book now"}
            </button>
          </div>

          <div style={mini}>
            Prefer to ask questions first? Start a booking to open chat — no commitment until you confirm.
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }) {
  return <span style={chip}>{children}</span>;
}

const wrap = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: 16,
  alignItems: "center",
};

const left = { display: "grid", gap: 12, alignContent: "start" };
const right = { display: "grid", gap: 10 };

const avatarWrap = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid #eee",
  background: "#fafafa",
};

const avatar = {
  width: "100%",
  height: 240,
  objectFit: "cover",
  display: "block",
};

const chips = { display: "flex", flexWrap: "wrap", gap: 8 };

const chip = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #eee",
  background: "#fff",
  opacity: 0.9,
};

const title = { fontSize: 30, fontWeight: 950, letterSpacing: -0.4, lineHeight: 1.1 };
const subtitle = { fontSize: 15, lineHeight: 1.6, opacity: 0.9, maxWidth: 720 };

const ctaRow = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 };

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  opacity: 1,
};

const mini = { fontSize: 12, opacity: 0.7, marginTop: 4 };