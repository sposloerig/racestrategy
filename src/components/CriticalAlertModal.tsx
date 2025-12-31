// Critical Alert Modal - Full-screen takeover for team incidents
import { useEffect, useState, useCallback } from 'react';
import { useSessionStore, useUIStore } from '../store';
import type { ControlLogEntry } from '../types/redmist';
import { 
  AlertTriangle, 
  X, 
  Flag, 
  Volume2,
  Bell,
} from 'lucide-react';

interface CriticalAlertModalProps {
  carNumber: string;
  teamKeywords?: string[]; // Additional keywords to watch for
  onDismiss?: (entry: ControlLogEntry) => void;
}

export function CriticalAlertModal({ 
  carNumber, 
  teamKeywords = [],
  onDismiss 
}: CriticalAlertModalProps) {
  const { controlLog } = useSessionStore();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeAlert, setActiveAlert] = useState<ControlLogEntry | null>(null);
  const [lastLogLength, setLastLogLength] = useState(0);

  // Keywords that trigger critical alerts
  const criticalKeywords = [
    carNumber.toLowerCase(),
    'incident',
    'penalty',
    'black flag',
    'warning',
    'contact',
    'damage',
    'disqualified',
    'dq',
    'stop and go',
    'drive through',
    ...teamKeywords.map(k => k.toLowerCase()),
  ];

  // Check for new critical entries
  const checkForCriticalAlerts = useCallback(() => {
    if (!controlLog || controlLog.length === 0) return;
    
    // Only check new entries
    const newEntries = controlLog.slice(lastLogLength);
    
    for (const entry of newEntries) {
      // Control log entries use: n=note, c1=car1, c2=car2, a=action, s=status, t=time
      const note = (entry.n || '').toLowerCase();
      const action = (entry.a || '').toLowerCase();
      const status = (entry.s || '').toLowerCase();
      const car1 = (entry.c1 || '').toLowerCase();
      const car2 = (entry.c2 || '').toLowerCase();
      const combinedText = `${note} ${action} ${status}`;
      
      const entryId = `${entry.t}-${entry.o}`;
      
      // Skip if already dismissed
      if (dismissedIds.has(entryId)) continue;
      
      // Check if this is our car specifically (highest priority)
      const carNumLower = carNumber.toLowerCase();
      const isOurCar = car1 === carNumLower || car2 === carNumLower || 
                        car1 === `#${carNumLower}` || car2 === `#${carNumLower}`;
      
      // Check for critical keywords in the combined text
      const isCritical = criticalKeywords.some(keyword => combinedText.includes(keyword));
      
      if (isOurCar && isCritical) {
        setActiveAlert({ ...entry, __id: entryId } as ControlLogEntry & { __id: string });
        break;
      }
    }
    
    setLastLogLength(controlLog.length);
  }, [controlLog, lastLogLength, carNumber, criticalKeywords, dismissedIds]);

  useEffect(() => {
    checkForCriticalAlerts();
  }, [checkForCriticalAlerts]);

  const handleDismiss = () => {
    if (activeAlert) {
      const entryId = (activeAlert as ControlLogEntry & { __id?: string }).__id || 
        `${activeAlert.t || activeAlert.timestamp}-${(activeAlert.m || activeAlert.message || '').slice(0, 20)}`;
      setDismissedIds(prev => new Set(prev).add(entryId));
      onDismiss?.(activeAlert);
    }
    setActiveAlert(null);
  };

  // Play alert sound effect (browser audio)
  useEffect(() => {
    if (activeAlert) {
      // Try to play a beep sound
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (e) {
        // Audio not supported or blocked
        console.log('Audio alert not available');
      }
    }
  }, [activeAlert]);

  if (!activeAlert) return null;

  // Build display message from control log entry properties
  const note = activeAlert.n || '';
  const action = activeAlert.a || '';
  const status = activeAlert.s || '';
  const corner = activeAlert.cor || '';
  const car1 = activeAlert.c1 || '';
  const car2 = activeAlert.c2 || '';
  
  // Create a readable message
  const message = [
    note,
    action && `Action: ${action}`,
    status && `Status: ${status}`,
  ].filter(Boolean).join(' • ') || 'Alert';
  
  const carsInvolved = car2 ? `${car1} & ${car2}` : car1;
  const location = corner ? `@ Turn ${corner}` : '';
  
  const timestamp = activeAlert.t || '';
  
  const combinedText = `${note} ${action} ${status}`.toLowerCase();
  const isPenalty = combinedText.includes('penalty') || 
                    combinedText.includes('black flag') ||
                    combinedText.includes('disqualified');
  const isIncident = combinedText.includes('incident') ||
                     combinedText.includes('contact') ||
                     combinedText.includes('spin') ||
                     combinedText.includes('off track');

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'pulse-bg 1s ease-in-out infinite',
      }}
      onClick={handleDismiss}
    >
      <style>
        {`
          @keyframes pulse-bg {
            0%, 100% { background: rgba(255, 0, 0, 0.15); }
            50% { background: rgba(255, 0, 0, 0.25); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          @keyframes pulse-icon {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}
      </style>
      
      <div 
        style={{
          background: isPenalty 
            ? 'linear-gradient(135deg, #1a0000, #330000)'
            : 'linear-gradient(135deg, #1a1a00, #333300)',
          borderRadius: '16px',
          padding: '2rem 3rem',
          maxWidth: '600px',
          width: '90%',
          boxShadow: `0 0 60px ${isPenalty ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 200, 0, 0.5)'}`,
          border: `2px solid ${isPenalty ? '#ff3333' : '#ffcc00'}`,
          animation: 'shake 0.5s ease-in-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ animation: 'pulse-icon 0.5s ease-in-out infinite' }}>
              {isPenalty ? (
                <Flag size={40} style={{ color: '#ff3333' }} />
              ) : (
                <AlertTriangle size={40} style={{ color: '#ffcc00' }} />
              )}
            </div>
            <div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: isPenalty ? '#ff6666' : '#ffdd66',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}>
                {isPenalty ? 'PENALTY ALERT' : isIncident ? 'INCIDENT ALERT' : 'TEAM ALERT'}
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 700,
                color: '#ffffff',
              }}>
                Car #{carNumber}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Alert message */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          {/* Cars and location */}
          {(carsInvolved || location) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.8)',
            }}>
              {carsInvolved && <span style={{ fontWeight: 600 }}>{carsInvolved}</span>}
              {location && <span>{location}</span>}
            </div>
          )}
          
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 500,
            color: '#ffffff',
            lineHeight: 1.5,
          }}>
            {message}
          </div>
          
          {timestamp && (
            <div style={{
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
            }}>
              {timestamp}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: '1rem 1.5rem',
              background: isPenalty ? '#ff3333' : '#ffcc00',
              color: isPenalty ? '#ffffff' : '#000000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Bell size={18} />
            Acknowledge
          </button>
        </div>

        {/* Dismiss hint */}
        <div style={{
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          Click anywhere outside to dismiss
        </div>
      </div>
    </div>
  );
}

// Hook for using critical alerts in components
export function useCriticalAlerts(carNumber: string) {
  const { controlLog } = useSessionStore();
  const [lastCheckedIndex, setLastCheckedIndex] = useState(0);
  const [newAlerts, setNewAlerts] = useState<ControlLogEntry[]>([]);

  useEffect(() => {
    if (!controlLog || controlLog.length === 0) return;
    
    const carLower = carNumber.toLowerCase();
    const criticalKeywords = ['incident', 'penalty', 'black flag', 'warning', 'contact', 'spin', 'off track'];
    
    // Check only new entries
    const newEntries = controlLog.slice(lastCheckedIndex);
    const alerts = newEntries.filter(entry => {
      // Control log entries use: n=note, c1=car1, c2=car2, a=action, s=status
      const note = (entry.n || '').toLowerCase();
      const action = (entry.a || '').toLowerCase();
      const status = (entry.s || '').toLowerCase();
      const car1 = (entry.c1 || '').toLowerCase();
      const car2 = (entry.c2 || '').toLowerCase();
      const combinedText = `${note} ${action} ${status}`;
      
      // Check if our car is involved
      const hasOurCar = car1 === carLower || car2 === carLower ||
                        car1 === `#${carLower}` || car2 === `#${carLower}`;
      
      // Check for critical keywords
      const hasCritical = criticalKeywords.some(k => combinedText.includes(k));
      
      return hasOurCar && hasCritical;
    });
    
    if (alerts.length > 0) {
      setNewAlerts(prev => [...prev, ...alerts]);
    }
    
    setLastCheckedIndex(controlLog.length);
  }, [controlLog, carNumber, lastCheckedIndex]);

  const clearAlert = (index: number) => {
    setNewAlerts(prev => prev.filter((_, i) => i !== index));
  };

  return { alerts: newAlerts, clearAlert };
}

