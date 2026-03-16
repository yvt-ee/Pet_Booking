# Pet Sitting Booking Platform

**Flow**: Client selects a service → creates a request → chat opens immediately → optionally request **Meet & Greet ($15)** inside chat → owner confirms → Stripe payment → request paid.

## Local Run (Docker)
```bash
docker compose up -d --build
docker compose exec server npm run migrate
```

Server: `http://localhost:8080`

## Key Endpoints
- `GET /health`
- `GET /services` (list services + base rates)

### Request & Chat
- `POST /requests` creates: client(upsert), pet, request(with service_id), conversation
- `GET /requests/:id`
- `POST /conversations/:id/messages`
- `GET /conversations/:id/messages`

### Meet & Greet (requested from chat)
- `POST /requests/:id/meet-greet` (create meet_greets row)
- `POST /meet-greets/:id/checkout`
- Stripe webhook: `POST /webhooks/stripe`

### Owner actions
- `POST /requests/:id/confirm` (header `x-owner-token`)
- `POST /payments/request/:requestId/checkout` (header `x-owner-token`)

## AWS Deployment (ECS Fargate + RDS + ALB)
Env vars:
- `PORT=8080`
- `DATABASE_URL=postgres://...`
- `DB_SSL=true`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `APP_BASE_URL=https://your-domain`
- `OWNER_ADMIN_TOKEN=...`

ALB health check path: `/health`


## Media, Daily Logs, Reviews (v3)
- Upload any file: `POST /uploads` (multipart form-data field `file`) => `{url}`
- Client avatar: `POST /clients/:id/avatar`
- Pet avatar: `POST /pets/:id/avatar`
- Pet gallery photo: `POST /pets/:id/photos`
- Owner daily log: `POST /logs/request/:requestId` (JSON)
- Owner log photo: `POST /logs/:logId/photos` (multipart)
- Mark completed: `POST /requests/:id/complete` (owner)
- Client review after completion: `POST /reviews/request/:requestId` (JSON)


## S3 Upload (v4)
This scaffold uses **S3 presigned PUT URLs**. Flow:
1) `POST /uploads/presign` with `{ kind, filename, content_type }`
2) Client uploads directly to S3:
   - `PUT upload_url` with header `Content-Type: content_type` and raw file body
3) Save the returned `public_url` into DB:
   - `PATCH /clients/:id/avatar` body `{ url }`
   - `PATCH /pets/:id/avatar` body `{ url }`
   - `POST /pets/:id/photos` body `{ url, caption? }`
   - `POST /logs/:logId/photos` body `{ url, caption? }`

### Required ENV
- `AWS_REGION`
- `S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
Optional:
- `PUBLIC_S3_BASE_URL` (CloudFront or custom domain)


## Frontend (React)
A minimal Vite+React UI is included in `web/`.

### Run locally
```bash
cd web
npm install
npm run dev
```
Open: http://localhost:5173

Set API base via `web/.env`:
`VITE_API_BASE=http://localhost:8080`


## UI updates (v2)
- Home: `/`
- Booking: `/book`
- Client portal: `/portal` (email lookup)
- Owner: `/owner` (token login)
