// Main Layout Component

import type { ReactNode } from 'react';
import { useAuthStore, useSessionStore, useEventsStore } from '../store';
import { 
  Gauge, 
  LogOut, 
  Radio, 
  Calendar,
  Settings,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, clearCredentials } = useAuthStore();
  const { connectionState, isConnected, lastUpdate } = useSessionStore();
  const { selectedEvent } = useEventsStore();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header 
        style={{ 
          background: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div 
          style={{ 
            maxWidth: '1920px', 
            margin: '0 auto', 
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gauge 
                size={28} 
                style={{ color: 'var(--accent-red)' }}
              />
              <span 
                style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, var(--accent-red) 0%, #ff6b6b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                REDMIST
              </span>
              <span 
                style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}
              >
                DASHBOARD
              </span>
            </div>
            
            {/* Breadcrumb */}
            {selectedEvent && (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                }}
              >
                <ChevronRight size={16} />
                <span>{selectedEvent.n}</span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Connection status */}
            {isAuthenticated && (
              <div className="connection-status">
                <div className={`connection-dot ${connectionState}`} />
                <span>
                  {connectionState === 'connected' && 'Live'}
                  {connectionState === 'connecting' && 'Connecting...'}
                  {connectionState === 'reconnecting' && 'Reconnecting...'}
                  {connectionState === 'disconnected' && 'Disconnected'}
                </span>
                {isConnected && lastUpdate && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                    Updated {formatTimeAgo(lastUpdate)}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-ghost" title="Settings">
                <Settings size={18} />
              </button>
              
              {isAuthenticated && (
                <button 
                  className="btn btn-ghost" 
                  onClick={clearCredentials}
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      {/* Footer */}
      <footer 
        style={{ 
          background: 'var(--bg-secondary)', 
          borderTop: '1px solid var(--border-color)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>© 2025 RedMist Racing Dashboard</span>
          <a 
            href="https://docs.redmist.racing" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-red)', textDecoration: 'none' }}
          >
            API Docs
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={12} />
          <span>Powered by RedMist Timing & Scoring</span>
        </div>
      </footer>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Quick Navigation Sidebar
export function Sidebar() {
  return (
    <aside 
      style={{
        width: '240px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: '1rem 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <nav style={{ flex: 1 }}>
        <SidebarItem icon={<Gauge size={18} />} label="Live Timing" active />
        <SidebarItem icon={<Calendar size={18} />} label="Events" />
        <SidebarItem icon={<Radio size={18} />} label="In-Car Mode" />
      </nav>
    </aside>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

function SidebarItem({ icon, label, active }: SidebarItemProps) {
  return (
    <button
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        background: active ? 'var(--bg-hover)' : 'transparent',
        border: 'none',
        borderLeft: active ? '3px solid var(--accent-red)' : '3px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

