'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      body: form,
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = '/admin';
      return;
    }

    setError('Invalid email or password.');
  }

  return (
    <main className="admin-shell">
      <section className="login-card">
        <div className="login-kicker">HustlePathDaily Admin</div>
        <h1>Sign in</h1>
        <p className="login-subtitle">Manage drafts, reviews, and publishing.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>

          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
    </main>
  );
}
