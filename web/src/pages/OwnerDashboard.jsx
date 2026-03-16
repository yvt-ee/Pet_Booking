import React, { useEffect, useState } from "react";
import OwnerTools from "./OwnerTools.jsx";
import { useNavigate } from "react-router-dom";

export default function OwnerDashboard() {
  const nav = useNavigate();
  const token = localStorage.getItem("ownerToken") || "";
  const [requests, setRequests] = useState([]);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || "http://localhost:8080";
        const res = await fetch(`${base}/owner/requests`, { headers: { "x-owner-token": token } });
        const t = await res.text();
        let d=null; try{d=t?JSON.parse(t):null}catch{}
        if (!res.ok) throw new Error(d?.error || `HTTP_${res.status}`);
        setRequests(d.requests || []);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [token]);

  function logout() {
    localStorage.removeItem("ownerToken");
    nav("/owner/login");
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1.25fr", gap:12 }}>
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:18, fontWeight:900 }}>Owner dashboard</div>
          <button onClick={logout} style={btn2}>Logout</button>
        </div>
        <div style={{ fontSize:12, opacity:0.7, marginTop:6 }}>Recent requests (click one to manage).</div>
        {err ? <div style={{ color:"#b00020", marginTop:10 }}>{err}</div> : null}

        <div style={{ marginTop:10, maxHeight:560, overflow:"auto", border:"1px solid #eee", borderRadius:12, background:"#fff" }}>
          {requests.length ? requests.map(r => (
            <div key={r.id} onClick={()=>setSelected(r.id)} style={{
              padding:"10px 12px",
              cursor:"pointer",
              borderBottom:"1px solid #f0f0f0",
              background: selected===r.id ? "#f6f6f6" : "transparent"
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                <div style={{ fontWeight:800 }}>{r.client_name} · {r.pet_name}</div>
                <span style={badge(r.status)}>{r.status}</span>
              </div>
              <div style={{ fontSize:12, opacity:0.75 }}>
                {r.service_type} · {new Date(r.start_at).toLocaleString()} → {new Date(r.end_at).toLocaleString()}
              </div>
              <div style={{ fontSize:12, opacity:0.6 }}>{r.client_email}</div>
            </div>
          )) : <div style={{ padding:12, opacity:0.7 }}>No requests yet.</div>}
        </div>
      </div>

      <div>
        <OwnerTools presetRequestId={selected} />
      </div>
    </div>
  );
}

function badge(status) {
  const base = { padding:"3px 10px", borderRadius:999, fontSize:12, border:"1px solid #ddd" };
  if (status === "PAID") return { ...base, background:"#0a7a2f", color:"#fff", borderColor:"#0a7a2f" };
  if (status === "COMPLETED") return { ...base, background:"#1b5fd6", color:"#fff", borderColor:"#1b5fd6" };
  if (status === "CONFIRMED") return { ...base, background:"#111", color:"#fff", borderColor:"#111" };
  return base;
}

const card = { background:"#fff", border:"1px solid #eaeaea", borderRadius:18, padding:16, boxShadow:"0 1px 10px rgba(0,0,0,0.05)" };
const btn2 = { padding:"8px 12px", borderRadius:12, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:800 };
