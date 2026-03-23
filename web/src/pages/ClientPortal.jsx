import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, putToS3 } from "../lib/api.js";

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

function statusLabel(status) {
  switch (status) {
    case "REQUESTED":
      return "Request sent";
    case "CONFIRMED":
      return "Confirmed";
    case "PAYMENT_PENDING":
      return "Waiting for payment";
    case "PAID":
      return "Paid";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "FAILED":
      return "Failed";
    case "EXPIRED":
      return "Expired";
    default:
      return status || "Unknown";
  }
}

function statusHint(r) {
  switch (r.status) {
    case "REQUESTED":
      return "Your request has been sent. Chat to confirm details.";
    case "CONFIRMED":
      return "Details confirmed. Payment may be needed next.";
    case "PAYMENT_PENDING":
      return "Payment is still pending for this request.";
    case "PAID":
      return "Payment received.";
    case "COMPLETED":
      return "This order has been completed.";
    case "CANCELLED":
      return "This request was cancelled.";
    case "FAILED":
      return "This request or payment failed.";
    case "EXPIRED":
      return "This request expired.";
    default:
      return "Status available in chat.";
  }
}

export default function ClientPortal() {
  const navigate = useNavigate();

  const [step, setStep] = useState("loading");
  const [email, setEmail] = useState(localStorage.getItem("clientEmail") || "");
  const [code, setCode] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [err, setErr] = useState("");

  const [data, setData] = useState(null);

  const [editPetId, setEditPetId] = useState("");
  const [petForm, setPetForm] = useState({});
  const [petAvatarFile, setPetAvatarFile] = useState(null);

  const refreshMe = useCallback(async () => {
    const out = await api.clientMe();
    setData(out);

    const first = out?.pets?.[0]?.id || "";

    setEditPetId((prev) => {
      if (prev && out?.pets?.some((p) => p.id === prev)) return prev;
      return first;
    });

    setStep("authed");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        setStep("email");
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (!data?.pets?.length) {
      setPetForm({});
      return;
    }

    const p = data.pets.find((x) => x.id === editPetId);
    if (p) setPetForm(p);
  }, [editPetId, data]);

  async function sendCode() {
    setErr("");
    setAuthMsg("");

    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setErr("Enter a valid email");
      return;
    }

    localStorage.setItem("clientEmail", e);

    try {
      await api.requestClientOtp(e);
      setAuthMsg("Code sent. Check your email (dev: see server logs).");
      setStep("code");
    } catch (ex) {
      setErr(ex.message || "Failed to send code");
    }
  }

  async function verifyCode() {
    setErr("");
    setAuthMsg("");

    const e = email.trim().toLowerCase();
    const c = code.trim();

    if (!/^\d{6}$/.test(c)) {
      setErr("Enter the 6-digit code");
      return;
    }

    try {
      await api.verifyClientOtp(e, c);
      await refreshMe();
      setAuthMsg("Logged in ✅");
    } catch (ex) {
      setErr(ex.message || "Failed to verify code");
    }
  }

  async function logout() {
    setErr("");
    setAuthMsg("");

    try {
      await api.clientLogout();
    } catch {}

    setData(null);
    setCode("");
    setPetForm({});
    setPetAvatarFile(null);
    setEditPetId("");
    setStep("email");
  }

  async function savePet() {
    setErr("");
    setAuthMsg("");

    if (!editPetId) return;

    try {
      await api.updatePet(editPetId, {
        name: petForm.name,
        pet_type: petForm.pet_type,
        breed: petForm.breed,
        age_years: petForm.age_years,
        weight_lbs: petForm.weight_lbs,
        energy_level: petForm.energy_level,
        microchipped: petForm.microchipped,
        spayed_neutered: petForm.spayed_neutered,
        veterinary_info: petForm.veterinary_info,
        pet_insurance: petForm.pet_insurance,
        notes: petForm.notes,
      });

      setAuthMsg("Saved ✅");
      await refreshMe();
    } catch (ex) {
      setErr(ex.message || "Failed to save pet");
    }
  }

  async function uploadPetAvatar() {
    if (!petAvatarFile || !editPetId) return;

    setErr("");
    setAuthMsg("");

    try {
      const pres = await api.presignUpload(
        "pet_avatar",
        petAvatarFile.name,
        petAvatarFile.type
      );

      await putToS3(pres.upload_url, petAvatarFile);
      await api.setPetAvatar(editPetId, pres.public_url);

      setPetAvatarFile(null);
      setAuthMsg("Avatar updated ✅");
      await refreshMe();
    } catch (ex) {
      setErr(ex.message || "Failed to upload avatar");
    }
  }

  const groupedRequests = useMemo(() => data?.requests || [], [data]);
  const selectedPet = useMemo(
    () => data?.pets?.find((p) => p.id === editPetId) || null,
    [data, editPetId]
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12 }}>
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Client portal</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Secure login via email one-time code (OTP).
            </div>
          </div>
          {step === "authed" ? (
            <button style={btn2} onClick={logout}>
              Logout
            </button>
          ) : null}
        </div>

        {err ? <div style={{ color: "#b00020", marginTop: 10 }}>{err}</div> : null}
        {authMsg ? <div style={{ color: "#0a7a2f", marginTop: 10 }}>{authMsg}</div> : null}

        {step === "loading" ? (
          <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div>
        ) : step === "email" ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ fontSize: 13 }}>
              <div style={{ marginBottom: 6, opacity: 0.75 }}>Email</div>
              <input
                style={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <button style={btn} onClick={sendCode}>
              Send code
            </button>

            <div style={{ fontSize: 12, opacity: 0.65 }}>
              Dev tip: code is printed in server logs.
            </div>
          </div>
        ) : step === "code" ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Email: <b>{email.trim().toLowerCase()}</b>
            </div>

            <label style={{ fontSize: 13 }}>
              <div style={{ marginBottom: 6, opacity: 0.75 }}>6-digit code</div>
              <input
                style={input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btn} onClick={verifyCode}>
                Verify & login
              </button>

              <button style={btn2} onClick={sendCode}>
                Resend
              </button>

              <button
                style={btn2}
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
            <div>
              <b>{data?.client?.name || "Client"}</b>
            </div>
            <div>{data?.client?.email}</div>

            <div style={{ marginTop: 8, opacity: 0.7 }}>
              You can edit pet details, view request history, order status, and reopen
              past conversations below.
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                style={btn}
                onClick={() => {
                  localStorage.removeItem("ownerToken");
                  navigate("/book");
                }}
              >
                New booking request
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>My pets</div>

          {step !== "authed" ? (
            <div style={{ opacity: 0.7 }}>Login to manage pets.</div>
          ) : !data?.pets?.length ? (
            <div style={{ opacity: 0.7 }}>No pets found.</div>
          ) : (
            <>
              <select
                style={input}
                value={editPetId}
                onChange={(e) => setEditPetId(e.target.value)}
              >
                {data.pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.pet_type})
                  </option>
                ))}
              </select>

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6, opacity: 0.75 }}>Name</div>
                  <input
                    style={input}
                    value={petForm.name || ""}
                    onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                  />
                </label>

                <label style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6, opacity: 0.75 }}>Type</div>
                  <select
                    style={input}
                    value={petForm.pet_type || "DOG"}
                    onChange={(e) => setPetForm({ ...petForm, pet_type: e.target.value })}
                  >
                    <option value="DOG">DOG</option>
                    <option value="CAT">CAT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>

                <label style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6, opacity: 0.75 }}>Energy</div>
                  <select
                    style={input}
                    value={petForm.energy_level || "Moderate"}
                    onChange={(e) =>
                      setPetForm({ ...petForm, energy_level: e.target.value })
                    }
                  >
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6, opacity: 0.75 }}>Breed</div>
                  <input
                    style={input}
                    value={petForm.breed || ""}
                    onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6, opacity: 0.75 }}>Notes</div>
                  <textarea
                    style={{ ...input, minHeight: 70 }}
                    value={petForm.notes || ""}
                    onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <button style={btn2} onClick={savePet}>
                  Save changes
                </button>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Saved via <code>api.updatePet(...)</code>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee" }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Pet avatar</div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPetAvatarFile(e.target.files?.[0] || null)}
                />

                <div style={{ marginTop: 8 }}>
                  <button style={btn2} onClick={uploadPetAvatar} disabled={!petAvatarFile}>
                    Upload avatar
                  </button>
                </div>

                {selectedPet?.avatar_url ? (
                  <img
                    alt={selectedPet.name || "Pet avatar"}
                    src={selectedPet.avatar_url}
                    style={{
                      marginTop: 10,
                      width: 120,
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 16,
                      border: "1px solid #eee",
                    }}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
            Past conversations
          </div>

          {step !== "authed" ? (
            <div style={{ opacity: 0.7 }}>Login to view request history.</div>
          ) : !groupedRequests.length ? (
            <div style={{ opacity: 0.7 }}>No requests found.</div>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              {groupedRequests.map((r) => (
                <HistoryRow
                  key={r.id}
                  r={r}
                  onOpenChat={(conversationId) => {
                    localStorage.removeItem("ownerToken");
                    navigate(`/chat/${conversationId}`, { state: { role: "CLIENT" } });
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            You can reopen previous chats here to review details, payments, and meet &
            greet status.
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Order status</div>

          {step !== "authed" ? (
            <div style={{ opacity: 0.7 }}>Login to view orders.</div>
          ) : !groupedRequests.length ? (
            <div style={{ opacity: 0.7 }}>No orders found.</div>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              {groupedRequests.map((r) => (
                <OrderStatusRow key={`status-${r.id}`} r={r} />
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            This shows the latest order/request progress for each booking.
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderStatusRow({ r }) {
  return (
    <div style={{ padding: "12px", borderBottom: "1px solid #f0f0f0", display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>{r.service_type || "Service"}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}
          </div>
        </div>

        <span
          style={{
            fontSize: 12,
            border: "1px solid #ddd",
            borderRadius: 999,
            padding: "2px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel(r.status)}
        </span>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>{statusHint(r)}</div>

      <div style={{ fontSize: 12, opacity: 0.65 }}>Request ID: {r.id}</div>
    </div>
  );
}

function HistoryRow({ r, onOpenChat }) {
  const hasChat = Boolean(r.conversation_id);

  return (
    <div style={{ padding: "12px", borderBottom: "1px solid #f0f0f0", display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>{r.service_type || "Service"}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}
          </div>
        </div>

        <span
          style={{
            fontSize: 12,
            border: "1px solid #ddd",
            borderRadius: 999,
            padding: "2px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {r.status}
        </span>
      </div>

      {r.notes ? (
        <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>{r.notes}</div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.65 }}>Request ID: {r.id}</div>

        {hasChat ? (
          <button style={btn2} onClick={() => onOpenChat(r.conversation_id)}>
            Open chat
          </button>
        ) : (
          <button style={{ ...btn2, opacity: 0.5, cursor: "not-allowed" }} disabled>
            No chat yet
          </button>
        )}
      </div>
    </div>
  );
}