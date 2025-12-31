// Car Details Side Panel - Detailed info for selected car

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSessionStore } from '../store';
import type { CarPosition } from '../types/redmist';
import { 
  X, 
  User, 
  Car, 
  MapPin,
  Flag,
  TrendingUp,
  TrendingDown,
  Radio,
  Building2,
  Wrench,
} from 'lucide-react';

interface CarDetailsProps {
  eventId: number;
  carNumber: string;
  onClose: () => void;
}

export function CarDetails({ eventId, carNumber, onClose }: CarDetailsProps) {
  const { carPositions, sessionState, selectedCarMetadata, subscribeToInCar, inCarPayload } = useSessionStore();
  const [lapHistory, setLapHistory] = useState<CarPosition[]>([]);
  const [isLoadingLaps, setIsLoadingLaps] = useState(false);

  // Find the car in current positions
  const car = carPositions.find(c => c.n === carNumber);
  
  // Load lap history
  useEffect(() => {
    async function loadLaps() {
      if (!sessionState?.sessionId) return;
      
      setIsLoadingLaps(true);
      try {
        const laps = await api.getCarLaps(eventId, sessionState.sessionId, carNumber);
        setLapHistory(laps);
      } catch (error) {
        console.error('Failed to load lap history:', error);
      } finally {
        setIsLoadingLaps(false);
      }
    }
    
    loadLaps();
  }, [eventId, carNumber, sessionState?.sessionId]);

  // Subscribe to in-car updates
  const handleInCarMode = () => {
    subscribeToInCar(eventId, carNumber);
  };

  return (
    <div
      style={{
        width: '340px',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: car?.class 
                ? sessionState?.classColors?.[car.class] || 'var(--accent-red)'
                : 'var(--accent-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#000',
            }}
          >
            {carNumber}
          </div>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
              Car #{carNumber}
            </h3>
            {car?.dn && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {car.dn}
              </p>
            )}
          </div>
        </div>
        
        <button 
          className="btn btn-ghost" 
          onClick={onClose}
          style={{ padding: '0.375rem' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {/* Quick Actions */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleInCarMode}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Radio size={16} />
            In-Car Mode
          </button>
        </div>

        {/* Current Status */}
        {car && (
          <Section title="Current Status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <StatCard 
                label="Position" 
                value={`P${car.ovp}`}
                subValue={car.class ? `P${car.clp} in class` : undefined}
              />
              <StatCard 
                label="Gap" 
                value={car.og || 'Leader'}
                subValue={car.od ? `+${car.od} to car ahead` : undefined}
              />
              <StatCard 
                label="Best Lap" 
                value={car.bt || '-'}
                subValue={car.bl && car.bl > 0 ? `Lap ${car.bl}` : undefined}
                highlight={car.ibt}
              />
              <StatCard 
                label="Last Lap" 
                value={car.ltm || '-'}
              />
              <StatCard 
                label="Laps" 
                value={car.ln || '0'}
              />
              <StatCard 
                label="Pit Stops" 
                value={(car.pl ?? 0).toString()}
              />
            </div>

            {/* Position Change */}
            {car.opg !== undefined && car.opg !== 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: car.opg > 0 
                    ? 'rgba(0, 255, 136, 0.1)' 
                    : 'rgba(255, 59, 59, 0.1)',
                  borderRadius: '6px',
                  color: car.opg > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {car.opg > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>
                  {car.opg > 0 ? 'Gained' : 'Lost'} {Math.abs(car.opg)} position{Math.abs(car.opg) !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* In Pit indicator */}
            {car.ip && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(0, 170, 255, 0.15)',
                  borderRadius: '6px',
                  color: 'var(--accent-blue)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                <Wrench size={16} />
                <span>Currently in pit lane</span>
              </div>
            )}
          </Section>
        )}

        {/* Competitor Metadata */}
        {selectedCarMetadata && (
          <Section title="Competitor Info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {selectedCarMetadata.fn && selectedCarMetadata.ln && (
                <InfoRow 
                  icon={<User size={14} />} 
                  label="Driver" 
                  value={`${selectedCarMetadata.fn} ${selectedCarMetadata.ln}`} 
                />
              )}
              {selectedCarMetadata.cl && (
                <InfoRow 
                  icon={<Flag size={14} />} 
                  label="Class" 
                  value={selectedCarMetadata.cl} 
                />
              )}
              {selectedCarMetadata.mk && (
                <InfoRow 
                  icon={<Car size={14} />} 
                  label="Make/Model" 
                  value={`${selectedCarMetadata.mk}${selectedCarMetadata.mo ? ' ' + selectedCarMetadata.mo : ''}`} 
                />
              )}
              {selectedCarMetadata.s && (
                <InfoRow 
                  icon={<Building2 size={14} />} 
                  label="Sponsor" 
                  value={selectedCarMetadata.s} 
                />
              )}
              {selectedCarMetadata.h && (
                <InfoRow 
                  icon={<MapPin size={14} />} 
                  label="Hometown" 
                  value={selectedCarMetadata.h} 
                />
              )}
            </div>
          </Section>
        )}

        {/* Lap History */}
        <Section title="Lap History">
          {isLoadingLaps ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <div className="spinner" />
            </div>
          ) : lapHistory.length > 0 ? (
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              <table className="timing-table" style={{ fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th style={{ textAlign: 'right' }}>Time</th>
                    <th style={{ textAlign: 'center' }}>Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {lapHistory.slice().reverse().map((lap, index) => (
                    <tr key={index}>
                      <td>{lap.ln}</td>
                      <td 
                        style={{ 
                          textAlign: 'right',
                          color: lap.ibt ? 'var(--timing-pb)' : 'inherit',
                        }}
                      >
                        {lap.ltm || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>{lap.ovp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No lap data available
            </p>
          )}
        </Section>

        {/* In-Car Payload */}
        {inCarPayload && inCarPayload.n === carNumber && (
          <Section title="In-Car Display">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <StatCard label="Position" value={`P${inCarPayload.p}`} highlight />
              <StatCard label="Overall" value={`P${inCarPayload.o}`} />
            </div>
            
            {/* Cars around */}
            {inCarPayload.c && inCarPayload.c.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <h4 
                  style={{ 
                    fontSize: '0.6875rem', 
                    fontWeight: 600, 
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Cars Around
                </h4>
                {inCarPayload.c.map((nearCar, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.375rem 0.5rem',
                      background: 'var(--bg-card)',
                      borderRadius: '4px',
                      marginBottom: '0.25rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>#{nearCar.n}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{nearCar.g}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h4
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: '0.75rem',
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}

function StatCard({ label, value, subValue, highlight }: StatCardProps) {
  return (
    <div
      style={{
        padding: '0.75rem',
        background: 'var(--bg-card)',
        borderRadius: '8px',
        border: highlight ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '0.625rem',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: highlight ? 'var(--accent-green)' : 'var(--text-primary)',
        }}
      >
        {value}
      </span>
      {subValue && (
        <span
          style={{
            display: 'block',
            fontSize: '0.6875rem',
            color: 'var(--text-secondary)',
            marginTop: '0.125rem',
          }}
        >
          {subValue}
        </span>
      )}
    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8125rem',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ color: 'var(--text-secondary)', minWidth: '60px' }}>{label}:</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

