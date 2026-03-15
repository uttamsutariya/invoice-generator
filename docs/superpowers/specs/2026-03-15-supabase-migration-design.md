# Supabase Migration Design — Invoice Generator

## Goal

Migrate the invoice generator from localStorage to Supabase for persistent storage and add email+password authentication. No backend code — all operations use the Supabase JS client directly from React.

## Constraints

- 2-3 users only, added manually in Supabase Dashboard
- No signup, no OAuth, no password reset — just email+password login
- Signature stored as base64 text in DB (not Storage bucket)
- All existing functionality must continue working
- No backend — Supabase client SDK only

---

## 1. Database Schema

### `settings` (one row per user)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | unique |
| company_name | text | |
| address | text | |
| gstin | text | |
| state | text | default `'GUJARAT'` |
| state_code | text | default `'24'` |
| pan_iec | text | |
| bank_name | text | |
| bank_branch | text | |
| bank_account | text | |
| bank_ifsc | text | |
| invoice_prefix | text | default `'EX/'` |
| next_invoice_number | integer | default `1` |
| lut_bond_no | text | |
| lut_from | date | |
| lut_to | date | |
| signature | text | base64 data URL |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()` |

### `clients`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | |
| name | text | |
| address | text | |
| country | text | |
| created_at | timestamptz | default `now()` |

### `services`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | |
| name | text | |
| sac_code | text | |
| created_at | timestamptz | default `now()` |

### `invoices`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| user_id | uuid (FK → auth.users) | |
| invoice_no | text | |
| invoice_date | date | |
| date_of_supply | date | |
| place_of_supply | text | |
| lut_bond_no | text | |
| lut_from | date | |
| lut_to | date | |
| state | text | |
| state_code | text | |
| currency | text | |
| conversion_rate | numeric | |
| client_name | text | denormalized snapshot |
| client_address | text | denormalized snapshot |
| client_country | text | denormalized snapshot |
| company | jsonb | snapshot of company details at invoice time |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()` |

### `invoice_line_items`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | `gen_random_uuid()` |
| invoice_id | uuid (FK → invoices) | ON DELETE CASCADE |
| description | text | |
| details | text | |
| sac_code | text | |
| amount | numeric | |
| igst_rate | numeric | |
| sort_order | integer | preserve line item order |

### Row Level Security (RLS)

Enabled on all 5 tables. Policies for each:

- **settings, clients, services, invoices**: `auth.uid() = user_id` for all operations (SELECT, INSERT, UPDATE, DELETE)
- **invoice_line_items**: policy via join — `EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())` for all operations

### Key Design Decisions

- **Client info denormalized on invoices**: Invoice stores a snapshot of client data at creation time (matches current behavior)
- **Company stored as JSONB on invoices**: Same snapshot reasoning — company details at the time of invoice creation
- **Signature in settings table**: It's per-user, not per-invoice
- **Line items in separate table**: Proper relational design with cascade delete
- **Every table has user_id**: For RLS enforcement

---

## 2. Authentication Flow

### Setup

Users are created manually in Supabase Dashboard → Authentication → Users → "Add user" (email + password).

### Flow

```
App loads → AuthContext checks supabase.auth.getSession()
  → Has session? → Show app (Dashboard, InvoiceForm, etc.)
  → No session? → Redirect to /login

Login page → supabase.auth.signInWithPassword({ email, password })
  → Success → Redirect to /
  → Failure → Show error message

Logout button → supabase.auth.signOut() → Redirect to /login
```

### Components

- **`AuthContext`**: React context providing `user`, `session`, `loading`, `signIn()`, `signOut()`
- **`ProtectedRoute`**: Wrapper that redirects to `/login` if no session
- **`Login.jsx`**: Simple email + password form

### No features

- No signup page
- No forgot password
- No OAuth providers
- No email verification

---

## 3. Storage Layer Migration

### Pattern Change

Current (`storage.js` — synchronous, localStorage):
```js
export const getInvoices = () => { /* reads localStorage */ }
export const saveInvoice = (invoice) => { /* writes localStorage */ }
```

New (`supabase-storage.js` — async, Supabase):
```js
export const getInvoices = async () => { /* queries supabase */ }
export const saveInvoice = async (invoice) => { /* upserts to supabase */ }
```

### Function Mapping

| Function | Supabase Operation |
|----------|-------------------|
| `getInvoices()` | `supabase.from('invoices').select('*').eq('user_id', uid).order('created_at', { ascending: false })` |
| `getInvoiceById(id)` | Select invoice + select its line_items (ordered by sort_order) |
| `saveInvoice(invoice)` | Upsert invoice row + delete old line_items + insert new line_items |
| `deleteInvoice(id)` | Delete invoice (line_items cascade) |
| `getClients()` | Select from clients where user_id matches |
| `saveClient(client)` | Upsert client |
| `deleteClient(id)` | Delete client |
| `getServices()` | Select from services where user_id matches |
| `saveService(service)` | Upsert service |
| `deleteService(id)` | Delete service |
| `getSettings()` | Select settings where user_id matches, merge with defaults if no row |
| `saveSettings(settings)` | Upsert settings on user_id |
| `getSignature()` | Read signature column from settings |
| `saveSignature(base64)` | Update signature column in settings |
| `incrementInvoiceNumber()` | Update next_invoice_number in settings (+1) |

### user_id Injection

Every function gets the current user ID from `supabase.auth.getUser()`. RLS provides defense-in-depth at the database level.

### Component Changes

| Component | Changes |
|-----------|---------|
| `Dashboard.jsx` | Async fetch invoices in useEffect, add loading state |
| `InvoiceForm.jsx` | Async load (settings, clients, services, invoice for edit), async save |
| `InvoicePreview.jsx` | Async load invoice by ID, add loading state |
| `Settings.jsx` | Async load/save settings and signature |

---

## 4. File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Supabase client initialization (`createClient`) |
| `src/utils/supabase-storage.js` | All async DB operations (replaces `storage.js`) |
| `src/context/AuthContext.jsx` | Auth context provider + `useAuth` hook |
| `src/pages/Login.jsx` | Login page |
| `.env` | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| `.env.example` | Template for env vars |

### Modified Files

| File | Change |
|------|--------|
| `src/App.jsx` | Wrap with AuthProvider, add ProtectedRoute, add /login route, add logout button |
| `src/pages/Dashboard.jsx` | Async data fetching, loading state |
| `src/pages/InvoiceForm.jsx` | Async load/save, use new storage functions |
| `src/pages/InvoicePreview.jsx` | Async invoice load |
| `src/pages/Settings.jsx` | Async load/save |
| `package.json` | Add `@supabase/supabase-js` dependency |
| `.gitignore` | Add `.env` |

### Deleted Files

| File | Reason |
|------|--------|
| `src/utils/storage.js` | Replaced by `supabase-storage.js` |

### Unchanged Files

- `src/utils/helpers.js` — pure utilities, no storage
- `src/index.css` / `src/App.css` — styling unchanged
- `vite.config.js` — no changes needed

---

## 5. Supabase Project Setup (Manual Steps)

The user will need to:

1. Create a Supabase project at supabase.com
2. Run the SQL schema (provided as part of implementation) to create tables + RLS policies
3. Create users manually in Dashboard → Authentication → Users
4. Copy the project URL and anon key into `.env`
