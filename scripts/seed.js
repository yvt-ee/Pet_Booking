import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/pet_booking"
});

async function run() {
  const svc = await pool.query(`SELECT id FROM services WHERE service_type='Boarding' LIMIT 1`);
  let serviceId = svc.rows[0]?.id;
  if (!serviceId) {
    const ins = await pool.query(
      `INSERT INTO services(service_type, base_rate_per_day) VALUES ('Boarding', 80.00) RETURNING id`
    );
    serviceId = ins.rows[0].id;
  }

  const c = await pool.query(
    `
    INSERT INTO clients(name, email, phone)
    VALUES ('Alice', 'alice@example.com', '2060000000')
    ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
    RETURNING id
    `
  );
  const clientId = c.rows[0].id;

  const p = await pool.query(
    `INSERT INTO pets(client_id, name, pet_type, energy_level) VALUES ($1,'Lucy','DOG','Moderate') RETURNING id`,
    [clientId]
  );
  const petId = p.rows[0].id;

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);

  const r = await pool.query(
    `
    INSERT INTO requests(client_id, pet_id, service_id, start_at, end_at, notes, status)
    VALUES ($1,$2,$3,$4,$5,'seed request','REQUESTED')
    RETURNING id
    `,
    [clientId, petId, serviceId, start, end]
  );
  const requestId = r.rows[0].id;

  const convo = await pool.query(`INSERT INTO conversations(request_id) VALUES ($1) RETURNING id`, [requestId]);

  console.log("Seeded request:", requestId, "conversation:", convo.rows[0].id);
  await pool.end();
}

run().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
