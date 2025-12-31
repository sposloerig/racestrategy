// Authentication Form Component

import { useState } from 'react';
import { useAuthStore } from '../store';
import { Gauge, Key, Lock, AlertCircle, CheckCircle } from 'lucide-react';

export function AuthForm() {
  const { setCredentials, isLoading, error, clientId: savedClientId, clientSecret: savedClientSecret } = useAuthStore();
  const [clientId, setClientId] = useState(savedClientId);
  const [clientSecret, setClientSecret] = useState(savedClientSecret);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!clientId.trim() || !clientSecret.trim()) {
      setLocalError('Please enter both Client ID and Client Secret');
      return;
    }

    try {
      await setCredentials(clientId.trim(), clientSecret.trim());
    } catch {
      // Error is handled by the store
    }
  };

  const displayError = localError || error;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(255, 59, 59, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(255, 59, 59, 0.1) 0%, transparent 50%),
          var(--bg-primary)
        `,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2.5rem',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <Gauge size={40} style={{ color: 'var(--accent-red)' }} />
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, var(--accent-red) 0%, #ff6b6b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              REDMIST
            </span>
          </div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            Racing Dashboard - Connect to your timing data
          </p>
        </div>

        {/* Form Card */}
        <div
          className="card glow-red"
          style={{
            padding: '2rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Key size={20} style={{ color: 'var(--accent-red)' }} />
            API Authentication
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="clientId"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                Client ID
              </label>
              <input
                type="text"
                id="clientId"
                className="input"
                placeholder="relay-myorg"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="clientSecret"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                Client Secret
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="password"
                  id="clientSecret"
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="••••••••••••••••"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {displayError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  background: 'rgba(255, 59, 59, 0.1)',
                  border: '1px solid rgba(255, 59, 59, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--accent-red)',
                  fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                <span>{displayError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.875rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
              }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px' }} />
                  Authenticating...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Connect to RedMist
                </>
              )}
            </button>
          </form>
        </div>

        {/* Help text */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ marginBottom: '0.5rem' }}>
            Get your API credentials from your organization settings
          </p>
          <a
            href="https://docs.redmist.racing/articles/authentication.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent-red)',
              textDecoration: 'none',
            }}
          >
            View authentication documentation →
          </a>
        </div>
      </div>
    </div>
  );
}

