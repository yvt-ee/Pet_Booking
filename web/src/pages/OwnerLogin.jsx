import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OwnerLogin() {
  const nav = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("ownerToken") || "");
  const [err, setErr] = useState("");

  function submit() {
    setErr("");
    if (!token.trim()) { setErr("Please enter owner token"); return; }
    localStorage.setItem("ownerToken", token.trim());
    nav("/owner/dashboard");
  }

  return (
    <div style={card}>
      <div style={{ fontSize:20, fontWeight:900, marginBottom:10 }}>Owner login</div>
      <div style={{ fontSize:12, opacity:0.75, marginBottom:10 }}>
        This MVP uses a simple token stored in localStorage.
      </div>
      {err ? <div style={{ color:"#b00020", marginBottom:10 }}>{err}</div> : null}
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="OWNER token" style={input} />
      <div style={{ marginTop:10 }}>
        <button onClick={submit} style={primaryBtn}>Login</button>
      </div>
    </div>
  );
}

const card = { background:"#fff", border:"1px solid #eaeaea", borderRadius:18, padding:18, boxShadow:"0 1px 10px rgba(0,0,0,0.05)", maxWidth:520 };
const input = { width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:12 };
const primaryBtn = { padding:"10px 14px", borderRadius:12, border:"1px solid #111", background:"#111", color:"#fff", cursor:"pointer", fontWeight:800 };
