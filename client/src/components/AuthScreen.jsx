import { useState } from 'react';
import { authApi } from '../api.js';

// Sign-in / sign-up screen shown to unauthenticated users instead of the app.
export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = isSignup
        ? await authApi.signup(email, password)
        : await authApi.login(email, password);
      onAuth(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setError(null);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <img className="brand-logo" src="/logo.png" alt="Car Parts Inventory logo" width="40" height="40" />
          </span>
          <h1>Car Parts Inventory</h1>
        </div>

        <h2 className="auth-title">{isSignup ? 'Create your account' : 'Sign in'}</h2>

        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 8 : undefined}
            />
            {isSignup && <span className="muted small">At least 8 characters.</span>}
          </label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <p className="auth-switch muted small">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="link-btn" onClick={switchMode}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
