// Control Log Component - Race control decisions and penalties

import type { ControlLogEntry } from '../types/redmist';
import { 
  AlertTriangle, 
  Clock, 
  User,
  FileText,
  Flag,
} from 'lucide-react';

interface ControlLogProps {
  entries: ControlLogEntry[];
}

export function ControlLog({ entries }: ControlLogProps) {
  // Sort entries by order (most recent first)
  const sortedEntries = [...entries].sort((a, b) => b.o - a.o);

  if (entries.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '3rem' }}>
        <FileText size={48} />
        <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>No Control Log Entries</h3>
        <p>Race control decisions and penalties will appear here</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sortedEntries.map((entry, index) => (
          <ControlLogItem key={`${entry.o}-${index}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

interface ControlLogItemProps {
  entry: ControlLogEntry;
}

function ControlLogItem({ entry }: ControlLogItemProps) {
  const time = formatTime(entry.t);
  const isHighlighted = entry.c1h || entry.c2h;
  const hasAction = entry.a && entry.a.toLowerCase() !== 'none';
  
  // Determine severity/type based on content
  const severity = getSeverity(entry);

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        padding: '0.875rem 1rem',
        background: isHighlighted ? 'rgba(255, 59, 59, 0.1)' : 'var(--bg-card)',
        border: `1px solid ${isHighlighted ? 'var(--accent-red)' : 'var(--border-color)'}`,
        borderRadius: '8px',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Severity indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: '0.125rem',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: severity.background,
          }}
        >
          {severity.icon}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.375rem',
          }}
        >
          {/* Time */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Clock size={12} />
            {time}
          </span>

          {/* Cars involved */}
          {(entry.c1 || entry.c2) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              {entry.c1 && (
                <CarBadge 
                  number={entry.c1} 
                  highlighted={entry.c1h} 
                />
              )}
              {entry.c1 && entry.c2 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  &
                </span>
              )}
              {entry.c2 && (
                <CarBadge 
                  number={entry.c2} 
                  highlighted={entry.c2h} 
                />
              )}
            </div>
          )}

          {/* Corner */}
          {entry.cor && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              @ {entry.cor}
            </span>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Status */}
          {entry.s && (
            <span
              className={`badge ${getStatusBadgeClass(entry.s)}`}
            >
              {entry.s}
            </span>
          )}
        </div>

        {/* Note/Description */}
        {entry.n && (
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              marginBottom: hasAction ? '0.5rem' : 0,
              lineHeight: 1.5,
            }}
          >
            {entry.n}
          </p>
        )}

        {/* Action */}
        {hasAction && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.625rem',
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--accent-yellow)',
            }}
          >
            <Flag size={12} />
            {entry.a}
          </div>
        )}

        {/* Official */}
        {entry.on && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginTop: '0.5rem',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            <User size={10} />
            {entry.on}
          </div>
        )}
      </div>
    </div>
  );
}

interface CarBadgeProps {
  number: string;
  highlighted?: boolean;
}

function CarBadge({ number, highlighted }: CarBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.375rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        background: highlighted ? 'var(--accent-red)' : 'var(--bg-tertiary)',
        color: highlighted ? '#fff' : 'var(--text-primary)',
        borderRadius: '4px',
      }}
    >
      #{number}
    </span>
  );
}

interface Severity {
  icon: React.ReactNode;
  background: string;
}

function getSeverity(entry: ControlLogEntry): Severity {
  const note = entry.n?.toLowerCase() || '';
  const action = entry.a?.toLowerCase() || '';
  
  // Penalties
  if (action.includes('penalty') || action.includes('black flag') || note.includes('penalty')) {
    return {
      icon: <Flag size={14} style={{ color: '#ff0000' }} />,
      background: 'rgba(255, 0, 0, 0.15)',
    };
  }
  
  // Warnings
  if (action.includes('warning') || note.includes('warning') || note.includes('track limits')) {
    return {
      icon: <AlertTriangle size={14} style={{ color: '#ffff00' }} />,
      background: 'rgba(255, 255, 0, 0.15)',
    };
  }
  
  // Contact/Incident
  if (note.includes('contact') || note.includes('incident') || note.includes('off track')) {
    return {
      icon: <AlertTriangle size={14} style={{ color: '#ff8800' }} />,
      background: 'rgba(255, 136, 0, 0.15)',
    };
  }
  
  // Default info
  return {
    icon: <FileText size={14} style={{ color: 'var(--text-secondary)' }} />,
    background: 'var(--bg-tertiary)',
  };
}

function getStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('resolved')) return 'badge-green';
  if (s.includes('pending') || s.includes('under investigation')) return 'badge-yellow';
  if (s.includes('active')) return 'badge-red';
  return '';
}

function formatTime(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return timeStr;
  }
}

