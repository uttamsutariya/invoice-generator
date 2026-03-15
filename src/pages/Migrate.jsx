import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const LS_KEYS = {
  INVOICES: 'invoice-tracker-invoices',
  SETTINGS: 'invoice-tracker-settings',
  CLIENTS: 'invoice-tracker-clients',
  SERVICES: 'invoice-tracker-services',
  SIGNATURE: 'invoice-tracker-signature',
};

function readLS(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export default function Migrate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]);

  const invoices = readLS(LS_KEYS.INVOICES) || [];
  const clients = readLS(LS_KEYS.CLIENTS) || [];
  const services = readLS(LS_KEYS.SERVICES) || [];
  const settings = readLS(LS_KEYS.SETTINGS);
  const signature = localStorage.getItem(LS_KEYS.SIGNATURE) || null;

  const addLog = (msg) => setLog((prev) => [...prev, msg]);

  const handleMigrate = async () => {
    setStatus('running');
    setLog([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addLog('ERROR: Not logged in. Please log in first.');
        setStatus('error');
        return;
      }
      const userId = user.id;
      addLog(`Authenticated as ${user.email}`);

      // 1. Migrate settings
      if (settings) {
        addLog('Migrating settings...');
        const { error } = await supabase.from('settings').upsert({
          user_id: userId,
          company_name: settings.companyName || '',
          address: settings.address || '',
          gstin: settings.gstin || '',
          state: settings.state || 'GUJARAT',
          state_code: settings.stateCode || '24',
          pan_iec: settings.panIec || '',
          bank_name: settings.bankName || '',
          bank_branch: settings.bankBranch || '',
          bank_account: settings.bankAccount || '',
          bank_ifsc: settings.bankIfsc || '',
          invoice_prefix: settings.invoicePrefix || 'EX/',
          next_invoice_number: settings.nextInvoiceNumber || 1,
          lut_bond_no: settings.lutBondNo || '',
          lut_from: settings.lutFrom || null,
          lut_to: settings.lutTo || null,
          signature: signature || null,
        }, { onConflict: 'user_id' });
        if (error) throw new Error('Settings: ' + error.message);
        addLog('Settings migrated (including signature)');
      } else {
        addLog('No settings found in localStorage, skipping');
      }

      // 2. Migrate clients
      addLog(`Migrating ${clients.length} clients...`);
      const clientIdMap = {};
      for (const client of clients) {
        const { data, error } = await supabase.from('clients').insert({
          user_id: userId,
          name: client.name,
          address: client.address || '',
          country: client.country || '',
        }).select().single();
        if (error) throw new Error('Client "' + client.name + '": ' + error.message);
        clientIdMap[client.id] = data.id;
        addLog(`  Client: ${client.name}`);
      }

      // 3. Migrate services
      addLog(`Migrating ${services.length} services...`);
      for (const service of services) {
        const { error } = await supabase.from('services').insert({
          user_id: userId,
          name: service.name,
          sac_code: service.sacCode || '',
        });
        if (error) throw new Error('Service "' + service.name + '": ' + error.message);
        addLog(`  Service: ${service.name}`);
      }

      // 4. Migrate invoices + line items
      addLog(`Migrating ${invoices.length} invoices...`);
      for (const inv of invoices) {
        const { data, error } = await supabase.from('invoices').insert({
          user_id: userId,
          invoice_no: inv.invoiceNo || '',
          invoice_date: inv.invoiceDate || null,
          date_of_supply: inv.dateOfSupply || null,
          place_of_supply: inv.placeOfSupply || '',
          lut_bond_no: inv.lutBondNo || '',
          lut_from: inv.lutFrom || null,
          lut_to: inv.lutTo || null,
          state: inv.state || '',
          state_code: inv.stateCode || '',
          currency: inv.currency || 'USD',
          conversion_rate: inv.conversionRate || 0,
          client_name: inv.client?.name || '',
          client_address: inv.client?.address || '',
          client_country: inv.client?.country || '',
          company: inv.company || {},
        }).select().single();
        if (error) throw new Error('Invoice "' + inv.invoiceNo + '": ' + error.message);

        // Insert line items
        const lineItems = (inv.lineItems || []).map((item, idx) => ({
          invoice_id: data.id,
          description: item.description || '',
          details: item.details || '',
          sac_code: item.sacCode || '',
          amount: item.amount || 0,
          igst_rate: item.igstRate || 0,
          sort_order: idx,
        }));
        if (lineItems.length > 0) {
          const { error: liError } = await supabase.from('invoice_line_items').insert(lineItems);
          if (liError) throw new Error('Line items for "' + inv.invoiceNo + '": ' + liError.message);
        }
        addLog(`  Invoice: ${inv.invoiceNo} (${(inv.lineItems || []).length} line items)`);
      }

      addLog('');
      addLog('Migration complete! You can now remove the /migrate route from App.jsx.');
      setStatus('done');
    } catch (err) {
      addLog('ERROR: ' + err.message);
      setStatus('error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Migrate from localStorage</h2>
        <button className="btn" onClick={() => navigate('/')}>Back</button>
      </div>

      <fieldset>
        <legend>Found in localStorage</legend>
        <table className="summary-table">
          <tbody>
            <tr><td>Settings</td><td>{settings ? 'Yes' : 'None'}</td></tr>
            <tr><td>Signature</td><td>{signature ? 'Yes' : 'None'}</td></tr>
            <tr><td>Clients</td><td>{clients.length}</td></tr>
            <tr><td>Services</td><td>{services.length}</td></tr>
            <tr><td>Invoices</td><td>{invoices.length}</td></tr>
          </tbody>
        </table>
      </fieldset>

      {status === 'idle' && (
        <button className="btn btn-primary" onClick={handleMigrate} style={{ marginTop: '16px' }}>
          Start Migration
        </button>
      )}

      {status === 'running' && (
        <p style={{ marginTop: '16px', fontWeight: 'bold' }}>Migrating... please wait.</p>
      )}

      {log.length > 0 && (
        <fieldset style={{ marginTop: '16px' }}>
          <legend>Log</legend>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85em', maxHeight: '400px', overflow: 'auto' }}>
            {log.join('\n')}
          </pre>
        </fieldset>
      )}

      {status === 'done' && (
        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '16px' }}>
          Go to Dashboard
        </button>
      )}
    </div>
  );
}
