// web/src/pages/RequestFlow.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, putToS3 } from "../lib/api.js";

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

function Field({ label, children }) {
  return (
    <label style={{ display: "block", fontSize: 13 }}>
      <div style={{ marginBottom: 6, opacity: 0.75 }}>{label}</div>
      {children}
    </label>
  );
}

function toIso(dtLocal) {
  if (!dtLocal) return "";
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function ymdLocal(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addHours(date, h) {
  return new Date(date.getTime() + h * 3600 * 1000);
}

// <24h => 1 day
// >=24h => full days + (0..12h => +0.5, >12h => +1)
function computeDayUnits(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const hours = ms / 3600e3;

  if (hours < 24) {
    return {
      hours: round2(hours),
      fullDays: 0,
      extraHours: round2(hours),
      dayUnits: 1,
      extraUnits: 1,
    };
  }

  const fullDays = Math.floor(hours / 24);
  const extraHours = hours - fullDays * 24;

  let extraUnits = 0;
  if (extraHours === 0) extraUnits = 0;
  else if (extraHours <= 12) extraUnits = 0.5;
  else extraUnits = 1;

  return {
    hours: round2(hours),
    fullDays,
    extraHours: round2(extraHours),
    dayUnits: fullDays + extraUnits,
    extraUnits,
  };
}

// if a billing unit touches a holiday date, count that unit as holiday
function computeHolidayUnits(startAt, unitsMeta, holidayDates) {
  const start = new Date(startAt);
  let holidayUnits = 0;

  function touchesHoliday(unitStart, unitEnd) {
    const startKey = ymdLocal(unitStart);
    const endKey = ymdLocal(new Date(unitEnd.getTime() - 1));
    return holidayDates.has(startKey) || holidayDates.has(endKey);
  }

  for (let i = 0; i < unitsMeta.fullDays; i++) {
    const unitStart = addHours(start, i * 24);
    const unitEnd = addHours(unitStart, 24);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  }

  if (unitsMeta.fullDays === 0 && unitsMeta.dayUnits === 1) {
    const unitStart = start;
    const unitEnd = addHours(start, Math.min(unitsMeta.hours, 24));
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  } else if (unitsMeta.extraUnits === 0.5) {
    const unitStart = addHours(start, unitsMeta.fullDays * 24);
    const unitEnd = addHours(unitStart, 12);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 0.5;
  } else if (unitsMeta.extraUnits === 1) {
    const unitStart = addHours(start, unitsMeta.fullDays * 24);
    const unitEnd = addHours(unitStart, 24);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  }

  return holidayUnits;
}

function buildQuote(service, selectedPets, startAt, endAt, holidayDates) {
  if (!service || !selectedPets.length || !startAt || !endAt) return null;

  const unitsMeta = computeDayUnits(startAt, endAt);
  if (!unitsMeta) return null;

  const holidayUnits = computeHolidayUnits(startAt, unitsMeta, holidayDates);
  const normalUnits = round2(unitsMeta.dayUnits - holidayUnits);

  const base = Number(service.base_rate_per_day || 0);
  const holiday = Number(service.holiday_rate_per_day || base * 1.2);
  const catRate = Number(service.cat_rate_per_day || base * 0.8);
  const addDog = Number(service.additional_dog_rate_per_day || base * 0.8);
  const addCat = Number(service.additional_cat_rate_per_day || catRate * 0.8);

  let total = 0;
  let firstDogNormal = 0;
  let firstDogHoliday = 0;
  let firstCat = 0;
  let additionalDogs = 0;
  let additionalCats = 0;

  selectedPets.forEach((pet, idx) => {
    const type = pet.pet_type;

    if (idx === 0) {
      if (type === "DOG") {
        firstDogNormal = round2(normalUnits * base);
        firstDogHoliday = round2(holidayUnits * holiday);
        total += firstDogNormal + firstDogHoliday;
      } else if (type === "CAT") {
        firstCat = round2(unitsMeta.dayUnits * catRate);
        total += firstCat;
      } else {
        const otherCost = round2(normalUnits * base + holidayUnits * holiday);
        firstDogNormal = round2(normalUnits * base);
        firstDogHoliday = round2(holidayUnits * holiday);
        total += otherCost;
      }
      return;
    }

    if (type === "DOG") {
      const cost = round2(unitsMeta.dayUnits * addDog);
      additionalDogs += cost;
      total += cost;
    } else if (type === "CAT") {
      const cost = round2(unitsMeta.dayUnits * addCat);
      additionalCats += cost;
      total += cost;
    } else {
      const cost = round2(unitsMeta.dayUnits * addDog);
      additionalDogs += cost;
      total += cost;
    }
  });

  return {
    duration: unitsMeta,
    units: {
      holidayUnits,
      normalUnits,
    },
    breakdown: {
      firstDogNormal: round2(firstDogNormal),
      firstDogHoliday: round2(firstDogHoliday),
      firstCat: round2(firstCat),
      additionalDogs: round2(additionalDogs),
      additionalCats: round2(additionalCats),
      total: round2(total),
    },
  };
}

export default function RequestFlow() {
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [holidayDates, setHolidayDates] = useState(new Set());

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [selectedPetIds, setSelectedPetIds] = useState([]);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [notes, setNotes] = useState("");

  const [showAddPet, setShowAddPet] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "",
    pet_type: "DOG",
    breed: "",
    age_years: "",
    weight_lbs: "",
    energy_level: "Moderate",
    microchipped: false,
    spayed_neutered: false,
    veterinary_info: "",
    pet_insurance: "",
    notes: "",
  });
  const [petPhotoFile, setPetPhotoFile] = useState(null);
  const [petAvatarUrl, setPetAvatarUrl] = useState("");
  const [petUploadMsg, setPetUploadMsg] = useState("");

  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.services()
      .then((r) => setServices(r.services || []))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    api.holidays?.()
      .then((r) => {
        const dates = new Set(
          (r.holidays || []).map((h) => String(h.holiday_date).slice(0, 10))
        );
        setHolidayDates(dates);
      })
      .catch(() => {
        setHolidayDates(new Set());
      });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const out = await api.clientMe();
        setMe(out);
        setEmail(out?.client?.email || "");
        setName(
          out?.client?.name && out.client.name !== "New Client" ? out.client.name : ""
        );
        setPhone(
          out?.client?.phone?.startsWith("tmp_") ? "" : out?.client?.phone || ""
        );
        setLoadingMe(false);
      } catch (e) {
        navigate("/portal", { replace: true });
      }
    })();
  }, [navigate]);

  const pets = me?.pets || [];

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );

  const selectedPets = useMemo(
    () => pets.filter((p) => selectedPetIds.includes(p.id)),
    [pets, selectedPetIds]
  );

  const quote = useMemo(
    () => buildQuote(selectedService, selectedPets, startLocal, endLocal, holidayDates),
    [selectedService, selectedPets, startLocal, endLocal, holidayDates]
  );

  const needsProfile = useMemo(() => {
    return !email || !name.trim() || !phone.trim();
  }, [email, name, phone]);

  const serviceOptions = useMemo(
    () =>
      (services || []).map((s) => ({
        id: s.id,
        label: `${s.service_type} ($${s.base_rate_per_day}/day)`,
      })),
    [services]
  );

  function togglePet(id) {
    setSelectedPetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function refreshMe() {
    const out = await api.clientMe();
    setMe(out);
    setEmail(out?.client?.email || "");
    setName(
      out?.client?.name && out.client.name !== "New Client" ? out.client.name : ""
    );
    setPhone(
      out?.client?.phone?.startsWith("tmp_") ? "" : out?.client?.phone || ""
    );
    return out;
  }

  async function saveProfile() {
    setErr("");
    setOk("");
    try {
      await api.updateClientProfile(name.trim(), phone.trim());
      await refreshMe();
      setOk("Profile updated ✅");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function savePetProfile() {
    setErr("");
    setOk("");

    const required = [
      "name",
      "breed",
      "age_years",
      "weight_lbs",
      "energy_level",
      "veterinary_info",
      "pet_insurance",
      "notes",
    ];

    for (const k of required) {
      if (!String(petForm[k] ?? "").trim()) {
        setErr(`Pet ${k} is required`);
        return;
      }
    }

    if (!petAvatarUrl) {
      setErr("Pet photo is required. Please upload a recent photo.");
      return;
    }

    try {
      await api.createPetMe({
        ...petForm,
        age_years: Number(petForm.age_years),
        weight_lbs: Number(petForm.weight_lbs),
        avatar_url: petAvatarUrl,
      });

      await refreshMe();

      setShowAddPet(false);
      setPetForm({
        name: "",
        pet_type: "DOG",
        breed: "",
        age_years: "",
        weight_lbs: "",
        energy_level: "Moderate",
        microchipped: false,
        spayed_neutered: false,
        veterinary_info: "",
        pet_insurance: "",
        notes: "",
      });
      setPetPhotoFile(null);
      setPetAvatarUrl("");
      setPetUploadMsg("");
      setOk("Pet added ✅");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function createBooking() {
    setErr("");
    setOk("");

    if (!email) {
      setErr("Please login in Client Portal first.");
      return;
    }
    if (needsProfile) {
      setErr("Please complete your profile (name + phone) first.");
      return;
    }
    if (!serviceId) {
      setErr("Please select a service.");
      return;
    }
    if (!selectedPetIds.length) {
      setErr("Please select at least one pet.");
      return;
    }

    const start_at = toIso(startLocal);
    const end_at = toIso(endLocal);

    if (!start_at || !end_at) {
      setErr("Please select start and end time.");
      return;
    }
    if (new Date(end_at) <= new Date(start_at)) {
      setErr("End time must be after start time.");
      return;
    }

    try {
      const out = await api.createRequest({
        service_id: serviceId,
        start_at,
        end_at,
        notes,
        pet_ids: selectedPetIds,
      });

      setCreated(out);
      setOk("Request sent ✅ Opening chat...");

      if (out?.conversation_id) {
        navigate(`/chat/${out.conversation_id}`);
      }
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loadingMe) {
    return <div style={card}>Loading…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>Your profile</div>

        {err ? <div style={{ color: "#b00020", marginBottom: 10 }}>{err}</div> : null}
        {ok ? <div style={{ color: "#0a7a2f", marginBottom: 10 }}>{ok}</div> : null}

        {!email ? (
          <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.8 }}>
            You are not logged in. Please log in from Client Portal first.
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Email (from login)">
            <input style={{ ...input, background: "#f7f7f7" }} value={email} readOnly />
          </Field>
          <Field label="Name">
            <input
              style={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Phone">
            <input
              style={input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(206) xxx-xxxx"
            />
          </Field>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            style={btn2}
            onClick={saveProfile}
            disabled={!email || !name.trim() || !phone.trim()}
          >
            Save profile
          </button>
          {needsProfile ? (
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              Please fill name + phone before sending a request.
            </span>
          ) : null}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>Send booking request</div>

        <Field label="Service">
          <select style={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Select a service…</option>
            {serviceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ height: 10 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Pets</div>
          <button
            style={btn2}
            onClick={() => setShowAddPet((v) => !v)}
            disabled={!email}
          >
            + Add pet
          </button>
        </div>

        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {pets.length ? (
            pets.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPetIds.includes(p.id)}
                  onChange={() => togglePet(p.id)}
                />
                <div style={{ fontWeight: 800 }}>{p.name}</div>
              </label>
            ))
          ) : (
            <div style={{ opacity: 0.7 }}>
              {email ? "No pets yet. Add a pet profile first." : "Log in first to view or add pets."}
            </div>
          )}
        </div>

        {showAddPet ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              New pet profile (all fields required)
            </div>

            <div style={{ marginBottom: 10 }}>
              <Field label="Pet recent photo (required)">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPetPhotoFile(e.target.files?.[0] || null)}
                />
              </Field>
              <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  style={btn2}
                  disabled={!petPhotoFile || !email}
                  onClick={async () => {
                    setErr("");
                    setOk("");
                    setPetUploadMsg("");
                    try {
                      const pres = await api.presignUpload(
                        "pet_avatar",
                        petPhotoFile.name,
                        petPhotoFile.type
                      );
                      await putToS3(pres.upload_url, petPhotoFile);
                      setPetAvatarUrl(pres.public_url);
                      setPetUploadMsg("Photo uploaded ✅");
                    } catch (e) {
                      setPetUploadMsg(e.message);
                    }
                  }}
                >
                  Upload photo
                </button>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{petUploadMsg}</div>
              </div>

              {petAvatarUrl ? (
                <img
                  alt=""
                  src={petAvatarUrl}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Pet name">
                <input
                  style={input}
                  value={petForm.name}
                  onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                />
              </Field>

              <Field label="Pet type">
                <select
                  style={input}
                  value={petForm.pet_type}
                  onChange={(e) => setPetForm({ ...petForm, pet_type: e.target.value })}
                >
                  <option value="DOG">DOG</option>
                  <option value="CAT">CAT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </Field>

              <Field label="Breed">
                <input
                  style={input}
                  value={petForm.breed}
                  onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                />
              </Field>

              <Field label="Energy level">
                <select
                  style={input}
                  value={petForm.energy_level}
                  onChange={(e) => setPetForm({ ...petForm, energy_level: e.target.value })}
                >
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                </select>
              </Field>

              <Field label="Age (years)">
                <input
                  style={input}
                  type="number"
                  step="0.1"
                  value={petForm.age_years}
                  onChange={(e) => setPetForm({ ...petForm, age_years: e.target.value })}
                />
              </Field>

              <Field label="Weight (lbs)">
                <input
                  style={input}
                  type="number"
                  step="0.1"
                  value={petForm.weight_lbs}
                  onChange={(e) => setPetForm({ ...petForm, weight_lbs: e.target.value })}
                />
              </Field>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={petForm.microchipped}
                  onChange={(e) =>
                    setPetForm({ ...petForm, microchipped: e.target.checked })
                  }
                />
                <span style={{ fontSize: 13 }}>Microchipped</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={petForm.spayed_neutered}
                  onChange={(e) =>
                    setPetForm({ ...petForm, spayed_neutered: e.target.checked })
                  }
                />
                <span style={{ fontSize: 13 }}>Spayed / Neutered</span>
              </label>
            </div>

            <div style={{ marginTop: 10 }}>
              <Field label="Veterinary info (clinic + vet + emergency contact)">
                <textarea
                  style={{ ...input, minHeight: 70 }}
                  value={petForm.veterinary_info}
                  onChange={(e) =>
                    setPetForm({ ...petForm, veterinary_info: e.target.value })
                  }
                />
              </Field>
            </div>

            <div style={{ marginTop: 10 }}>
              <Field label="Pet insurance">
                <input
                  style={input}
                  value={petForm.pet_insurance}
                  onChange={(e) =>
                    setPetForm({ ...petForm, pet_insurance: e.target.value })
                  }
                />
              </Field>
            </div>

            <div style={{ marginTop: 10 }}>
              <Field label="Notes (feeding, meds, behavior, routines)">
                <textarea
                  style={{ ...input, minHeight: 90 }}
                  value={petForm.notes}
                  onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })}
                />
              </Field>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button style={btn2} onClick={savePetProfile} disabled={!email}>
                Save pet
              </button>

              <button
                style={btn2}
                onClick={() => {
                  setShowAddPet(false);
                  setPetPhotoFile(null);
                  setPetAvatarUrl("");
                  setPetUploadMsg("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Start">
            <input
              style={input}
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </Field>
          <Field label="End">
            <input
              style={input}
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </Field>
        </div>

        {quote ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Estimated price</div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>
                Total billable units: <b>{quote.duration.dayUnits}</b>
              </div>
              <div>
                Holiday units: <b>{quote.units.holidayUnits}</b>
              </div>
              <div>
                Normal units: <b>{quote.units.normalUnits}</b>
              </div>
              <div>First dog (normal): ${quote.breakdown.firstDogNormal.toFixed(2)}</div>
              <div>First dog (holiday): ${quote.breakdown.firstDogHoliday.toFixed(2)}</div>
              <div>Additional dogs: ${quote.breakdown.additionalDogs.toFixed(2)}</div>
              <div>First cat: ${quote.breakdown.firstCat.toFixed(2)}</div>
              <div>Additional cats: ${quote.breakdown.additionalCats.toFixed(2)}</div>
              <div style={{ marginTop: 6, fontSize: 16 }}>
                Estimated total: <b>${quote.breakdown.total.toFixed(2)}</b>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              This sends a request first and opens chat. Final booking is only confirmed
              after details are reviewed and accepted.
            </div>
          </div>
        ) : null}

        <div style={{ height: 10 }} />
        <Field label="Notes (optional)">
          <textarea
            style={{ ...input, minHeight: 80 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Submit your request first, then chat to confirm details before payment.
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            style={btn}
            onClick={createBooking}
            disabled={
              !email ||
              needsProfile ||
              !serviceId ||
              !selectedPetIds.length ||
              !startLocal ||
              !endLocal
            }
          >
            Send request & open chat
          </button>
        </div>

        {created ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
            <div>
              Request sent ✅ Chat is now open. Final booking is only confirmed after
              review and approval.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}