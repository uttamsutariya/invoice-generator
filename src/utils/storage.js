const KEYS = {
  INVOICES: 'invoice-tracker-invoices',
  SETTINGS: 'invoice-tracker-settings',
  CLIENTS: 'invoice-tracker-clients',
  SERVICES: 'invoice-tracker-services',
  SIGNATURE: 'invoice-tracker-signature',
};

function get(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Invoices
export function getInvoices() {
  return get(KEYS.INVOICES) || [];
}

export function saveInvoice(invoice) {
  const invoices = getInvoices();
  const idx = invoices.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) {
    invoices[idx] = { ...invoice, updatedAt: new Date().toISOString() };
  } else {
    invoices.push({
      ...invoice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  set(KEYS.INVOICES, invoices);
  return invoice;
}

export function deleteInvoice(id) {
  const invoices = getInvoices().filter((i) => i.id !== id);
  set(KEYS.INVOICES, invoices);
}

export function getInvoiceById(id) {
  return getInvoices().find((i) => i.id === id) || null;
}

// Settings
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

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(get(KEYS.SETTINGS) || {}) };
}

export function saveSettings(settings) {
  set(KEYS.SETTINGS, settings);
}

// Clients
export function getClients() {
  return get(KEYS.CLIENTS) || [];
}

export function saveClient(client) {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.push(client);
  }
  set(KEYS.CLIENTS, clients);
  return client;
}

export function deleteClient(id) {
  const clients = getClients().filter((c) => c.id !== id);
  set(KEYS.CLIENTS, clients);
}

// Services
export function getServices() {
  return get(KEYS.SERVICES) || [];
}

export function saveService(service) {
  const services = getServices();
  const idx = services.findIndex((s) => s.id === service.id);
  if (idx >= 0) {
    services[idx] = service;
  } else {
    services.push(service);
  }
  set(KEYS.SERVICES, services);
  return service;
}

export function deleteService(id) {
  const services = getServices().filter((s) => s.id !== id);
  set(KEYS.SERVICES, services);
}

// Signature
export function getSignature() {
  return localStorage.getItem(KEYS.SIGNATURE) || null;
}

export function saveSignature(base64DataUrl) {
  if (base64DataUrl) {
    localStorage.setItem(KEYS.SIGNATURE, base64DataUrl);
  } else {
    localStorage.removeItem(KEYS.SIGNATURE);
  }
}

// Generate next invoice number
export function getNextInvoiceNumber() {
  const settings = getSettings();
  const num = String(settings.nextInvoiceNumber).padStart(3, '0');
  return `${settings.invoicePrefix}${num}`;
}

export function incrementInvoiceNumber() {
  const settings = getSettings();
  settings.nextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;
  saveSettings(settings);
}
