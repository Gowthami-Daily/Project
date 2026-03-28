# API endpoints — Dairy ERP blueprint

Base URL (dev): `http://127.0.0.1:8000`  
Versioned API prefix: **`/api/v1`**

Interactive docs: **`/docs`** (Swagger), **`/redoc`**

---

## Auth (implemented)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/v1/auth/login` | OAuth2 form: `username` = email, `password` |
| POST | `/api/v1/auth/login/json` | JSON `{ "email", "password" }` |
| POST | `/api/v1/auth/register` | JSON `{ "name", "email", "password", "role?" }` — lock down in production |
| GET | `/api/v1/auth/me` | Bearer JWT required |

**Default dev user** (after first startup): `admin@gowthami.local` / `ChangeMe!Admin123`

---

## Farmers — procurement (implemented)

Requires **`Authorization: Bearer <token>`**.

| Method | Path |
|--------|------|
| GET | `/api/v1/farmers` |
| POST | `/api/v1/farmers` |
| GET | `/api/v1/farmers/{farmer_id}` |
| PUT | `/api/v1/farmers/{farmer_id}` |
| DELETE | `/api/v1/farmers/{farmer_id}` |

Query: `skip`, `limit`, `search`. Response header: `X-Total-Count`.

---

## Planned modules (to add under `/api/v1`)

### Milk collection

| GET | `/milk-collection` |
| POST | `/milk-collection` |
| PUT | `/milk-collection/{id}` |
| DELETE | `/milk-collection/{id}` |

### Customers

| GET | `/customers` |
| POST | `/customers` |
| PUT | `/customers/{id}` |
| DELETE | `/customers/{id}` |

### Subscriptions

| GET | `/subscriptions` |
| POST | `/subscriptions` |
| PUT | `/subscriptions/{id}` |
| DELETE | `/subscriptions/{id}` |

### Dispatch & delivery

| GET | `/dispatch` |
| POST | `/dispatch` |
| PUT | `/dispatch/{id}` |
| POST | `/delivery/complete` |
| GET | `/delivery/logs` |

### Wallet

| GET | `/wallet/{customer_id}` |
| POST | `/wallet/recharge` |
| POST | `/wallet/deduct` |

### Expenses

| GET | `/expenses` |
| POST | `/expenses` |

### Inventory

| GET | `/inventory` |
| POST | `/inventory/transfer` |

### Production

| POST | `/production/batch` |
| POST | `/production/packing` |

### Cattle

| GET | `/animals` |
| POST | `/animals` |
| GET | `/milk-yield` |
| POST | `/feed-usage` |
| POST | `/health` |

### Dashboard

| GET | `/dashboard/summary` |
| GET | `/dashboard/charts` |

---

## Legacy routers (unchanged paths)

| Prefix | Module |
|--------|--------|
| `/inflow` | Centers, QA, tanks, transactions |
| `/ledger` | Wallet topups, expenses (existing shapes) |
| `/outflow` | Crates, dispatch board, fleet |

Migrate these into `/api/v1` over time for a single contract.
