-- server/src/db/sql/010_auth.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- OTP records (store hash only)
CREATE TABLE IF NOT EXISTS client_login_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_otps_email_created
  ON client_login_otps (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_otps_expires
  ON client_login_otps (expires_at);

-- Client sessions (cookie token hash)
CREATE TABLE IF NOT EXISTS client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_client
  ON client_sessions (client_id);

CREATE INDEX IF NOT EXISTS idx_client_sessions_expires
  ON client_sessions (expires_at);

-- Owner sessions
CREATE TABLE IF NOT EXISTS owner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_owner_sessions_expires
  ON owner_sessions (expires_at);