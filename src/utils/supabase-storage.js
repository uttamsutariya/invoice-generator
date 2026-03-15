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
  // Always insert new — clients from the form don't have DB UUIDs
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

  const { data, error } = await supabase
    .from('invoices')
    .upsert(invoiceRow)
    .select()
    .single();
  if (error) throw error;

  const invoiceId = data.id;

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
