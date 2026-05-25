import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <SocketProvider>{children}</SocketProvider>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/" element={<Protected><Chat /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
