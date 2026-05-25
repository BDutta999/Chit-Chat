import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      nav('/', { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <p className="muted">It only takes a minute</p>
        {err && <div className="error">{err}</div>}
        <label>Name
          <input required minLength={2} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Email
          <input type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required minLength={6} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <div className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
