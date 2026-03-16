/**
 * Simple local concurrency test:
 * - Requires server running at http://localhost:8080
 * - Fires N concurrent POST /requests with same time window
 * Expect: 1 success, rest 409 TIME_WINDOW_CONFLICT
 */
const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const N = Number(process.env.N ?? 20);

function iso(d) { return new Date(d).toISOString(); }

async function run() {
  const start = Date.now() + 48 * 60 * 60 * 1000;
  const end = start + 2 * 60 * 60 * 1000;

  const body = {
    client_name: "Concurrent",
    client_email: "c@example.com",
    pet_name: "Bolt",
    pet_type: "DOG",
    start_at: iso(start),
    end_at: iso(end),
    notes: "concurrency test"
  };

  const tasks = Array.from({ length: N }, (_, i) =>
    fetch(`${BASE}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, client_email: `c${i}@example.com` })
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
  );

  const results = await Promise.all(tasks);
  const ok = results.filter(r => r.status === 201).length;
  const conflict = results.filter(r => r.status === 409).length;
  const other = results.filter(r => ![201,409].includes(r.status));

  console.log({ N, ok, conflict, other: other.length });
  if (other.length) console.log("Other samples:", other.slice(0,3));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
