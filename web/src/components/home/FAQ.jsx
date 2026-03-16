// web/src/components/home/FAQ.jsx
import React from "react";

export default function FAQ() {
  return (
    <section style={{ marginTop: 12 }}>
      <div style={sectionHead}>
        <div style={h2}>FAQ</div>
        <div style={sub}>Quick answers to common questions.</div>
      </div>

      <div style={card}>
        <FAQItem q="Do you take multiple pets at once?">
          I’m a solo sitter. For now I keep bookings small to maintain consistent care. If you have multiple pets,
          mention it in chat and we’ll confirm what’s a good fit.
        </FAQItem>

        <FAQItem q="How do Meet & Greets work?">
          After you create a request, chat opens immediately. If you’d like, you can request a Meet &amp; Greet
          ($15) inside the chat before I confirm the booking.
        </FAQItem>

        <FAQItem q="What do I need to bring?">
          Food, any medications, and a favorite toy/blanket is perfect. If your pet has a routine, share it in chat
          so I can follow it closely.
        </FAQItem>

        <FAQItem q="Will I get updates?">
          Yes — daily logs (mood/energy/health) plus photos during the booking. You can revisit logs later in the portal.
        </FAQItem>

        <FAQItem q="What areas do you serve?">
          Seattle area. Share your neighborhood in chat and I’ll confirm availability and logistics.
        </FAQItem>
      </div>
    </section>
  );
}

function FAQItem({ q, children }) {
  return (
    <details style={item}>
      <summary style={summary}>
        <span style={{ fontWeight: 900 }}>{q}</span>
        <span style={chev}>▾</span>
      </summary>
      <div style={answer}>{children}</div>
    </details>
  );
}

const sectionHead = { display: "grid", gap: 6, marginBottom: 10 };
const h2 = { fontSize: 18, fontWeight: 900 };
const sub = { fontSize: 12, opacity: 0.7 };

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 8,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
};

const item = {
  borderTop: "1px solid #f0f0f0",
  padding: "10px 10px",
};

const summary = {
  listStyle: "none",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  gap: 12,
};

const chev = { opacity: 0.6, fontSize: 12 };
const answer = { marginTop: 10, fontSize: 13, lineHeight: 1.6, opacity: 0.85 };