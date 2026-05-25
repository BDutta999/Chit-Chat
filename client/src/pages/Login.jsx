import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      nav('/', { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to continue</p>
        {err && <div className="error">{err}</div>}
        <label>Email
          <input type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required minLength={6} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="auth-foot">
          New here? <Link to="/register">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
