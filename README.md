# CHICTool server

Fastify API backed by MySQL. Copy `.env.example` to `.env`, supply the MySQL credentials, then run `npm start`. Set `MYSQL_INIT_SCHEMA=true` on the first run to create the `computers` table.

`POST /api/computers` creates or updates an inventory record using `serial_number` as its idempotency key. Required fields are `serial_number`, `machine_type`, and `office`; all inventory fields used by the desktop app are accepted. `collected_on` defaults to the request time.

```json
{
  "serial_number": "ABC123",
  "machine_type": "Laptop",
  "office": "Main Office",
  "hostname": "PC-01",
  "collected_on": "2026-09-22T03:00:00.000Z"
}
```

The endpoint returns `201` for a new computer and `200` for an update. `GET /health` verifies database connectivity.
