import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import InvoiceForm from './pages/InvoiceForm';
import InvoicePreview from './pages/InvoicePreview';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="app-header-inner">
          <h1 onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            Invoice Tracker
          </h1>
        </div>
      </header>
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
    </div>
  );
}
