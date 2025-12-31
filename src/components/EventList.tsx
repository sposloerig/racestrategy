// Event List Component - Shows live and recent events

import { useEffect } from 'react';
import { useEventsStore, useSessionStore } from '../store';
import type { EventListSummary } from '../types/redmist';
import { 
  Calendar, 
  MapPin, 
  Radio, 
  ChevronRight, 
  RefreshCw,
  Clock,
  Building2,
} from 'lucide-react';

interface EventListProps {
  onEventSelect: (eventId: number) => void;
}

export function EventList({ onEventSelect }: EventListProps) {
  const { 
    liveEvents, 
    recentEvents, 
    isLoading, 
    error, 
    fetchLiveAndRecentEvents,
    selectedEventId,
  } = useEventsStore();
  const { isConnected } = useSessionStore();

  useEffect(() => {
    fetchLiveAndRecentEvents();
  }, [fetchLiveAndRecentEvents]);

  return (
    <div 
      style={{ 
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 
            style={{ 
              fontSize: '1.75rem', 
              fontWeight: 700,
              marginBottom: '0.25rem',
            }}
          >
            Racing Events
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Connect to live events or view recent results
          </p>
        </div>
        
        <button 
          className="btn btn-secondary"
          onClick={() => fetchLiveAndRecentEvents()}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div 
          style={{ 
            padding: '1rem',
            marginBottom: '1rem',
            background: 'rgba(255, 59, 59, 0.1)',
            border: '1px solid rgba(255, 59, 59, 0.3)',
            borderRadius: '8px',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Live Events */}
      {liveEvents.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: 'var(--accent-green)',
            }}
          >
            <Radio size={18} />
            Live Now
            <span className="badge badge-live" style={{ marginLeft: '0.5rem' }}>
              {liveEvents.length}
            </span>
          </h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {liveEvents.map(event => (
              <EventCard 
                key={event.eid} 
                event={event} 
                onSelect={onEventSelect}
                isSelected={selectedEventId === event.eid}
                isConnected={isConnected && selectedEventId === event.eid}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <section>
          <h2 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            <Clock size={18} />
            Recent Events
          </h2>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {recentEvents.slice(0, 20).map(event => (
              <EventCard 
                key={event.eid} 
                event={event} 
                onSelect={onEventSelect}
                isSelected={selectedEventId === event.eid}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isLoading && liveEvents.length === 0 && recentEvents.length === 0 && (
        <div className="empty-state">
          <Calendar size={48} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Events Found</h3>
          <p>Check back later for live racing events</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && liveEvents.length === 0 && (
        <div className="empty-state">
          <div className="spinner" style={{ width: '32px', height: '32px' }} />
          <p style={{ marginTop: '1rem' }}>Loading events...</p>
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  event: EventListSummary;
  onSelect: (eventId: number) => void;
  isSelected?: boolean;
  isConnected?: boolean;
  compact?: boolean;
}

function EventCard({ event, onSelect, isSelected, isConnected, compact }: EventCardProps) {
  return (
    <button
      onClick={() => onSelect(event.eid)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: compact ? '0.875rem 1rem' : '1.25rem',
        background: isSelected 
          ? 'rgba(255, 59, 59, 0.1)' 
          : 'var(--bg-card)',
        border: `1px solid ${isSelected ? 'var(--accent-red)' : 'var(--border-color)'}`,
        borderRadius: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-highlight)';
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.background = 'var(--bg-card)';
        }
      }}
    >
      {/* Live indicator */}
      {event.l && (
        <div 
          style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%',
            background: 'var(--accent-green)',
            boxShadow: '0 0 8px var(--accent-green)',
            flexShrink: 0,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Event info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            marginBottom: compact ? '0.25rem' : '0.5rem',
          }}
        >
          <h3 
            style={{ 
              fontSize: compact ? '0.875rem' : '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {event.en}
          </h3>
          {event.l && (
            <span className="badge badge-live" style={{ flexShrink: 0 }}>
              LIVE
            </span>
          )}
          {isConnected && (
            <span className="badge badge-green" style={{ flexShrink: 0 }}>
              Connected
            </span>
          )}
        </div>
        
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          {event.on && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Building2 size={12} />
              {event.on}
            </span>
          )}
          {event.t && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={12} />
              {event.t}
            </span>
          )}
          {event.ed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Calendar size={12} />
              {formatDate(event.ed)}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight 
        size={20} 
        style={{ 
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      />
    </button>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

