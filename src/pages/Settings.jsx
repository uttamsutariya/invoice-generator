import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/storage';

export default function Settings() {
  const [form, setForm] = useState(getSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(getSettings());
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

        <button type="submit" className="btn btn-primary">
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
