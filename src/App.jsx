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
