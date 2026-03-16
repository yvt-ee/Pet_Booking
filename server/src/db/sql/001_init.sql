-- server/src/db/sql/001_init.sql
-- Solo-sitter Pet Booking Platform
-- Flow: choose service -> create request -> chat -> optionally create meet in chat
-- No time_holds

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);

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

CREATE INDEX IF NOT EXISTS idx_client_otps_email_created ON client_login_otps (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_otps_expires ON client_login_otps (expires_at);

CREATE TABLE IF NOT EXISTS client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON client_sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_expires ON client_sessions (expires_at);

CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('DOG','CAT','OTHER')),
  breed TEXT,
  age_years NUMERIC(4,1),
  weight_lbs NUMERIC(6,2),
  energy_level TEXT CHECK (energy_level IN ('High','Moderate','Low')),
  microchipped BOOLEAN,
  spayed_neutered BOOLEAN,
  veterinary_info TEXT,
  pet_insurance TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pets_client_id ON pets (client_id);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN (
    'Boarding','House Sitting','Drop-In Visits','Day Care','Walking'
  )),
  base_rate_per_day NUMERIC(10,2) NOT NULL CHECK (base_rate_per_day >= 0),
  cat_rate_per_day NUMERIC(10,2)
    GENERATED ALWAYS AS (ROUND(base_rate_per_day * 0.8, 2)) STORED,
  holiday_rate_per_day NUMERIC(10,2)
    GENERATED ALWAYS AS (ROUND(base_rate_per_day * 1.2, 2)) STORED,
  additional_dog_rate_per_day NUMERIC(10,2)
    GENERATED ALWAYS AS (ROUND(base_rate_per_day * 0.8, 2)) STORED,
  additional_cat_rate_per_day NUMERIC(10,2)
    GENERATED ALWAYS AS (ROUND((base_rate_per_day * 0.8) * 0.8, 2)) STORED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);


CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at   TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL,
  CONSTRAINT requests_status_check CHECK (status IN (
'REQUESTED','CONFIRMED','PAYMENT_PENDING','PAID','CANCELLED','EXPIRED','FAILED'
  )),
  meet_requested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_request_time CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_requests_time ON requests (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_client_id ON requests (client_id);
CREATE INDEX IF NOT EXISTS idx_requests_pet_id ON requests (pet_id);
CREATE INDEX IF NOT EXISTS idx_requests_service_id ON requests (service_id);

CREATE OR REPLACE FUNCTION enforce_pet_belongs_to_client()
RETURNS TRIGGER AS $$
DECLARE
  pet_owner UUID;
BEGIN
  SELECT p.client_id INTO pet_owner FROM pets p WHERE p.id = NEW.pet_id;
  IF pet_owner IS NULL THEN
    RAISE EXCEPTION 'pet_id % does not exist', NEW.pet_id;
  END IF;
  IF pet_owner <> NEW.client_id THEN
    RAISE EXCEPTION 'pet_id % does not belong to client_id %', NEW.pet_id, NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_pet_belongs_to_client ON requests;
CREATE TRIGGER trg_enforce_pet_belongs_to_client
BEFORE INSERT OR UPDATE OF client_id, pet_id ON requests
FOR EACH ROW
EXECUTE FUNCTION enforce_pet_belongs_to_client();

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('CLIENT','OWNER')),
  content TEXT NOT NULL CHECK (length(content) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_convo_time ON messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meet_greets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  price_cents INT NOT NULL DEFAULT 1500 CHECK (price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED','PAYMENT_PENDING','PAID','COMPLETED','CANCELLED','FAILED'
  )),
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meet_status ON meet_greets (status);

CREATE OR REPLACE FUNCTION mark_request_meet_requested()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE requests SET meet_requested = TRUE WHERE id = NEW.request_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_request_meet_requested ON meet_greets;
CREATE TRIGGER trg_mark_request_meet_requested
AFTER INSERT ON meet_greets
FOR EACH ROW
EXECUTE FUNCTION mark_request_meet_requested();

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('MEET_GREET','REQUEST')),
  entity_id UUID NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('INITIATED','SUCCEEDED','FAILED')),
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
