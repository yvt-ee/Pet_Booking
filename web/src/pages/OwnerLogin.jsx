import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OwnerLogin() {
  const nav = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("ownerToken") || "");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    const cleaned = token.trim();
    if (!cleaned) {
      setErr("Please enter owner token.");
      return;
    }

    localStorage.setItem("ownerToken", cleaned);
    setMsg("Owner token saved.");
    nav("/owner/dashboard");
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Owner login</div>

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12, lineHeight: 1.6 }}>
        Enter the owner access token configured on the server. For this MVP, the token is
        stored in <code>localStorage</code> and used for owner-only requests.
      </div>

      {err ? <div style={{ color: "#b00020", marginBottom: 10 }}>{err}</div> : null}
      {msg ? <div style={{ color: "#0a7a2f", marginBottom: 10 }}>{msg}</div> : null}

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter owner token"
          style={input}
          autoComplete="off"
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" style={primaryBtn}>Login</button>

          <button
            type="button"
            style={secondaryBtn}
            onClick={() => {
              localStorage.removeItem("ownerToken");
              setToken("");
              setErr("");
              setMsg("Saved owner token cleared.");
            }}
          >
            Clear saved token
          </button>
        </div>
      </form>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
        Store the real token in your server <code>.env</code> file as{" "}
        <code>OWNER_ADMIN_TOKEN</code>. Do not hardcode it in frontend files or commit it to
        GitHub.
      </div>
    </div>
  );
}

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
  maxWidth: 520,
};

const input = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 12,
};

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};