# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage with Supabase for persistent data storage and add email+password authentication.

**Architecture:** Thin Supabase layer — replace `src/utils/storage.js` with async `src/utils/supabase-storage.js` that calls Supabase directly. Auth via `AuthContext` wrapping the app. All existing component data shapes preserved via a snake_case/camelCase mapping layer in the storage module.

**Tech Stack:** React 19, Vite 7, @supabase/supabase-js, React Router 7

**Spec:** `docs/superpowers/specs/2026-03-15-supabase-migration-design.md`

---

## Chunk 1: Foundation (Supabase client, SQL schema, storage layer)

### Task 1: Project setup — install dependency, env files, gitignore

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env`
- Modify: `.gitignore`

- [ ] **Step 1: Add .env to .gitignore**

Add at the end of `.gitignore`:

```
# Environment variables
.env
.env.local
```

- [ ] **Step 2: Create `.env.example`**

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

- [ ] **Step 3: Create `.env`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

User will fill in their actual values later.

- [ ] **Step 4: Install @supabase/supabase-js**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json
git commit -m "feat: add supabase dependency and env config"
```

---

### Task 2: Create Supabase client

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Create the Supabase client module**

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat: add supabase client initialization"
```

---

### Task 3: Create SQL schema file

**Files:**
- Create: `supabase/schema.sql`

This file is for the user to run in the Supabase SQL Editor to create all tables, RLS policies, and triggers.

- [ ] **Step 1: Write the complete SQL schema**

```sql
-- ============================================
-- Invoice Generator — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================

-- 1. updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Settings table
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text DEFAULT '',
  address text DEFAULT '',
  gstin text DEFAULT '',
  state text DEFAULT 'GUJARAT',
  state_code text DEFAULT '24',
  pan_iec text DEFAULT '',
  bank_name text DEFAULT '',
  bank_branch text DEFAULT '',
  bank_account text DEFAULT '',
  bank_ifsc text DEFAULT '',
  invoice_prefix text DEFAULT 'EX/',
  next_invoice_number integer DEFAULT 1,
  lut_bond_no text DEFAULT '',
  lut_from date,
  lut_to date,
  signature text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  address text DEFAULT '',
  country text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clients"
  ON clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Services table
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  sac_code text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own services"
  ON services FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Invoices table
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_no text NOT NULL DEFAULT '',
  invoice_date date,
  date_of_supply date,
  place_of_supply text DEFAULT '',
  lut_bond_no text DEFAULT '',
  lut_from date,
  lut_to date,
  state text DEFAULT '',
  state_code text DEFAULT '',
  currency text DEFAULT 'USD',
  conversion_rate numeric DEFAULT 0,
  client_name text DEFAULT '',
  client_address text DEFAULT '',
  client_country text DEFAULT '',
  company jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Invoice line items table
CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description text DEFAULT '',
  details text DEFAULT '',
  sac_code text DEFAULT '',
  amount numeric DEFAULT 0,
  igst_rate numeric DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoice line items"
  ON invoice_line_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid()
  ));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add SQL schema for supabase tables, RLS, and triggers"
```

---

### Task 4: Create supabase-storage.js — the async replacement for storage.js

**Files:**
- Create: `src/utils/supabase-storage.js`

This is the core of the migration. Every function mirrors the current `storage.js` API but is async and talks to Supabase. It handles snake_case ↔ camelCase mapping so components don't change their data shapes.

- [ ] **Step 1: Write the complete supabase-storage.js**

The file must export these functions (all async):
- `getInvoices()` — returns array of invoice objects in camelCase with nested `client` and `lineItems`
- `getInvoiceById(id)` — returns single invoice with `client` object and `lineItems` array
- `saveInvoice(invoice)` — upserts invoice row + replaces line items
- `deleteInvoice(id)` — deletes invoice (line items cascade)
- `getClients()` — returns array of client objects in camelCase
- `saveClient(client)` — upserts client
- `deleteClient(id)` — deletes client
- `getServices()` — returns array of service objects in camelCase
- `saveService(service)` — upserts service
- `deleteService(id)` — deletes service
- `getSettings()` — returns settings merged with defaults, in camelCase
- `saveSettings(settings)` — upserts settings
- `getSignature()` — reads signature from settings row
- `saveSignature(base64DataUrl)` — updates signature in settings row
- `getNextInvoiceNumber()` — reads settings, returns formatted string like "EX/001"
- `incrementInvoiceNumber()` — atomic increment of next_invoice_number via RPC or direct update

Key implementation details:
- Helper `getUserId()` gets current user's ID from `supabase.auth.getUser()`
- Helper functions `toSnake(obj)` / `toCamel(obj)` for key conversion
- `getInvoiceById` must: (1) fetch invoice row, (2) fetch line_items ordered by sort_order, (3) compose into the camelCase shape with nested `client: { name, address, country }` and `lineItems: [...]`
- `saveInvoice` must: (1) extract line items from the invoice object, (2) upsert the invoice row (flattening client into `client_name`, `client_address`, `client_country`), (3) delete existing line items for that invoice, (4) insert new line items with sort_order
- All functions throw on Supabase errors
- `getSettings` returns DEFAULT_SETTINGS merged with DB row (same defaults as current `storage.js`)
- `saveSettings` uses upsert with `onConflict: 'user_id'`

```js
import { supabase } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ─── Settings ─────────────────────────────────────────

const DEFAULT_SETTINGS = {
  companyName: '',
  address: '',
  gstin: '',
  state: 'GUJARAT',
  stateCode: '24',
  panIec: '',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
  bankIfsc: '',
  invoicePrefix: 'EX/',
  nextInvoiceNumber: 1,
  lutBondNo: '',
  lutFrom: '',
  lutTo: '',
};

function settingsFromRow(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    id: row.id,
    companyName: row.company_name ?? '',
    address: row.address ?? '',
    gstin: row.gstin ?? '',
    state: row.state ?? 'GUJARAT',
    stateCode: row.state_code ?? '24',
    panIec: row.pan_iec ?? '',
    bankName: row.bank_name ?? '',
    bankBranch: row.bank_branch ?? '',
    bankAccount: row.bank_account ?? '',
    bankIfsc: row.bank_ifsc ?? '',
    invoicePrefix: row.invoice_prefix ?? 'EX/',
    nextInvoiceNumber: row.next_invoice_number ?? 1,
    lutBondNo: row.lut_bond_no ?? '',
    lutFrom: row.lut_from ?? '',
    lutTo: row.lut_to ?? '',
  };
}

export async function getSettings() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return settingsFromRow(data);
}

export async function saveSettings(settings) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('settings')
    .upsert({
      user_id: userId,
      company_name: settings.companyName,
      address: settings.address,
      gstin: settings.gstin,
      state: settings.state,
      state_code: settings.stateCode,
      pan_iec: settings.panIec,
      bank_name: settings.bankName,
      bank_branch: settings.bankBranch,
      bank_account: settings.bankAccount,
      bank_ifsc: settings.bankIfsc,
      invoice_prefix: settings.invoicePrefix,
      next_invoice_number: settings.nextInvoiceNumber,
      lut_bond_no: settings.lutBondNo,
      lut_from: settings.lutFrom || null,
      lut_to: settings.lutTo || null,
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── Signature ────────────────────────────────────────

export async function getSignature() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('settings')
    .select('signature')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.signature || null;
}

export async function saveSignature(base64DataUrl) {
  const userId = await getUserId();
  // Ensure settings row exists first
  await supabase
    .from('settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { error } = await supabase
    .from('settings')
    .update({ signature: base64DataUrl || null })
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Invoice Number ───────────────────────────────────

export async function getNextInvoiceNumber() {
  const settings = await getSettings();
  const num = String(settings.nextInvoiceNumber).padStart(3, '0');
  return `${settings.invoicePrefix}${num}`;
}

export async function incrementInvoiceNumber() {
  const userId = await getUserId();
  // Ensure settings row exists
  await supabase
    .from('settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { error } = await supabase.rpc('increment_invoice_number', { uid: userId });
  if (error) {
    // Fallback: if RPC doesn't exist, do manual update
    const { data, error: fetchErr } = await supabase
      .from('settings')
      .select('next_invoice_number')
      .eq('user_id', userId)
      .single();
    if (fetchErr) throw fetchErr;
    const { error: updateErr } = await supabase
      .from('settings')
      .update({ next_invoice_number: (data.next_invoice_number || 1) + 1 })
      .eq('user_id', userId);
    if (updateErr) throw updateErr;
  }
}

// ─── Clients ──────────────────────────────────────────

export async function getClients() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    country: row.country,
  }));
}

export async function saveClient(client) {
  const userId = await getUserId();
  if (client.id) {
    // Check if it's an existing DB record (uuid format) or a local ID
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('clients')
        .update({ name: client.name, address: client.address, country: client.country })
        .eq('id', client.id)
        .eq('user_id', userId);
      if (error) throw error;
      return client;
    }
  }
  // Insert new
  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: userId, name: client.name, address: client.address, country: client.country })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, address: data.address, country: data.country };
}

export async function deleteClient(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Services ─────────────────────────────────────────

export async function getServices() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    sacCode: row.sac_code,
  }));
}

export async function saveService(service) {
  const userId = await getUserId();
  if (service.id) {
    const { data: existing } = await supabase
      .from('services')
      .select('id')
      .eq('id', service.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('services')
        .update({ name: service.name, sac_code: service.sacCode })
        .eq('id', service.id)
        .eq('user_id', userId);
      if (error) throw error;
      return service;
    }
  }
  const { data, error } = await supabase
    .from('services')
    .insert({ user_id: userId, name: service.name, sac_code: service.sacCode })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, sacCode: data.sac_code };
}

export async function deleteService(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Invoices ─────────────────────────────────────────

function invoiceFromRow(row, lineItems) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date ?? '',
    dateOfSupply: row.date_of_supply ?? '',
    placeOfSupply: row.place_of_supply ?? '',
    lutBondNo: row.lut_bond_no ?? '',
    lutFrom: row.lut_from ?? '',
    lutTo: row.lut_to ?? '',
    state: row.state ?? '',
    stateCode: row.state_code ?? '',
    currency: row.currency ?? 'USD',
    conversionRate: row.conversion_rate ?? '',
    client: {
      name: row.client_name ?? '',
      address: row.client_address ?? '',
      country: row.client_country ?? '',
    },
    company: row.company ?? {},
    lineItems: (lineItems || []).map((li) => ({
      id: li.id,
      description: li.description ?? '',
      details: li.details ?? '',
      sacCode: li.sac_code ?? '',
      amount: li.amount ?? '',
      igstRate: li.igst_rate ?? 0,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getInvoices() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // For the dashboard list, we also need line items to compute totals
  const invoiceIds = (data || []).map((r) => r.id);
  let allLineItems = [];
  if (invoiceIds.length > 0) {
    const { data: liData, error: liError } = await supabase
      .from('invoice_line_items')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('sort_order', { ascending: true });
    if (liError) throw liError;
    allLineItems = liData || [];
  }

  return (data || []).map((row) => {
    const rowItems = allLineItems.filter((li) => li.invoice_id === row.id);
    return invoiceFromRow(row, rowItems);
  });
}

export async function getInvoiceById(id) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: lineItems, error: liError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });
  if (liError) throw liError;

  return invoiceFromRow(data, lineItems);
}

export async function saveInvoice(invoice) {
  const userId = await getUserId();

  const invoiceRow = {
    id: invoice.id || undefined,
    user_id: userId,
    invoice_no: invoice.invoiceNo,
    invoice_date: invoice.invoiceDate || null,
    date_of_supply: invoice.dateOfSupply || null,
    place_of_supply: invoice.placeOfSupply,
    lut_bond_no: invoice.lutBondNo,
    lut_from: invoice.lutFrom || null,
    lut_to: invoice.lutTo || null,
    state: invoice.state,
    state_code: invoice.stateCode,
    currency: invoice.currency,
    conversion_rate: invoice.conversionRate || 0,
    client_name: invoice.client?.name ?? '',
    client_address: invoice.client?.address ?? '',
    client_country: invoice.client?.country ?? '',
    company: invoice.company ?? {},
  };

  // Upsert invoice
  const { data, error } = await supabase
    .from('invoices')
    .upsert(invoiceRow)
    .select()
    .single();
  if (error) throw error;

  const invoiceId = data.id;

  // Replace line items: delete old, insert new
  const { error: deleteErr } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', invoiceId);
  if (deleteErr) throw deleteErr;

  if (invoice.lineItems && invoice.lineItems.length > 0) {
    const lineItemRows = invoice.lineItems.map((item, idx) => ({
      invoice_id: invoiceId,
      description: item.description,
      details: item.details,
      sac_code: item.sacCode,
      amount: item.amount || 0,
      igst_rate: item.igstRate || 0,
      sort_order: idx,
    }));
    const { error: insertErr } = await supabase
      .from('invoice_line_items')
      .insert(lineItemRows);
    if (insertErr) throw insertErr;
  }

  return invoice;
}

export async function deleteInvoice(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/supabase-storage.js
git commit -m "feat: add supabase storage layer replacing localStorage"
```

---

## Chunk 2: Auth (context, login page, app wrapping)

### Task 5: Create AuthContext

**Files:**
- Create: `src/context/AuthContext.jsx`

- [ ] **Step 1: Write AuthContext**

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: add auth context with supabase session management"
```

---

### Task 6: Create Login page

**Files:**
- Create: `src/pages/Login.jsx`

- [ ] **Step 1: Write Login.jsx**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        backgroundColor: '#fff',
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Invoice Tracker</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div style={{ color: '#e53e3e', marginBottom: '12px', fontSize: '0.9em' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: add login page"
```

---

### Task 7: Update App.jsx — add auth wrapping, protected routes, logout

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx**

Replace the full content of `src/App.jsx` with:

```jsx
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import InvoiceForm from './pages/InvoiceForm';
import InvoicePreview from './pages/InvoicePreview';
import Settings from './pages/Settings';
import Login from './pages/Login';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AppHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="app-header no-print">
      <div className="app-header-inner">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          Invoice Tracker
        </h1>
        <button className="btn btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppHeader />
            <main className="app-main">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/invoice/new" element={<InvoiceForm />} />
                <Route path="/invoice/:id/edit" element={<InvoiceForm />} />
                <Route path="/invoice/:id/preview" element={<InvoicePreview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}
```

Key changes from current App.jsx:
- Wraps everything in `<AuthProvider>`
- `/login` route is public
- All other routes wrapped in `<ProtectedRoute>`
- Header moved into `AppHeader` component (inside ProtectedRoute so logout is accessible)
- Added logout button in header
- `<AppHeader>` is only shown when authenticated (not on login page)

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add auth protection, login route, and logout button"
```

---

## Chunk 3: Migrate all pages to async Supabase calls

### Task 8: Migrate Dashboard.jsx

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Update Dashboard.jsx**

Changes needed:
1. Change import from `'../utils/storage'` to `'../utils/supabase-storage'`
2. Make `useEffect` async for loading invoices
3. Make `handleDelete` async
4. Add loading state

Replace the full content with:

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, deleteInvoice } from '../utils/supabase-storage';
import { formatDate, getCurrencyByCode } from '../utils/helpers';

export default function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setInvoices(await getInvoices());
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.client?.name?.toLowerCase().includes(q) ||
      ''
    );
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      setInvoices(await getInvoices());
    } catch (err) {
      alert('Failed to delete invoice: ' + err.message);
    }
  };

  const getTotal = (inv) => {
    return (inv.lineItems || []).reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      const igstRate = parseFloat(item.igstRate) || 0;
      return sum + amount + (amount * igstRate) / 100;
    }, 0);
  };

  if (loading) {
    return <div className="page" style={{ textAlign: 'center', padding: '40px' }}>Loading invoices...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Invoices</h2>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/settings')}>Settings</button>
          <button className="btn btn-primary" onClick={() => navigate('/invoice/new')}>+ New Invoice</button>
        </div>
      </div>

      <input
        className="search-input"
        placeholder="Search by invoice no. or client name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          {invoices.length === 0 ? (
            <>
              <p>No invoices yet.</p>
              <p>Start by configuring your <button className="link-btn" onClick={() => navigate('/settings')}>company settings</button>, then create your first invoice.</p>
            </>
          ) : (
            <p>No invoices match your search.</p>
          )}
        </div>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Date</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .map((inv) => {
                const cur = getCurrencyByCode(inv.currency);
                const total = getTotal(inv);
                return (
                  <tr key={inv.id}>
                    <td>
                      <button className="link-btn" onClick={() => navigate(`/invoice/${inv.id}/preview`)}>
                        {inv.invoiceNo}
                      </button>
                    </td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{inv.client?.name || '—'}</td>
                    <td>{cur.symbol} {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="actions-cell">
                      <button className="btn btn-sm" onClick={() => navigate(`/invoice/${inv.id}/preview`)}>View</button>
                      <button className="btn btn-sm" onClick={() => navigate(`/invoice/${inv.id}/edit`)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => navigate(`/invoice/${inv.id}/edit?duplicate=true`)}>Duplicate</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(inv.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: migrate dashboard to supabase storage"
```

---

### Task 9: Migrate InvoiceForm.jsx

**Files:**
- Modify: `src/pages/InvoiceForm.jsx`

This is the largest change. Key differences:
1. Import from `supabase-storage` instead of `storage`
2. The `useEffect` initialization becomes async
3. `createNewInvoice` becomes async (because `getNextInvoiceNumber` is async)
4. `handleSave`, `handleSaveNewClient`, `handleSaveNewService`, `handleSignatureUpload`, `handleClearSignature` all become async
5. Add a loading state while initial data loads

- [ ] **Step 1: Rewrite InvoiceForm.jsx**

Replace full content with:

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getSettings,
  getInvoiceById,
  saveInvoice,
  getClients,
  saveClient,
  getNextInvoiceNumber,
  incrementInvoiceNumber,
  getServices,
  saveService,
  getSignature,
  saveSignature,
} from '../utils/supabase-storage';
import {
  generateId,
  CURRENCIES,
  getCurrencyByCode,
  todayISO,
  numberToWords,
  numberToWordsInternational,
} from '../utils/helpers';

function createEmptyLineItem() {
  return {
    id: generateId(),
    description: '',
    details: '',
    sacCode: '',
    amount: '',
    igstRate: 0,
  };
}

export default function InvoiceForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const isDuplicating = searchParams.get('duplicate') === 'true';

  const [invoice, setInvoice] = useState(null);
  const [clients, setClients] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', address: '', country: '' });
  const [services, setServices] = useState([]);
  const [showNewService, setShowNewService] = useState(false);
  const [newService, setNewService] = useState({ name: '', sacCode: '' });
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [settings, clientsList, servicesList, sig] = await Promise.all([
          getSettings(),
          getClients(),
          getServices(),
          getSignature(),
        ]);
        setClients(clientsList);
        setServices(servicesList);
        setSignature(sig);

        if (isEditing) {
          const existing = await getInvoiceById(id);
          if (existing) {
            if (isDuplicating) {
              const nextNum = await getNextInvoiceNumber();
              setInvoice({
                ...existing,
                id: generateId(),
                invoiceNo: nextNum,
                invoiceDate: todayISO(),
                dateOfSupply: todayISO(),
              });
            } else {
              setInvoice(existing);
            }
          } else {
            navigate('/');
          }
        } else {
          const nextNum = await getNextInvoiceNumber();
          setInvoice({
            id: generateId(),
            invoiceNo: nextNum,
            invoiceDate: todayISO(),
            dateOfSupply: todayISO(),
            placeOfSupply: '',
            lutBondNo: settings.lutBondNo || '',
            lutFrom: settings.lutFrom || '',
            lutTo: settings.lutTo || '',
            state: settings.state || 'GUJARAT',
            stateCode: settings.stateCode || '24',
            currency: 'USD',
            conversionRate: '',
            client: { name: '', address: '', country: '' },
            lineItems: [createEmptyLineItem()],
            company: {
              name: settings.companyName || '',
              address: settings.address || '',
              gstin: settings.gstin || '',
              panIec: settings.panIec || '',
              bankName: settings.bankName || '',
              bankBranch: settings.bankBranch || '',
              bankAccount: settings.bankAccount || '',
              bankIfsc: settings.bankIfsc || '',
            },
          });
        }
      } catch (err) {
        console.error('Failed to load form data:', err);
        alert('Failed to load data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEditing, isDuplicating, navigate]);

  const currency = useMemo(
    () => (invoice ? getCurrencyByCode(invoice.currency) : CURRENCIES[0]),
    [invoice?.currency]
  );

  if (loading || !invoice) {
    return <div className="page" style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
  }

  const updateField = (field, value) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const updateClient = (field, value) => {
    setInvoice((prev) => ({
      ...prev,
      client: { ...prev.client, [field]: value },
    }));
  };

  const updateCompany = (field, value) => {
    setInvoice((prev) => ({
      ...prev,
      company: { ...prev.company, [field]: value },
    }));
  };

  const updateLineItem = (itemId, field, value) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addLineItem = () => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, createEmptyLineItem()],
    }));
  };

  const removeLineItem = (itemId) => {
    if (invoice.lineItems.length <= 1) return;
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== itemId),
    }));
  };

  const selectClient = (clientId) => {
    if (!clientId) {
      updateClient('name', '');
      updateClient('address', '');
      updateClient('country', '');
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setInvoice((prev) => ({
        ...prev,
        client: { name: client.name, address: client.address, country: client.country },
      }));
    }
  };

  const handleSaveNewClient = async () => {
    if (!newClient.name.trim()) return;
    try {
      const saved = await saveClient(newClient);
      setClients((prev) => [...prev, saved]);
      setInvoice((prev) => ({
        ...prev,
        client: { name: saved.name, address: saved.address, country: saved.country },
      }));
      setNewClient({ name: '', address: '', country: '' });
      setShowNewClient(false);
    } catch (err) {
      alert('Failed to save client: ' + err.message);
    }
  };

  const selectService = (itemId, serviceId) => {
    if (!serviceId) return;
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      setInvoice((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((item) =>
          item.id === itemId ? { ...item, description: service.name, sacCode: service.sacCode } : item
        ),
      }));
    }
  };

  const handleSaveNewService = async () => {
    if (!newService.name.trim()) return;
    try {
      const saved = await saveService(newService);
      setServices((prev) => [...prev, saved]);
      setNewService({ name: '', sacCode: '' });
      setShowNewService(false);
    } catch (err) {
      alert('Failed to save service: ' + err.message);
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await saveSignature(base64);
        setSignature(base64);
      } catch (err) {
        alert('Failed to save signature: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = async () => {
    try {
      await saveSignature(null);
      setSignature(null);
    } catch (err) {
      alert('Failed to clear signature: ' + err.message);
    }
  };

  // Calculations
  const lineItemsCalc = invoice.lineItems.map((item) => {
    const amount = parseFloat(item.amount) || 0;
    const igstRate = parseFloat(item.igstRate) || 0;
    const igstAmount = (amount * igstRate) / 100;
    const total = amount + igstAmount;
    return { ...item, amount, igstRate, igstAmount, total };
  });

  const totalAmount = lineItemsCalc.reduce((sum, item) => sum + item.amount, 0);
  const totalIgst = lineItemsCalc.reduce((sum, item) => sum + item.igstAmount, 0);
  const totalBillForeign = totalAmount + totalIgst;
  const convRate = parseFloat(invoice.conversionRate) || 0;
  const totalBillINR = totalBillForeign * convRate;

  const handleSave = async () => {
    setSaving(true);
    try {
      const isNew = !isEditing || isDuplicating;
      await saveInvoice(invoice);
      if (isNew) {
        await incrementInvoiceNumber();
      }
      navigate(`/invoice/${invoice.id}/preview`);
    } catch (err) {
      alert('Failed to save invoice: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>{isEditing && !isDuplicating ? 'Edit Invoice' : 'New Invoice'}</h2>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Preview'}
          </button>
        </div>
      </div>

      {/* Company Details */}
      <fieldset>
        <legend>Company Details</legend>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Company Name</label>
            <input value={invoice.company.name} onChange={(e) => updateCompany('name', e.target.value)} />
          </div>
          <div className="form-row">
            <label>GSTIN</label>
            <input value={invoice.company.gstin} onChange={(e) => updateCompany('gstin', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label>Address</label>
          <textarea value={invoice.company.address} onChange={(e) => updateCompany('address', e.target.value)} rows={2} />
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>PAN / IEC Code</label>
            <input value={invoice.company.panIec} onChange={(e) => updateCompany('panIec', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Invoice Metadata */}
      <fieldset>
        <legend>Invoice Details</legend>
        <div className="form-grid-3">
          <div className="form-row">
            <label>Invoice No.</label>
            <input value={invoice.invoiceNo} onChange={(e) => updateField('invoiceNo', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Invoice Date</label>
            <input type="date" value={invoice.invoiceDate} onChange={(e) => updateField('invoiceDate', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Date of Supply</label>
            <input type="date" value={invoice.dateOfSupply} onChange={(e) => updateField('dateOfSupply', e.target.value)} />
          </div>
        </div>
        <div className="form-grid-3">
          <div className="form-row">
            <label>Place of Supply</label>
            <input value={invoice.placeOfSupply} onChange={(e) => updateField('placeOfSupply', e.target.value)} placeholder="e.g. UNITED STATE OF AMERICA (USA)" />
          </div>
          <div className="form-row">
            <label>State</label>
            <input value={invoice.state} onChange={(e) => updateField('state', e.target.value)} />
          </div>
          <div className="form-row">
            <label>State Code</label>
            <input value={invoice.stateCode} onChange={(e) => updateField('stateCode', e.target.value)} />
          </div>
        </div>
        <div className="form-grid-3">
          <div className="form-row">
            <label>LUT / Bond No.</label>
            <input value={invoice.lutBondNo} onChange={(e) => updateField('lutBondNo', e.target.value)} />
          </div>
          <div className="form-row">
            <label>LUT From</label>
            <input type="date" value={invoice.lutFrom} onChange={(e) => updateField('lutFrom', e.target.value)} />
          </div>
          <div className="form-row">
            <label>LUT To</label>
            <input type="date" value={invoice.lutTo} onChange={(e) => updateField('lutTo', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Currency */}
      <fieldset>
        <legend>Currency & Conversion</legend>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Currency</label>
            <select value={invoice.currency} onChange={(e) => updateField('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Conversion Rate (1 {currency.code} = INR)</label>
            <input
              type="number"
              step="0.0000001"
              value={invoice.conversionRate}
              onChange={(e) => updateField('conversionRate', e.target.value)}
              placeholder="e.g. 80.9835511"
            />
          </div>
        </div>
      </fieldset>

      {/* Client */}
      <fieldset>
        <legend>Buyer / Billed To</legend>
        <div className="form-row">
          <label>Select Saved Client</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              style={{ flex: 1 }}
              onChange={(e) => selectClient(e.target.value)}
              defaultValue=""
            >
              <option value="">-- Select client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => setShowNewClient(!showNewClient)}>
              + New
            </button>
          </div>
        </div>

        {showNewClient && (
          <div className="new-client-box">
            <div className="form-grid-3">
              <div className="form-row">
                <label>Name</label>
                <input value={newClient.name} onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>Country</label>
                <input value={newClient.country} onChange={(e) => setNewClient((p) => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="form-row" style={{ alignSelf: 'end' }}>
                <button type="button" className="btn btn-primary" onClick={handleSaveNewClient}>Save Client</button>
              </div>
            </div>
            <div className="form-row">
              <label>Address</label>
              <textarea value={newClient.address} onChange={(e) => setNewClient((p) => ({ ...p, address: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        <div className="form-row">
          <label>Name</label>
          <input value={invoice.client.name} onChange={(e) => updateClient('name', e.target.value)} />
        </div>
        <div className="form-row">
          <label>Address</label>
          <textarea value={invoice.client.address} onChange={(e) => updateClient('address', e.target.value)} rows={2} />
        </div>
        <div className="form-row">
          <label>Country</label>
          <input value={invoice.client.country} onChange={(e) => updateClient('country', e.target.value)} />
        </div>
      </fieldset>

      {/* Line Items */}
      <fieldset>
        <legend>Line Items</legend>
        <table className="line-items-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Particulars</th>
              <th style={{ width: '100px' }}>SAC</th>
              <th style={{ width: '120px' }}>Amount ({currency.symbol})</th>
              <th style={{ width: '130px' }}>Amount (INR)</th>
              <th style={{ width: '80px' }}>IGST %</th>
              <th style={{ width: '110px' }}>IGST Amt</th>
              <th style={{ width: '120px' }}>Total</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, idx) => {
              const calc = lineItemsCalc[idx];
              const itemAmountNum = parseFloat(item.amount) || 0;
              const itemINR = convRate ? (itemAmountNum * convRate) : 0;
              return (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <select
                      onChange={(e) => selectService(item.id, e.target.value)}
                      value=""
                      style={{ marginBottom: '4px', fontSize: '0.8em' }}
                    >
                      <option value="">-- Select service --</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <input
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Service description"
                      style={{ fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <textarea
                      value={item.details}
                      onChange={(e) => updateLineItem(item.id, 'details', e.target.value)}
                      placeholder="Details (hours, rate, etc.)"
                      rows={2}
                      style={{ fontSize: '0.85em' }}
                    />
                  </td>
                  <td>
                    <input
                      value={item.sacCode}
                      onChange={(e) => updateLineItem(item.id, 'sacCode', e.target.value)}
                      placeholder="998314"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                      placeholder="Foreign"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={itemINR ? itemINR.toFixed(2) : ''}
                      onChange={(e) => {
                        const inrVal = parseFloat(e.target.value) || 0;
                        if (convRate) {
                          updateLineItem(item.id, 'amount', (inrVal / convRate).toFixed(2));
                        }
                      }}
                      placeholder={convRate ? 'INR' : 'Set rate'}
                      disabled={!convRate}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.igstRate}
                      onChange={(e) => updateLineItem(item.id, 'igstRate', e.target.value)}
                    />
                  </td>
                  <td className="computed">{calc ? calc.igstAmount.toFixed(2) : '0.00'}</td>
                  <td className="computed">{calc ? calc.total.toFixed(2) : '0.00'}</td>
                  <td>
                    {invoice.lineItems.length > 1 && (
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => removeLineItem(item.id)}
                        title="Remove"
                      >
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button type="button" className="btn" onClick={addLineItem}>
            + Add Line Item
          </button>
          <button type="button" className="btn" onClick={() => setShowNewService(!showNewService)}>
            + New Service
          </button>
        </div>

        {showNewService && (
          <div className="new-client-box" style={{ marginTop: '8px' }}>
            <div className="form-grid-3">
              <div className="form-row">
                <label>Service Name</label>
                <input value={newService.name} onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>SAC Code</label>
                <input value={newService.sacCode} onChange={(e) => setNewService((p) => ({ ...p, sacCode: e.target.value }))} placeholder="998314" />
              </div>
              <div className="form-row" style={{ alignSelf: 'end' }}>
                <button type="button" className="btn btn-primary" onClick={handleSaveNewService}>Save Service</button>
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {/* Bank Details */}
      <fieldset>
        <legend>Bank Details</legend>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Bank Name</label>
            <input value={invoice.company.bankName} onChange={(e) => updateCompany('bankName', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Bank Branch</label>
            <input value={invoice.company.bankBranch} onChange={(e) => updateCompany('bankBranch', e.target.value)} />
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Bank A/c Number</label>
            <input value={invoice.company.bankAccount} onChange={(e) => updateCompany('bankAccount', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Bank IFSC</label>
            <input value={invoice.company.bankIfsc} onChange={(e) => updateCompany('bankIfsc', e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Signature */}
      <fieldset>
        <legend>Authorised Signatory</legend>
        <div className="form-row">
          <label>Upload Signature Image</label>
          <input type="file" accept="image/*" onChange={handleSignatureUpload} />
        </div>
        {signature && (
          <div className="signature-preview">
            <img src={signature} alt="Signature" style={{ maxHeight: '60px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '4px' }} />
            <button type="button" className="btn btn-danger btn-sm" onClick={handleClearSignature} style={{ marginLeft: '8px' }}>
              Clear Signature
            </button>
          </div>
        )}
      </fieldset>

      {/* Summary */}
      <fieldset>
        <legend>Summary (Auto-calculated)</legend>
        <table className="summary-table">
          <tbody>
            <tr><td>Total Amount before Tax</td><td>{currency.symbol} {totalAmount.toFixed(2)}</td></tr>
            <tr><td>Add: IGST</td><td>{currency.symbol} {totalIgst.toFixed(2)}</td></tr>
            <tr><td><strong>Total Bill Amount in {currency.code}</strong></td><td><strong>{currency.symbol} {totalBillForeign.toFixed(2)}</strong></td></tr>
            <tr><td>Total Bill Amount in Rs.</td><td>Rs. {totalBillINR.toFixed(2)}</td></tr>
            <tr>
              <td>Conversion Rate</td>
              <td>1 {currency.code} = INR {convRate || '—'}</td>
            </tr>
            <tr><td>Amount in words ({currency.code})</td><td>{numberToWordsInternational(totalBillForeign, currency.name)}</td></tr>
            <tr><td>Total Amount in words (INR)</td><td>{convRate ? 'Rupees ' + numberToWords(totalBillINR) + ' Only' : '—'}</td></tr>
          </tbody>
        </table>
      </fieldset>

      <div className="form-actions">
        <button className="btn" onClick={() => navigate('/')}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Preview'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/InvoiceForm.jsx
git commit -m "feat: migrate invoice form to supabase storage"
```

---

### Task 10: Migrate InvoicePreview.jsx

**Files:**
- Modify: `src/pages/InvoicePreview.jsx`

Changes:
1. Import from `supabase-storage`
2. Async useEffect for loading invoice and signature
3. Add loading state

- [ ] **Step 1: Update InvoicePreview.jsx**

Change only the import and useEffect. Replace the import line and the useEffect block:

**Import change:** Replace `import { getInvoiceById, getSignature } from "../utils/storage";` with `import { getInvoiceById, getSignature } from "../utils/supabase-storage";`

**Add loading state:** Add `const [loading, setLoading] = useState(true);` after the signature state.

**Replace the useEffect:**
```jsx
useEffect(() => {
  const load = async () => {
    try {
      const [inv, sig] = await Promise.all([
        getInvoiceById(id),
        getSignature(),
      ]);
      if (inv) setInvoice(inv);
      else navigate("/");
      setSignature(sig);
    } catch (err) {
      console.error('Failed to load invoice:', err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };
  load();
}, [id, navigate]);
```

**Replace the early return:** Change `if (!invoice) return null;` to:
```jsx
if (loading || !invoice) return <div className="page" style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/InvoicePreview.jsx
git commit -m "feat: migrate invoice preview to supabase storage"
```

---

### Task 11: Migrate Settings.jsx

**Files:**
- Modify: `src/pages/Settings.jsx`

Changes:
1. Import from `supabase-storage`
2. Async useEffect for loading settings
3. Async handleSubmit
4. Add loading state
5. Cannot use `getSettings()` synchronously in `useState` anymore

- [ ] **Step 1: Rewrite Settings.jsx**

Replace full content with:

```jsx
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/supabase-storage';

const DEFAULT_SETTINGS = {
  companyName: '',
  address: '',
  gstin: '',
  state: 'GUJARAT',
  stateCode: '24',
  panIec: '',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
  bankIfsc: '',
  invoicePrefix: 'EX/',
  nextInvoiceNumber: 1,
  lutBondNo: '',
  lutFrom: '',
  lutTo: '',
};

export default function Settings() {
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setForm(await getSettings());
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page" style={{ textAlign: 'center', padding: '40px' }}>Loading settings...</div>;
  }

  return (
    <div className="page">
      <h2>Company Settings</h2>
      <form onSubmit={handleSubmit} className="settings-form">
        <fieldset>
          <legend>Company Information</legend>
          <div className="form-row">
            <label>Company Name</label>
            <input name="companyName" value={form.companyName} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Address</label>
            <textarea name="address" value={form.address} onChange={handleChange} rows={3} />
          </div>
          <div className="form-row">
            <label>GSTIN</label>
            <input name="gstin" value={form.gstin} onChange={handleChange} />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>State</label>
              <input name="state" value={form.state} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label>State Code</label>
              <input name="stateCode" value={form.stateCode} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <label>PAN / IEC Code</label>
            <input name="panIec" value={form.panIec} onChange={handleChange} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Bank Details</legend>
          <div className="form-row">
            <label>Bank Name</label>
            <input name="bankName" value={form.bankName} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Bank Branch</label>
            <input name="bankBranch" value={form.bankBranch} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Bank A/c Number</label>
            <input name="bankAccount" value={form.bankAccount} onChange={handleChange} />
          </div>
          <div className="form-row">
            <label>Bank IFSC</label>
            <input name="bankIfsc" value={form.bankIfsc} onChange={handleChange} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Invoice Configuration</legend>
          <div className="form-grid-2">
            <div className="form-row">
              <label>Invoice No. Prefix</label>
              <input name="invoicePrefix" value={form.invoicePrefix} onChange={handleChange} placeholder="EX/" />
            </div>
            <div className="form-row">
              <label>Next Invoice Number</label>
              <input
                name="nextInvoiceNumber"
                type="number"
                min="1"
                value={form.nextInvoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, nextInvoiceNumber: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <div className="form-row">
            <label>LUT / Bond No.</label>
            <input name="lutBondNo" value={form.lutBondNo} onChange={handleChange} />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label>LUT Valid From</label>
              <input name="lutFrom" type="date" value={form.lutFrom} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label>LUT Valid To</label>
              <input name="lutTo" type="date" value={form.lutTo} onChange={handleChange} />
            </div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat: migrate settings page to supabase storage"
```

---

### Task 12: Delete old storage.js and verify build

**Files:**
- Delete: `src/utils/storage.js`

- [ ] **Step 1: Delete the old storage file**

Run: `rm src/utils/storage.js`

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`

Expected: Build succeeds with no import errors. All imports now point to `supabase-storage.js`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove old localStorage storage.js — migration complete"
```

---

## Chunk 4: Final verification

### Task 13: Manual testing checklist

Before considering this done, verify these flows work end-to-end in the browser (after the user sets up their Supabase project and fills in `.env`):

- [ ] **Login flow**: Visit app → redirected to /login → enter email+password → lands on dashboard
- [ ] **Settings**: Go to /settings → save company info → refresh page → data persists
- [ ] **New invoice**: Create invoice → fills form → save → preview shows correctly
- [ ] **Edit invoice**: Edit an existing invoice → save → changes persist
- [ ] **Duplicate invoice**: Duplicate an invoice → new invoice number generated → save works
- [ ] **Delete invoice**: Delete from dashboard → invoice removed
- [ ] **Client quick add**: Add new client in invoice form → appears in dropdown
- [ ] **Service quick add**: Add new service → appears in dropdown
- [ ] **Signature**: Upload signature → appears on invoice preview → persists across page loads
- [ ] **PDF download**: Download PDF from preview page → renders correctly
- [ ] **Logout**: Click logout → redirected to login → cannot access app pages directly
- [ ] **Session persistence**: Refresh page while logged in → stays logged in
