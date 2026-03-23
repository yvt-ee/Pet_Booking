// web/src/lib/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

async function jfetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Health
  health: () => jfetch("/health"),

  // Services / Requests
  services: () => jfetch("/services"),

  createRequest: (payload) =>
    jfetch("/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getRequest: (id) => jfetch(`/requests/${id}`),

  // Conversations / Chat
  getConversation: (id) => jfetch(`/conversations/${id}`),

  getMessages: (conversationId, limit = 50) =>
    jfetch(`/conversations/${conversationId}/messages?limit=${encodeURIComponent(limit)}`),

  sendMessage: (conversationId, sender, content, ownerToken = null) =>
    jfetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: ownerToken ? { "x-owner-token": ownerToken } : {},
      body: JSON.stringify({ sender, content }),
    }),

  requestMeet: (requestId, scheduled_at, location) =>
    jfetch(`/requests/${requestId}/meet-greet`, {
      method: "POST",
      body: JSON.stringify({ scheduled_at, location }),
    }),

  // Uploads (S3 presign)
  presignUpload: (kind, filename, content_type) =>
    jfetch("/uploads/presign", {
      method: "POST",
      body: JSON.stringify({ kind, filename, content_type }),
    }),

  // Profiles / Pets
  setClientAvatar: (clientId, url) =>
    jfetch(`/clients/${clientId}/avatar`, {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),

  setPetAvatar: (petId, url) =>
    jfetch(`/pets/${petId}/avatar`, {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),

  addPetPhoto: (petId, url, caption) =>
    jfetch(`/pets/${petId}/photos`, {
      method: "POST",
      body: JSON.stringify({ url, caption }),
    }),

  updateClientProfile: (name, phone) =>
    jfetch("/clients/me", {
      method: "PATCH",
      body: JSON.stringify({ name, phone }),
    }),

  createPetMe: (payload) =>
    jfetch("/pets/me", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updatePet: (petId, payload) =>
    jfetch(`/pets/${petId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Logs
  getLogs: (requestId) => jfetch(`/logs/request/${requestId}`),
  getRequestLogs: (requestId) => jfetch(`/logs/request/${requestId}`),

  upsertLog: (requestId, payload, ownerToken = null) =>
    jfetch(`/logs/request/${requestId}`, {
      method: "POST",
      headers: ownerToken ? { "x-owner-token": ownerToken } : {},
      body: JSON.stringify(payload),
    }),

  addLogPhoto: (logId, url, caption, ownerToken = null) =>
    jfetch(`/logs/${logId}/photos`, {
      method: "POST",
      headers: ownerToken ? { "x-owner-token": ownerToken } : {},
      body: JSON.stringify({ url, caption }),
    }),

  completeRequest: (requestId, ownerToken = null) =>
    jfetch(`/requests/${requestId}/complete`, {
      method: "POST",
      headers: ownerToken ? { "x-owner-token": ownerToken } : {},
    }),

  // Reviews
  submitReview: (requestId, client_email, rating, comment) =>
    jfetch(`/reviews/request/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ client_email, rating, comment }),
    }),

  getReview: (requestId) => jfetch(`/reviews/request/${requestId}`),

  // Client OTP Auth
  requestClientOtp: (email) =>
    jfetch("/auth/client/request-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyClientOtp: (email, code) =>
    jfetch("/auth/client/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  clientMe: () => jfetch("/auth/client/me"),

  clientLogout: () =>
    jfetch("/auth/client/logout", {
      method: "POST",
    }),

  // Owner Auth
  ownerLogin: (password) =>
    jfetch("/auth/owner/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  ownerLogout: () =>
    jfetch("/auth/owner/logout", {
      method: "POST",
    }),

  // Misc
  holidays: () => jfetch("/holidays"),

  // Payments
  createMeetGreetCheckout: (requestId) =>
    jfetch(`/payments/meet-greet/${requestId}/checkout`, {
      method: "POST",
    }),

  createBookingCheckout: (requestId) =>
    jfetch(`/payments/request/${requestId}/checkout`, {
      method: "POST",
    }),

  devPayMeetGreet: (requestId) =>
    jfetch(`/payments/meet-greet/${requestId}/dev-pay`, {
      method: "POST",
    }),

  devPayRequest: (requestId) =>
    jfetch(`/payments/request/${requestId}/dev-pay`, {
      method: "POST",
    }),
};

export async function putToS3(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`S3_UPLOAD_FAILED_${res.status}`);
  }
}