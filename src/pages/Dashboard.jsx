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
