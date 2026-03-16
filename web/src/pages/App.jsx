import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./Home.jsx";
import Booking from "./Booking.jsx";
import ClientPortal from "./ClientPortal.jsx";
import OwnerLogin from "./OwnerLogin.jsx";
import OwnerDashboard from "./OwnerDashboard.jsx";
import ChatPage from "./ChatPage.jsx";

function Nav() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid #eee",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Pet Sitting</div>
        <Link to="/" style={linkStyle}>Home</Link>
        <Link to="/book" style={linkStyle}>Pet Booking</Link>
        <Link to="/portal" style={linkStyle}>Client Portal</Link>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link to="/owner" style={linkStyle}>Owner</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<Booking />} />
          <Route path="/portal" element={<ClientPortal />} />

          {/* NEW: chat page */}
          <Route path="/chat/:conversationId" element={<ChatPage />} />

          <Route path="/owner" element={<OwnerGate />} />
          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function OwnerGate() {
  const token = localStorage.getItem("ownerToken");
  return token
    ? <Navigate to="/owner/dashboard" replace />
    : <Navigate to="/owner/login" replace />;
}

const linkStyle = { textDecoration: "none", color: "#111", opacity: 0.8 };