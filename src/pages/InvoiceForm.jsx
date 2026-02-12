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
} from '../utils/storage';
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

function createNewInvoice(settings) {
  return {
    id: generateId(),
    invoiceNo: getNextInvoiceNumber(),
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

  useEffect(() => {
    const settings = getSettings();
    setClients(getClients());
    setServices(getServices());
    setSignature(getSignature());

    if (isEditing) {
      const existing = getInvoiceById(id);
      if (existing) {
        if (isDuplicating) {
          setInvoice({
            ...existing,
            id: generateId(),
            invoiceNo: getNextInvoiceNumber(),
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
      setInvoice(createNewInvoice(settings));
    }
  }, [id, isEditing, isDuplicating, navigate]);

  const currency = useMemo(
    () => (invoice ? getCurrencyByCode(invoice.currency) : CURRENCIES[0]),
    [invoice?.currency]
  );

  if (!invoice) return null;

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

  const handleSaveNewClient = () => {
    if (!newClient.name.trim()) return;
    const client = { ...newClient, id: generateId() };
    saveClient(client);
    setClients((prev) => [...prev, client]);
    setInvoice((prev) => ({
      ...prev,
      client: { name: client.name, address: client.address, country: client.country },
    }));
    setNewClient({ name: '', address: '', country: '' });
    setShowNewClient(false);
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

  const handleSaveNewService = () => {
    if (!newService.name.trim()) return;
    const service = { ...newService, id: generateId() };
    saveService(service);
    setServices((prev) => [...prev, service]);
    setNewService({ name: '', sacCode: '' });
    setShowNewService(false);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      saveSignature(base64);
      setSignature(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = () => {
    saveSignature(null);
    setSignature(null);
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

  const handleSave = () => {
    const isNew = !isEditing || isDuplicating;
    saveInvoice(invoice);
    if (isNew) {
      incrementInvoiceNumber();
    }
    navigate(`/invoice/${invoice.id}/preview`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>{isEditing && !isDuplicating ? 'Edit Invoice' : 'New Invoice'}</h2>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save & Preview</button>
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
        <button className="btn btn-primary" onClick={handleSave}>Save & Preview</button>
      </div>
    </div>
  );
}
