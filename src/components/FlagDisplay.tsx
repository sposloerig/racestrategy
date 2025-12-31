// Flag Display Component

import { Flags, getFlagName } from '../types/redmist';
import { AlertTriangle, CheckCircle2, Flag, StopCircle } from 'lucide-react';

interface FlagDisplayProps {
  flag: Flags;
}

export function FlagDisplay({ flag }: FlagDisplayProps) {
  if (flag === Flags.None) {
    return null;
  }

  const flagConfig = getFlagConfig(flag);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.5rem',
        background: flagConfig.background,
        borderBottom: `3px solid ${flagConfig.borderColor}`,
        animation: flagConfig.animation,
      }}
    >
      {flagConfig.icon}
      <span
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: flagConfig.textColor,
        }}
      >
        {getFlagName(flag)}
      </span>
    </div>
  );
}

interface FlagConfig {
  background: string;
  textColor: string;
  borderColor: string;
  icon: React.ReactNode;
  animation?: string;
}

function getFlagConfig(flag: Flags): FlagConfig {
  switch (flag) {
    case Flags.Green:
      return {
        background: 'linear-gradient(90deg, rgba(0, 255, 0, 0.15) 0%, rgba(0, 255, 0, 0.05) 100%)',
        textColor: '#00ff00',
        borderColor: '#00ff00',
        icon: <Flag size={20} fill="#00ff00" color="#00ff00" />,
      };
    
    case Flags.Yellow:
      return {
        background: 'linear-gradient(90deg, rgba(255, 255, 0, 0.2) 0%, rgba(255, 255, 0, 0.05) 100%)',
        textColor: '#ffff00',
        borderColor: '#ffff00',
        icon: <AlertTriangle size={20} fill="#ffff00" color="#000" />,
        animation: 'pulse 1s ease-in-out infinite',
      };
    
    case Flags.Red:
      return {
        background: 'linear-gradient(90deg, rgba(255, 0, 0, 0.25) 0%, rgba(255, 0, 0, 0.1) 100%)',
        textColor: '#ff0000',
        borderColor: '#ff0000',
        icon: <StopCircle size={20} fill="#ff0000" color="#000" />,
        animation: 'pulse 0.5s ease-in-out infinite',
      };
    
    case Flags.White:
      return {
        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
        textColor: '#ffffff',
        borderColor: '#ffffff',
        icon: <Flag size={20} fill="#ffffff" color="#ffffff" />,
      };
    
    case Flags.Checkered:
      return {
        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.1) 50%, rgba(255, 255, 255, 0.1) 100%)',
        textColor: '#ffffff',
        borderColor: '#888888',
        icon: <CheckCircle2 size={20} color="#ffffff" />,
      };
    
    case Flags.Black:
      return {
        background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 100%)',
        textColor: '#ffffff',
        borderColor: '#000000',
        icon: <Flag size={20} fill="#000000" color="#ffffff" />,
      };
    
    case Flags.Blue:
      return {
        background: 'linear-gradient(90deg, rgba(0, 0, 255, 0.2) 0%, rgba(0, 0, 255, 0.05) 100%)',
        textColor: '#4444ff',
        borderColor: '#0000ff',
        icon: <Flag size={20} fill="#0000ff" color="#0000ff" />,
      };
    
    default:
      return {
        background: 'var(--bg-tertiary)',
        textColor: 'var(--text-secondary)',
        borderColor: 'var(--border-color)',
        icon: <Flag size={20} />,
      };
  }
}

// Compact flag indicator for use in rows/cards
export function FlagBadge({ flag }: { flag: Flags }) {
  if (flag === Flags.None) return null;

  const colors: Record<Flags, { bg: string; text: string }> = {
    [Flags.None]: { bg: 'transparent', text: 'transparent' },
    [Flags.Green]: { bg: 'rgba(0, 255, 0, 0.2)', text: '#00ff00' },
    [Flags.Yellow]: { bg: 'rgba(255, 255, 0, 0.2)', text: '#ffff00' },
    [Flags.Red]: { bg: 'rgba(255, 0, 0, 0.2)', text: '#ff0000' },
    [Flags.White]: { bg: 'rgba(255, 255, 255, 0.2)', text: '#ffffff' },
    [Flags.Checkered]: { bg: 'rgba(128, 128, 128, 0.2)', text: '#888888' },
    [Flags.Black]: { bg: 'rgba(0, 0, 0, 0.5)', text: '#ffffff' },
    [Flags.Blue]: { bg: 'rgba(0, 0, 255, 0.2)', text: '#4444ff' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.375rem',
        fontSize: '0.625rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        borderRadius: '3px',
        background: colors[flag].bg,
        color: colors[flag].text,
      }}
    >
      {getFlagName(flag).split(' ')[0]}
    </span>
  );
}

