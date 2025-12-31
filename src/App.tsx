// RedMist Racing Dashboard - Main Application

import { useEffect, useState } from 'react';
import { useAuthStore, useEventsStore } from './store';
import { Layout, AuthForm, EventList, TimingScreen } from './components';
import { isSupabaseEnabled } from './lib/supabase';

function App() {
  const { isAuthenticated, isLoading, setCredentials, clientId, clientSecret } = useAuthStore();
  const { clearSelectedEvent } = useEventsStore();
  const [currentView, setCurrentView] = useState<'events' | 'timing'>('events');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Log Supabase status on mount
  useEffect(() => {
    console.log('[App] Supabase enabled:', isSupabaseEnabled());
  }, []);

  // Auto-authenticate on mount if credentials are available from env
  useEffect(() => {
    const autoLogin = async () => {
      if (!isAuthenticated && !isLoading && !autoLoginAttempted && clientId && clientSecret) {
        setAutoLoginAttempted(true);
        try {
          console.log('[App] Auto-authenticating with env credentials...');
          await setCredentials(clientId, clientSecret);
          console.log('[App] Auto-authentication successful');
        } catch (error) {
          console.log('[App] Auto-authentication failed:', error);
        }
      }
    };
    autoLogin();
  }, [isAuthenticated, isLoading, autoLoginAttempted, clientId, clientSecret, setCredentials]);

  // Handle event selection
  const handleEventSelect = (eventId: number) => {
    setSelectedId(eventId);
    setCurrentView('timing');
  };

  // Handle going back to events
  const handleBack = () => {
    setSelectedId(null);
    clearSelectedEvent();
    setCurrentView('events');
  };

  // Still loading or attempting auto-login - show loading
  if (isLoading || (!isAuthenticated && !autoLoginAttempted && clientId && clientSecret)) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <img src="/favicon.svg" alt="RedMist" style={{ width: 48, height: 48 }} />
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-red)' }}>REDMIST</span>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Connecting...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <AuthForm />;
  }

  // Main dashboard
  return (
    <Layout>
      {currentView === 'events' && (
        <EventList onEventSelect={handleEventSelect} />
      )}
      {currentView === 'timing' && selectedId && (
        <TimingScreen eventId={selectedId} onBack={handleBack} />
      )}
    </Layout>
  );
}

export default App;
