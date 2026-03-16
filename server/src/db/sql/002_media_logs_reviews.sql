-- Adds avatars/photos, daily logs, and reviews

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS pet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON pet_photos(pet_id);

-- Expand requests.status to include COMPLETED
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests
  ADD CONSTRAINT requests_status_check CHECK (status IN (
    'REQUESTED','CONFIRMED','PAYMENT_PENDING','PAID','COMPLETED','CANCELLED','EXPIRED','FAILED'
  ));

CREATE TABLE IF NOT EXISTS request_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  mood TEXT CHECK (mood IN ('Excellent','Good','Okay','Low')),
  energy_level TEXT CHECK (energy_level IN ('High','Moderate','Low')),
  appetite TEXT CHECK (appetite IN ('Normal','Reduced','Skipped')),
  health_status TEXT CHECK (health_status IN ('Normal','Minor Issue','Needs Attention')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_request_logs_req_date ON request_daily_logs(request_id, log_date DESC);

CREATE TABLE IF NOT EXISTS request_log_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES request_daily_logs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_log_photos_log_id ON request_log_photos(log_id);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
