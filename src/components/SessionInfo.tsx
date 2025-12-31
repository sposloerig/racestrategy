// Session Information Bar Component

import type { SessionState } from '../types/redmist';
import { 
  Clock, 
  Flag, 
  Timer, 
  Hash,
  TrendingUp,
  Gauge,
} from 'lucide-react';

interface SessionInfoProps {
  session: SessionState;
}

export function SessionInfo({ session }: SessionInfoProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '0.75rem 1rem',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        overflowX: 'auto',
      }}
    >
      {/* Session Name */}
      <InfoItem
        icon={<Flag size={14} />}
        label="Session"
        value={session.sessionName || 'Unknown'}
        primary
      />

      {/* Time/Laps Remaining */}
      {session.timeToGo && (
        <InfoItem
          icon={<Timer size={14} />}
          label="Time Remaining"
          value={session.timeToGo}
          highlight={isTimeWarning(session.timeToGo)}
        />
      )}

      {session.lapsToGo > 0 && (
        <InfoItem
          icon={<Hash size={14} />}
          label="Laps To Go"
          value={session.lapsToGo.toString()}
          highlight={session.lapsToGo <= 5}
        />
      )}

      {/* Running Race Time */}
      {session.runningRaceTime && (
        <InfoItem
          icon={<Clock size={14} />}
          label="Race Time"
          value={session.runningRaceTime}
        />
      )}

      {/* Local Time */}
      {session.localTimeOfDay && (
        <InfoItem
          icon={<Clock size={14} />}
          label="Local Time"
          value={session.localTimeOfDay}
        />
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Race Stats */}
      {session.greenLaps != null && (
        <StatItem label="Green Laps" value={session.greenLaps} color="#00ff00" />
      )}
      
      {session.yellowLaps != null && (
        <StatItem label="Yellow Laps" value={session.yellowLaps} color="#ffff00" />
      )}

      {session.numberOfYellows != null && session.numberOfYellows > 0 && (
        <StatItem label="Cautions" value={session.numberOfYellows} color="#ffff00" />
      )}

      {session.leadChanges != null && session.leadChanges > 0 && (
        <StatItem 
          label="Lead Changes" 
          value={session.leadChanges} 
          icon={<TrendingUp size={12} />}
        />
      )}

      {session.averageRaceSpeed && (
        <StatItem 
          label="Avg Speed" 
          value={session.averageRaceSpeed}
          icon={<Gauge size={12} />}
        />
      )}
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  primary?: boolean;
  highlight?: boolean;
}

function InfoItem({ icon, label, value, primary, highlight }: InfoItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.125rem',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.625rem',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontFamily: primary ? 'var(--font-sans)' : 'var(--font-mono)',
          fontSize: primary ? '0.9375rem' : '0.875rem',
          fontWeight: primary ? 600 : 500,
          color: highlight ? 'var(--accent-yellow)' : 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}

function StatItem({ label, value, color, icon }: StatItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.625rem',
        background: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
      }}
    >
      {icon && (
        <span style={{ color: color || 'var(--text-secondary)' }}>
          {icon}
        </span>
      )}
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: color || 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Check if time remaining is in warning zone (< 10 minutes)
function isTimeWarning(timeStr: string): boolean {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    return minutes < 10;
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours === 0 && minutes < 10;
  }
  return false;
}

