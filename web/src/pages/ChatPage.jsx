import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";

const page = {
  display: "grid",
  gap: 12,
};

const card = {
  background: "#fff",
  border: "1px solid #eaeaea",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
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

const btnGreen = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #0a7a2f",
  background: "#0a7a2f",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

function Field({ label, children }) {
  return (
    <label style={{ display: "block", fontSize: 13 }}>
      <div style={{ marginBottom: 6, opacity: 0.75 }}>{label}</div>
      {children}
    </label>
  );
}

function fmtMoney(n) {
  const x = Number(n || 0);
  return `$${x.toFixed(2)}`;
}

function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [requestDetail, setRequestDetail] = useState(null);
  const [text, setText] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [meetLoc, setMeetLoc] = useState("Seattle");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [payingMeet, setPayingMeet] = useState(false);
  const [payingBooking, setPayingBooking] = useState(false);

  const listRef = useRef(null);

  const request = requestDetail?.request || null;
  const client = requestDetail?.client || null;
  const pets = requestDetail?.pets || [];
  const service = requestDetail?.service || null;
  const meetGreet = requestDetail?.meet_greet || null;

  const canRequestMeet = useMemo(() => {
    return Boolean(request?.id) && !meetGreet;
  }, [request, meetGreet]);

  const showMeetPayButton = useMemo(() => {
    if (!meetGreet) return false;
    return !["PAID", "COMPLETED"].includes(meetGreet.status);
  }, [meetGreet]);

  const showConfirmPayButton = useMemo(() => {
    if (!request) return false;
    return ["REQUESTED", "CONFIRMED", "PAYMENT_PENDING"].includes(request.status);
  }, [request]);

  async function loadThread() {
    setErr("");

    try {
      const convRes = await api.getConversation(conversationId);
      const requestId = convRes?.conversation?.request_id || null;

      const msgRes = await api.getMessages(conversationId, 100);
      const items = (msgRes.items || []).slice().reverse();
      setMessages(items);

      if (requestId) {
        const detail = await api.getRequest(requestId);
        setRequestDetail(detail);
      } else {
        setRequestDetail(null);
      }
    } catch (e) {
      setErr(e.message || "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function firstLoad() {
      if (!conversationId) return;
      await loadThread();
    }

    firstLoad();

    const t = setInterval(async () => {
      if (!alive || !conversationId) return;
      try {
        const msgRes = await api.getMessages(conversationId, 100);
        const items = (msgRes.items || []).slice().reverse();
        if (alive) setMessages(items);
      } catch {
        // ignore polling errors
      }
    }, 2500);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    if (!text.trim()) return;
    setErr("");
    setOk("");
    setSending(true);

    try {
      await api.sendMessage(conversationId, "CLIENT", text.trim());
      setText("");
      await loadThread();
    } catch (e) {
      setErr(e.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function requestMeet() {
    if (!request?.id) return;
    if (!meetAt) {
      setErr("Please choose a meet & greet time.");
      return;
    }

    setErr("");
    setOk("");

    try {
      await api.requestMeet(request.id, new Date(meetAt).toISOString(), meetLoc || "Seattle");
      setOk("Meet & greet requested ✅");
      await loadThread();
    } catch (e) {
      setErr(e.message || "Failed to request meet & greet");
    }
  }

  async function payMeetGreet() {
    if (!request?.id) return;

    setErr("");
    setOk("");
    setPayingMeet(true);

    try {
      await api.devPayMeetGreet(request.id);
      setOk("Meet & greet marked as paid ✅");
      await loadThread();
    } catch (e) {
      setErr(e.message || "Failed to pay meet & greet");
    } finally {
      setPayingMeet(false);
    }
  }

  async function confirmAndPayBooking() {
    if (!request?.id) return;

    setErr("");
    setOk("");
    setPayingBooking(true);

    try {
      await api.devPayRequest(request.id);
      setOk("Booking marked as paid ✅");
      await loadThread();
    } catch (e) {
      setErr(e.message || "Failed to pay booking");
    } finally {
      setPayingBooking(false);
    }
  }

  if (loading) {
    return <div style={card}>Loading chat…</div>;
  }

  return (
    <div style={page}>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn2} onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {err ? <div style={{ ...card, color: "#b00020" }}>{err}</div> : null}
      {ok ? <div style={{ ...card, color: "#0a7a2f" }}>{ok}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Request summary</div>

            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>
                <b>Status:</b> {request?.status || "—"}
              </div>
              <div>
                <b>Service:</b> {service?.service_type || "—"}
              </div>
              <div>
                <b>Client:</b> {client?.name || "—"}
              </div>
              <div>
                <b>Email:</b> {client?.email || "—"}
              </div>
              <div>
                <b>Phone:</b> {client?.phone || "—"}
              </div>
              <div>
                <b>Start:</b> {fmtDateTime(request?.start_at)}
              </div>
              <div>
                <b>End:</b> {fmtDateTime(request?.end_at)}
              </div>
              <div>
                <b>Estimated total:</b>{" "}
                {request?.quoted_total != null ? fmtMoney(request.quoted_total) : "Pending review"}
              </div>
            </div>

            {request?.notes ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Client notes</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", opacity: 0.9 }}>
                  {request.notes}
                </div>
              </div>
            ) : null}

            {showConfirmPayButton ? (
              <div style={{ marginTop: 14 }}>
                <button
                  style={btnGreen}
                  onClick={confirmAndPayBooking}
                  disabled={payingBooking}
                >
                  {payingBooking ? "Redirecting..." : "Confirm & Pay"}
                </button>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Use this after chat confirms the final booking details.
                </div>
              </div>
            ) : null}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Pets in this request</div>

            {pets.length ? (
              <div style={{ display: "grid", gap: 10 }}>
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
                      <div>Age: {p.age_years ?? "—"} years</div>
                      <div>Weight: {p.weight_lbs ?? "—"} lbs</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No pets found for this request.</div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Meet & greet</div>

            {meetGreet ? (
              <>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <div>
                    <b>Status:</b> {meetGreet.status}
                  </div>
                  <div>
                    <b>When:</b> {fmtDateTime(meetGreet.scheduled_at)}
                  </div>
                  <div>
                    <b>Location:</b> {meetGreet.location || "—"}
                  </div>
                  <div>
                    <b>Fee:</b> {meetGreet?.price_cents != null
                    ? `$${(Number(meetGreet.price_cents) / 100).toFixed(2)}`
                    : "$15.00"}
                  </div>
                </div>

                {showMeetPayButton ? (
                  <div style={{ marginTop: 14 }}>
                    <button
                      style={btnGreen}
                      onClick={payMeetGreet}
                      disabled={payingMeet}
                    >
                      {payingMeet ? "Redirecting..." : "Pay Meet & Greet ($15)"}
                    </button>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                      Meet & greet has its own separate payment.
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
                  Need to meet first? Send a meet & greet request here.
                </div>

                <Field label="Meet time">
                  <input
                    style={input}
                    type="datetime-local"
                    value={meetAt}
                    onChange={(e) => setMeetAt(e.target.value)}
                  />
                </Field>

                <div style={{ height: 10 }} />

                <Field label="Location">
                  <input
                    style={input}
                    value={meetLoc}
                    onChange={(e) => setMeetLoc(e.target.value)}
                    placeholder="Seattle"
                  />
                </Field>

                <div style={{ marginTop: 12 }}>
                  <button
                    style={btn2}
                    onClick={requestMeet}
                    disabled={!canRequestMeet}
                  >
                    Request meet & greet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Chat</div>

          <div
            ref={listRef}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              minHeight: 420,
              maxHeight: 520,
              overflow: "auto",
              background: "#fafafa",
              display: "grid",
              gap: 10,
            }}
          >
            {messages.length ? (
              messages.map((m) => {
                const mine = m.sender === "CLIENT";
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
                        maxWidth: "72%",
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
            ) : (
              <div style={{ opacity: 0.7 }}>No messages yet. Start the conversation below.</div>
            )}
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: "grid", gap: 10 }}>
            <textarea
              style={{ ...input, minHeight: 100, resize: "vertical" }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question, confirm details, or say hello..."
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                style={btn}
                onClick={sendMessage}
                disabled={sending || !text.trim()}
              >
                {sending ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            This is still a request stage. Final booking is only confirmed after review,
            approval, and payment.
          </div>
        </div>
      </div>
    </div>
  );
}