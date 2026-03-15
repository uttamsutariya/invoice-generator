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
