-- 003_request_multi_pets.sql
-- Allow a request to include multiple pets

-- 0) Drop old trigger/function that still depend on requests.pet_id
DROP TRIGGER IF EXISTS trg_enforce_pet_belongs_to_client ON requests;
DROP FUNCTION IF EXISTS enforce_pet_belongs_to_client();

-- 1) Join table: request_pets
CREATE TABLE IF NOT EXISTS request_pets (
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_request_pets_request ON request_pets(request_id);
CREATE INDEX IF NOT EXISTS idx_request_pets_pet ON request_pets(pet_id);

-- 2) Backfill existing single-pet requests into request_pets
INSERT INTO request_pets(request_id, pet_id)
SELECT id, pet_id
FROM requests
WHERE pet_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Remove old single-pet column
ALTER TABLE requests
DROP COLUMN IF EXISTS pet_id;

-- 4) Enforce: every pet in request_pets must belong to the same client as request
CREATE OR REPLACE FUNCTION enforce_request_pet_belongs_to_client()
RETURNS TRIGGER AS $$
DECLARE
  req_client UUID;
  pet_owner UUID;
BEGIN
  SELECT client_id INTO req_client
  FROM requests
  WHERE id = NEW.request_id;

  IF req_client IS NULL THEN
    RAISE EXCEPTION 'request_id % does not exist', NEW.request_id;
  END IF;

  SELECT client_id INTO pet_owner
  FROM pets
  WHERE id = NEW.pet_id;

  IF pet_owner IS NULL THEN
    RAISE EXCEPTION 'pet_id % does not exist', NEW.pet_id;
  END IF;

  IF pet_owner <> req_client THEN
    RAISE EXCEPTION 'pet_id % does not belong to request client_id %', NEW.pet_id, req_client;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_request_pet_belongs_to_client ON request_pets;

CREATE TRIGGER trg_enforce_request_pet_belongs_to_client
BEFORE INSERT OR UPDATE ON request_pets
FOR EACH ROW
EXECUTE FUNCTION enforce_request_pet_belongs_to_client();