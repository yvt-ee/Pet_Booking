// web/src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 1px 10px rgba(0,0,0,0.05)",
};

const input = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 12,
};

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btn2 = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function statusTone(status) {
  switch (status) {
    case "REQUESTED":
      return "#8a6d1d";
    case "CONFIRMED":
      return "#0f5aa6";
    case "PAYMENT_PENDING":
      return "#8a3d1d";
    case "PAID":
      return "#0a7a2f";
    case "COMPLETED":
      return "#555";
    case "CANCELLED":
      return "#b00020";
    default:
      return "#666";
  }
}

function ownerHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Owner-Token": localStorage.getItem("ownerToken") || "",
  };
}

async function jfetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers: {
      ...ownerHeaders(),
      ...(opts.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || `HTTP_${res.status}`);
  }
  return data;
}

export default function OwnerDashboard() {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [reply, setReply] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [meetLoc, setMeetLoc] = useState("Seattle");
  const [logForm, setLogForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    mood: "",
    energy_level: "",
    appetite: "",
    health_status: "",
    notes: "",
  });
  const [logPhotoFiles, setLogPhotoFiles] = useState([]);
  const [logPhotos, setLogPhotos] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    const data = await jfetch("/owner/requests");
    const items = data.requests || [];
    setRequests(items);

    if (!selectedRequestId && items.length) {
      setSelectedRequestId(items[0].id);
    }
  }

  async function loadLogs(requestId) {
    const d = await jfetch(`/logs/request/${requestId}`);
    return d.logs || [];
  }

  async function loadDetail(requestId) {
    if (!requestId) return;

    const d = await jfetch(`/requests/${requestId}`);
    setDetail(d);

    if (d.conversation_id) {
      const m = await jfetch(`/conversations/${d.conversation_id}/messages?limit=100`);
      setMessages((m.items || []).slice().reverse());
    } else {
      setMessages([]);
    }

    const logs = await loadLogs(requestId);
    setDailyLogs(logs);
  }

  async function refreshAll(requestId = selectedRequestId) {
    setErr("");
    try {
      await loadRequests();
      if (requestId) {
        await loadDetail(requestId);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRequestId) return;
    loadDetail(selectedRequestId).catch((e) => setErr(e.message));
  }, [selectedRequestId]);

  const activeRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["REQUESTED", "CONFIRMED", "PAYMENT_PENDING", "PAID"].includes(r.status)
      ),
    [requests]
  );

  const historyRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"].includes(r.status)
      ),
    [requests]
  );

  const request = detail?.request || null;
  const client = detail?.client || null;
  const pets = detail?.pets || (detail?.pet ? [detail.pet] : []);
  const service = detail?.service || null;
  const meetGreet = detail?.meet_greet || null;
  const conversationId = detail?.conversation_id || null;

  async function sendReply() {
    if (!conversationId || !reply.trim()) return;
    setErr("");
    setOk("");

    try {
      await jfetch(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          sender: "OWNER",
          content: reply.trim(),
        }),
      });
      setReply("");
      setOk("Reply sent ✅");
      await loadDetail(selectedRequestId);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function createMeetGreet() {
    if (!selectedRequestId || !meetAt) {
      setErr("Please select meet time.");
      return;
    }
    setErr("");
    setOk("");

    try {
      await jfetch(`/requests/${selectedRequestId}/meet-greet`, {
        method: "POST",
        body: JSON.stringify({
          scheduled_at: new Date(meetAt).toISOString(),
          location: meetLoc || "Seattle",
        }),
      });
      setOk("Meet & greet created ✅");
      await loadDetail(selectedRequestId);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function cancelRequest() {
    if (!selectedRequestId) return;
    setErr("");
    setOk("");

    try {
      await jfetch(`/requests/${selectedRequestId}/cancel`, {
        method: "POST",
      });
      setOk("Request cancelled ✅");
      await refreshAll(selectedRequestId);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function uploadLogPhotos() {
    if (!logPhotoFiles.length) return;

    setErr("");
    setOk("");

    try {
      const uploaded = [];

      for (const file of logPhotoFiles) {
        const pres = await jfetch("/uploads/presign", {
          method: "POST",
          body: JSON.stringify({
            kind: "log_photo",
            filename: file.name,
            content_type: file.type,
          }),
        });

        await fetch(pres.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        uploaded.push({
          url: pres.public_url,
          caption: "",
        });
      }

      setLogPhotos((prev) => [...prev, ...uploaded]);
      setLogPhotoFiles([]);
      setOk("Log photos uploaded ✅");
    } catch (e) {
      setErr(e.message || "Failed to upload log photos");
    }
  }

  async function createDailyLog() {
    if (!selectedRequestId) return;

    if (!logForm.notes.trim()) {
      setErr("Please enter notes for the daily log.");
      return;
    }

    setErr("");
    setOk("");

    try {
      await jfetch(`/logs/request/${selectedRequestId}`, {
        method: "POST",
        body: JSON.stringify({
          log_date: logForm.log_date,
          mood: logForm.mood || null,
          energy_level: logForm.energy_level || null,
          appetite: logForm.appetite || null,
          health_status: logForm.health_status || null,
          notes: logForm.notes.trim(),
          photos: logPhotos,
        }),
      });

      setLogForm({
        log_date: new Date().toISOString().slice(0, 10),
        mood: "",
        energy_level: "",
        appetite: "",
        health_status: "",
        notes: "",
      });
      setLogPhotos([]);
      setLogPhotoFiles([]);

      setOk("Daily log added ✅");
      await loadDetail(selectedRequestId);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) {
    return <div style={card}>Loading dashboard…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {err ? <div style={{ ...card, color: "#b00020" }}>{err}</div> : null}
      {ok ? <div style={{ ...card, color: "#0a7a2f" }}>{ok}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Ongoing orders</div>

            {!activeRequests.length ? (
              <div style={{ opacity: 0.7 }}>No ongoing orders.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {activeRequests.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequestId(r.id)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: selectedRequestId === r.id ? "1px solid #111" : "1px solid #eee",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.service_type || "Service"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: statusTone(r.status),
                        fontWeight: 800,
                      }}
                    >
                      {r.status}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Order history summary</div>

            {!historyRequests.length ? (
              <div style={{ opacity: 0.7 }}>No history yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
                {historyRequests.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequestId(r.id)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: selectedRequestId === r.id ? "1px solid #111" : "1px solid #eee",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.service_type || "Service"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: statusTone(r.status),
                        fontWeight: 800,
                      }}
                    >
                      {r.status}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>Order details</div>
                {request ? (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Request ID: {request.id}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {request && !["CANCELLED", "COMPLETED"].includes(request.status) ? (
                  <button style={btn2} onClick={cancelRequest}>Cancel</button>
                ) : null}
              </div>
            </div>

            {!request ? (
              <div style={{ marginTop: 10, opacity: 0.7 }}>Select an order.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Client</div>
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <div><b>Name:</b> {client?.name || "—"}</div>
                      <div><b>Email:</b> {client?.email || "—"}</div>
                      <div><b>Phone:</b> {client?.phone || "—"}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Booking</div>
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <div><b>Service:</b> {service?.service_type || "—"}</div>
                      <div><b>Status:</b> {request.status}</div>
                      <div><b>Start:</b> {fmtDateTime(request.start_at)}</div>
                      <div><b>End:</b> {fmtDateTime(request.end_at)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Pets</div>
                  {!pets.length ? (
                    <div style={{ opacity: 0.7 }}>No pets found.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {pets.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 12,
                            padding: 10,
                            display: "grid",
                            gridTemplateColumns: p.avatar_url ? "72px 1fr" : "1fr",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.name}
                              style={{
                                width: 72,
                                height: 72,
                                objectFit: "cover",
                                borderRadius: 12,
                                border: "1px solid #eee",
                              }}
                            />
                          ) : null}

                          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                            <div style={{ fontWeight: 900 }}>{p.name}</div>
                            <div>{p.pet_type || "—"} · {p.breed || "—"}</div>
                            <div>Energy: {p.energy_level || "—"}</div>
                            <div>Notes: {p.notes || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Meet & greet</div>

                  {meetGreet ? (
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <div><b>Status:</b> {meetGreet.status}</div>
                      <div><b>When:</b> {fmtDateTime(meetGreet.scheduled_at)}</div>
                      <div><b>Location:</b> {meetGreet.location || "—"}</div>
                      <div>
                        <b>Fee:</b>{" "}
                        {meetGreet.price_cents != null
                          ? `$${(Number(meetGreet.price_cents) / 100).toFixed(2)}`
                          : "—"}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
                      <input
                        style={input}
                        type="datetime-local"
                        value={meetAt}
                        onChange={(e) => setMeetAt(e.target.value)}
                      />
                      <input
                        style={input}
                        value={meetLoc}
                        onChange={(e) => setMeetLoc(e.target.value)}
                        placeholder="Seattle"
                      />
                      <button style={btn2} onClick={createMeetGreet}>
                        Create meet & greet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>Conversation</div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  minHeight: 260,
                  maxHeight: 360,
                  overflow: "auto",
                  background: "#fafafa",
                  display: "grid",
                  gap: 8,
                }}
              >
                {!messages.length ? (
                  <div style={{ opacity: 0.7 }}>No messages yet.</div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === "OWNER";
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: mine ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "80%",
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: mine ? "1px solid #111" : "1px solid #e3e3e3",
                            background: mine ? "#111" : "#fff",
                            color: mine ? "#fff" : "#111",
                          }}
                        >
                          <div style={{ fontSize: 11, opacity: mine ? 0.8 : 0.6, marginBottom: 4 }}>
                            {m.sender} · {fmtDateTime(m.created_at)}
                          </div>
                          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <textarea
                  style={{ ...input, minHeight: 90 }}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to client..."
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    style={btn}
                    onClick={sendReply}
                    disabled={!conversationId || !reply.trim()}
                  >
                    Send reply
                  </button>
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>Daily logs</div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  minHeight: 260,
                  maxHeight: 360,
                  overflow: "auto",
                  background: "#fafafa",
                  display: "grid",
                  gap: 8,
                }}
              >
                {!dailyLogs.length ? (
                  <div style={{ opacity: 0.7 }}>No daily logs yet.</div>
                ) : (
                  dailyLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>
                        {fmtDateTime(log.created_at)}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                        <div><b>Date:</b> {log.log_date || "—"}</div>
                        <div><b>Mood:</b> {log.mood || "—"}</div>
                        <div><b>Energy:</b> {log.energy_level || "—"}</div>
                        <div><b>Appetite:</b> {log.appetite || "—"}</div>
                        <div><b>Health:</b> {log.health_status || "—"}</div>
                        <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                          <b>Notes:</b> {log.notes || "—"}
                        </div>

                        {log.photos?.length ? (
                          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {log.photos.map((photo) => (
                              <div key={photo.id} style={{ display: "grid", gap: 6 }}>
                                <img
                                  src={photo.url}
                                  alt={photo.caption || "Log photo"}
                                  style={{
                                    width: 120,
                                    height: 120,
                                    objectFit: "cover",
                                    borderRadius: 12,
                                    border: "1px solid #eee",
                                  }}
                                />
                                {photo.caption ? (
                                  <div style={{ fontSize: 12, opacity: 0.75 }}>{photo.caption}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Log date</div>
                    <input
                      type="date"
                      style={input}
                      value={logForm.log_date}
                      onChange={(e) =>
                        setLogForm({ ...logForm, log_date: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Mood</div>
                    <select
                      style={input}
                      value={logForm.mood}
                      onChange={(e) => setLogForm({ ...logForm, mood: e.target.value })}
                    >
                      <option value="">Select mood</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Okay">Okay</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Energy level</div>
                    <select
                      style={input}
                      value={logForm.energy_level}
                      onChange={(e) => setLogForm({ ...logForm, energy_level: e.target.value })}
                    >
                      <option value="">Select energy</option>
                      <option value="High">High</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Appetite</div>
                    <select
                      style={input}
                      value={logForm.appetite}
                      onChange={(e) => setLogForm({ ...logForm, appetite: e.target.value })}
                    >
                      <option value="">Select appetite</option>
                      <option value="Normal">Normal</option>
                      <option value="Reduced">Reduced</option>
                      <option value="Skipped">Skipped</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Health status</div>
                  <select
                    style={input}
                    value={logForm.health_status}
                    onChange={(e) => setLogForm({ ...logForm, health_status: e.target.value })}
                  >
                    <option value="">Select health status</option>
                    <option value="Normal">Normal</option>
                    <option value="Minor Issue">Minor Issue</option>
                    <option value="Needs Attention">Needs Attention</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Notes</div>
                  <textarea
                    style={{ ...input, minHeight: 90 }}
                    value={logForm.notes}
                    onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                    placeholder="Meals, walks, mood, medication, potty, playtime..."
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Photos</div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setLogPhotoFiles(Array.from(e.target.files || []))}
                  />

                  <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      type="button"
                      style={btn2}
                      disabled={!logPhotoFiles.length}
                      onClick={uploadLogPhotos}
                    >
                      Upload photos
                    </button>

                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {logPhotos.length ? `${logPhotos.length} uploaded` : "No uploaded photos"}
                    </div>
                  </div>

                  {logPhotos.length ? (
                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {logPhotos.map((p, idx) => (
                        <img
                          key={idx}
                          src={p.url}
                          alt=""
                          style={{
                            width: 100,
                            height: 100,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid #eee",
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    style={btn}
                    onClick={createDailyLog}
                    disabled={!selectedRequestId || !logForm.notes.trim()}
                  >
                    Add log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}