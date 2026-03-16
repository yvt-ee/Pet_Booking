import React, { useEffect, useState } from "react";
import { api, putToS3 } from "../lib/api.js";

const card = { background:"#fff", border:"1px solid #eaeaea", borderRadius:16, padding:16, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" };
const input = { width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:12 };
const btn = { padding:"10px 12px", borderRadius:12, border:"1px solid #111", background:"#111", color:"#fff", cursor:"pointer" };
const btn2 = { padding:"10px 12px", borderRadius:12, border:"1px solid #ddd", background:"#fff", cursor:"pointer" };

export default function OwnerTools({ presetRequestId }) {
  const [ownerToken, setOwnerToken] = useState(localStorage.getItem("ownerToken") || "dev_owner_token");
  const [requestId, setRequestId] = useState("");

  useEffect(() => {
    if (presetRequestId) setRequestId(presetRequestId);
  }, [presetRequestId]);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState("");

  const [logs, setLogs] = useState([]);
  const [logForm, setLogForm] = useState({
    log_date: new Date().toISOString().slice(0,10),
    mood: "Good",
    energy_level: "Moderate",
    appetite: "Normal",
    health_status: "Normal",
    notes: ""
  });
  const [logPhoto, setLogPhoto] = useState(null);
  const [msg, setMsg] = useState("");

  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [review, setReview] = useState(null);

  useEffect(() => {
    localStorage.setItem("ownerToken", ownerToken);
  }, [ownerToken]);

  async function load() {
    setErr("");
    setMsg("");
    try {
      const d = await api.getRequest(requestId.trim());
      setDetail(d);
      setReviewEmail(d?.client?.email || "");
      const l = await api.getLogs(requestId.trim());
      setLogs(l.logs || []);
      try { const rv = await api.getReview(requestId.trim()); setReview(rv.review); } catch { setReview(null); }
    } catch (e) {
      setErr(e.message);
      setDetail(null);
      setLogs([]);
      setReview(null);
    }
  }

  async function saveLog() {
    setMsg("");
    try {
      await api.upsertLog(requestId.trim(), logForm, ownerToken);
      const l = await api.getLogs(requestId.trim());
      setLogs(l.logs || []);
      setMsg("Saved ✅");
    } catch (e) { setMsg(e.message); }
  }

  async function uploadToLatestLog() {
    if (!logs.length) { setMsg("Create a log first"); return; }
    if (!logPhoto) return;
    setMsg("");
    try {
      const pres = await api.presignUpload("log_photo", logPhoto.name, logPhoto.type);
      await putToS3(pres.upload_url, logPhoto);
      await api.addLogPhoto(logs[0].id, pres.public_url, "daily update", ownerToken);
      const l = await api.getLogs(requestId.trim());
      setLogs(l.logs || []);
      setMsg("Uploaded ✅");
    } catch (e) { setMsg(e.message); }
  }

  async function complete() {
    setMsg("");
    try {
      await api.completeRequest(requestId.trim(), ownerToken);
      await load();
      setMsg("Completed ✅");
    } catch (e) { setMsg(e.message); }
  }

  async function submitReview() {
    setMsg("");
    try {
      const out = await api.submitReview(requestId.trim(), reviewEmail, Number(reviewRating), reviewComment);
      setReview(out.review);
      setMsg("Review submitted ✅");
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <div style={card}>
        <div style={{ fontWeight:900, marginBottom:10 }}>Owner tools</div>
        <label style={{ display:"block", fontSize:13 }}>
          <div style={{ marginBottom:6, opacity:0.75 }}>Owner token</div>
          <input style={input} value={ownerToken} onChange={e=>setOwnerToken(e.target.value)} />
        </label>
        <div style={{ height:10 }} />
        <label style={{ display:"block", fontSize:13 }}>
          <div style={{ marginBottom:6, opacity:0.75 }}>Request ID</div>
          <input style={input} value={requestId} onChange={e=>setRequestId(e.target.value)} placeholder="paste request uuid" />
        </label>
        <div style={{ marginTop:10, display:"flex", gap:8 }}>
          <button style={btn} onClick={load} disabled={!requestId.trim()}>Load</button>
          <button style={btn2} onClick={complete} disabled={!requestId.trim()}>Complete</button>
        </div>
        {err ? <div style={{ marginTop:10, color:"#b00020" }}>{err}</div> : null}
        {msg ? <div style={{ marginTop:10, color: msg.includes("✅") ? "#0a7a2f" : "#b00020" }}>{msg}</div> : null}
        {detail ? (
          <div style={{ marginTop:12, fontSize:12, opacity:0.8 }}>
            <div><b>Status:</b> {detail.request.status}</div>
            <div><b>Client:</b> {detail.client?.name} ({detail.client?.email})</div>
            <div><b>Pet:</b> {detail.pet?.name}</div>
            <div><b>Service:</b> {detail.service?.service_type}</div>
          </div>
        ) : null}
      </div>

      <div style={card}>
        <div style={{ fontWeight:900, marginBottom:10 }}>Daily logs</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Date</div>
            <input style={input} value={logForm.log_date} onChange={e=>setLogForm({...logForm, log_date:e.target.value})} />
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Mood</div>
            <select style={input} value={logForm.mood} onChange={e=>setLogForm({...logForm, mood:e.target.value})}>
              <option>Excellent</option><option>Good</option><option>Okay</option><option>Low</option>
            </select>
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Energy</div>
            <select style={input} value={logForm.energy_level} onChange={e=>setLogForm({...logForm, energy_level:e.target.value})}>
              <option>High</option><option>Moderate</option><option>Low</option>
            </select>
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Appetite</div>
            <select style={input} value={logForm.appetite} onChange={e=>setLogForm({...logForm, appetite:e.target.value})}>
              <option>Normal</option><option>Reduced</option><option>Skipped</option>
            </select>
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Health</div>
            <select style={input} value={logForm.health_status} onChange={e=>setLogForm({...logForm, health_status:e.target.value})}>
              <option>Normal</option><option>Minor Issue</option><option>Needs Attention</option>
            </select>
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Notes</div>
            <input style={input} value={logForm.notes} onChange={e=>setLogForm({...logForm, notes:e.target.value})} />
          </label>
        </div>
        <div style={{ marginTop:10, display:"flex", gap:8 }}>
          <button style={btn2} onClick={saveLog} disabled={!requestId.trim()}>Save / Update log</button>
        </div>

        <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #eee" }}>
          <div style={{ fontWeight:800, marginBottom:8 }}>Photo to latest log</div>
          <input type="file" accept="image/*" onChange={e=>setLogPhoto(e.target.files?.[0] || null)} />
          <div style={{ marginTop:8 }}>
            <button style={btn2} onClick={uploadToLatestLog} disabled={!logPhoto || !logs.length}>Upload</button>
          </div>
        </div>

        <div style={{ marginTop:12, maxHeight:220, overflow:"auto", border:"1px solid #eee", borderRadius:12, padding:10, background:"#fff" }}>
          {logs.length ? logs.map(l => (
            <div key={l.id} style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, opacity:0.7 }}>{l.log_date} · {l.mood||"-"} · {l.energy_level||"-"} · {l.appetite||"-"} · {l.health_status||"-"}</div>
              <div style={{ whiteSpace:"pre-wrap" }}>{l.notes || ""}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginTop:6 }}>
                {(l.photos||[]).slice(0,4).map(p => (
                  <img key={p.id} alt="" src={p.url} style={{ width:"100%", height:70, objectFit:"cover", borderRadius:10, border:"1px solid #eee" }} />
                ))}
              </div>
            </div>
          )) : <div style={{ opacity:0.6 }}>No logs yet.</div>}
        </div>
      </div>

      <div style={{ gridColumn:"1 / -1", ...card }}>
        <div style={{ fontWeight:900, marginBottom:10 }}>Review (after COMPLETED)</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 1fr", gap:10 }}>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Client email</div>
            <input style={input} value={reviewEmail} onChange={e=>setReviewEmail(e.target.value)} />
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Rating</div>
            <select style={input} value={reviewRating} onChange={e=>setReviewRating(e.target.value)}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ fontSize:13 }}>
            <div style={{ marginBottom:6, opacity:0.75 }}>Comment</div>
            <input style={input} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop:10 }}>
          <button style={btn2} onClick={submitReview} disabled={!requestId.trim()}>Submit review</button>
        </div>

        <div style={{ marginTop:12, fontSize:13 }}>
          <div style={{ fontWeight:800, marginBottom:6 }}>Existing review</div>
          {review ? (
            <div style={{ padding:10, border:"1px solid #eee", borderRadius:12, background:"#fff" }}>
              <div><b>Rating:</b> {review.rating}</div>
              <div><b>Comment:</b> {review.comment || "—"}</div>
              <div style={{ fontSize:12, opacity:0.7 }}>{new Date(review.created_at).toLocaleString()}</div>
            </div>
          ) : <div style={{ opacity:0.6 }}>No review yet.</div>}
        </div>
      </div>
    </div>
  );
}
