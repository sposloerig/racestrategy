// Strategy Panel - Pit strategy and competitor analysis
import { useMemo, useState } from 'react';
import { useSessionStore, useUIStore } from '../store';
import type { CarPosition, EventEntry } from '../types/redmist';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Flag,
  ChevronDown,
  ChevronUp,
  Star,
  Users,
  Rewind,
  Zap,
} from 'lucide-react';

interface StrategyPanelProps {
  onOpenStrategyDashboard?: (carNumber: string) => void;
  onOpenRaceReplay?: () => void;
  onOpenRaceMonitorCompare?: () => void;
  onOpenDataSourceComparison?: () => void;
}

// Calculate gap trend between two cars based on recent lap times
function calculateGapTrend(myCar: CarPosition, competitor: CarPosition): 'closing' | 'opening' | 'stable' {
  const myLastLap = myCar.lastLapMs || parseLapTimeToMsInternal(myCar.ltm);
  const theirLastLap = competitor.lastLapMs || parseLapTimeToMsInternal(competitor.ltm);
  
  if (myLastLap === 0 || theirLastLap === 0) return 'stable';
  
  const diff = myLastLap - theirLastLap;
  // If difference is more than 1 second
  if (diff > 1000) return 'opening'; // They're faster
  if (diff < -1000) return 'closing'; // We're faster
  return 'stable';
}

// Internal helper (defined before main component)
function parseLapTimeToMsInternal(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const [mins, secPart] = parts;
    const [secs, ms] = secPart.split('.');
    return parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(ms?.slice(0, 3) || '0');
  } else if (parts.length === 3) {
    const [hours, mins, secPart] = parts;
    const [secs, ms] = secPart.split('.');
    return parseInt(hours) * 3600000 + parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(ms?.slice(0, 3) || '0');
  }
  return 0;
}

// Format time from milliseconds to readable string
function formatLapTime(ms: number | null | undefined): string {
  if (!ms) return '-';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

// Format gap (can be laps or time)
function formatGap(gap: string | null | undefined): string {
  if (!gap) return '-';
  return gap;
}

export function StrategyPanel({ onOpenStrategyDashboard, onOpenRaceReplay, onOpenRaceMonitorCompare, onOpenDataSourceComparison }: StrategyPanelProps) {
  const { carPositions, sessionState } = useSessionStore();
  const { myCar, setMyCar, classFilter, setClassFilter, showClassGroups, toggleClassGroups } = useUIStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    competitors: true,
    pitStrategy: true,
    classStandings: false,
  });

  // Get unique classes from car positions
  const classes = useMemo(() => {
    const classSet = new Set<string>();
    carPositions.forEach(car => {
      if (car.c) classSet.add(car.c);
    });
    return Array.from(classSet).sort();
  }, [carPositions]);

  // Create a lookup map for team names from eventEntries
  const teamLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    if (sessionState?.eventEntries) {
      sessionState.eventEntries.forEach((entry: EventEntry) => {
        if (entry.no && entry.t) {
          lookup[entry.no] = entry.t;
        }
        // Also try with nm (name) as fallback for team display
        if (entry.no && entry.nm && !entry.t) {
          lookup[entry.no] = entry.nm;
        }
      });
    }
    return lookup;
  }, [sessionState?.eventEntries]);

  // Get my car data
  const myCarData = useMemo(() => {
    if (!myCar) return null;
    return carPositions.find(car => car.n === myCar);
  }, [myCar, carPositions]);

  // Filter cars by class if filter is set
  const filteredCars = useMemo(() => {
    if (!classFilter) return carPositions;
    return carPositions.filter(car => car.c === classFilter);
  }, [carPositions, classFilter]);

  // Get competitors near my car (within 5 positions)
  const nearbyCompetitors = useMemo(() => {
    if (!myCarData) return [];
    const myPos = myCarData.p ?? myCarData.ovp ?? 0;
    
    // Get cars within class or overall depending on filter
    const relevantCars = classFilter 
      ? filteredCars 
      : carPositions.filter(car => (car.c ?? car.class) === (myCarData.c ?? myCarData.class)); // Same class
    
    return relevantCars
      .filter(car => car.n !== myCar)
      .map(car => {
        const theirPos = car.p ?? car.ovp ?? 0;
        const positionDiff = theirPos - myPos;
        const trend = calculateGapTrend(myCarData, car);
        
        return {
          ...car,
          positionDiff,
          trend,
          isAhead: positionDiff < 0,
          isBehind: positionDiff > 0,
        };
      })
      .filter(car => Math.abs(car.positionDiff) <= 5) // Within 5 positions
      .sort((a, b) => a.positionDiff - b.positionDiff);
  }, [myCarData, myCar, carPositions, filteredCars, classFilter]);

  // Get cars in pit
  const carsInPit = useMemo(() => {
    return filteredCars.filter(car => car.ip);
  }, [filteredCars]);

  // Get recent pit activity (cars with pit count > 0)
  const pitActivity = useMemo(() => {
    return filteredCars
      .filter(car => car.pc && car.pc > 0)
      .sort((a, b) => (b.pc || 0) - (a.pc || 0))
      .slice(0, 10);
  }, [filteredCars]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isCompleted = sessionState?.currentFlag === 5;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1rem',
      padding: '1rem',
      height: '100%',
      overflow: 'auto',
    }}>
      {/* My Car Selector */}
      <div className="card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <Star size={18} style={{ color: 'var(--accent-yellow)' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>My Car</h3>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={myCar || ''}
            onChange={(e) => setMyCar(e.target.value || null)}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="">Select your car...</option>
            {carPositions.map(car => {
              const teamName = car.n ? teamLookup[car.n] : undefined;
              return (
                <option key={car.n} value={car.n ?? ''}>
                  #{car.n} - {car.c || 'No Class'} - P{car.p}{teamName ? ` - ${teamName}` : ''}
                </option>
              );
            })}
          </select>
          
          {myCar && myCarData && (
            <div style={{
              padding: '0.5rem 1rem',
              background: 'var(--accent-yellow)',
              color: 'black',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}>
              P{myCarData.p ?? myCarData.ovp ?? '?'} in {myCarData.c ?? myCarData.class ?? 'Overall'}
            </div>
          )}
        </div>

        {myCarData && (
          <>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '0.75rem',
              marginTop: '1rem',
            }}>
              <StatBox label="Position" value={`P${myCarData.p ?? myCarData.ovp ?? '?'}`} />
              <StatBox label="Last Lap" value={myCarData.ltm || formatLapTime(myCarData.lastLapMs)} />
              <StatBox label="Best Lap" value={myCarData.bt || formatLapTime(myCarData.bestLapMs)} />
              <StatBox label="Laps" value={myCarData.l?.toString() || myCarData.ln || '-'} />
              <StatBox label="Pit Stops" value={myCarData.pc?.toString() || myCarData.pl?.toString() || '0'} />
              <StatBox label="Gap to Leader" value={formatGap(myCarData.gl ?? myCarData.og)} />
            </div>

            {onOpenStrategyDashboard && myCar && (
              <button
                onClick={() => onOpenStrategyDashboard(myCar)}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, var(--accent-yellow), #ff8c00)',
                  color: 'black',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <Target size={16} />
                Open Strategy Dashboard
              </button>
            )}
            
          </>
        )}
        
        {/* Race Replay Button - Always visible */}
        {onOpenRaceReplay && (
          <button
            onClick={onOpenRaceReplay}
            className="btn btn-secondary"
            style={{
              width: '100%',
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Rewind size={16} />
            Race Replay / Time Machine
          </button>
        )}
        
        {/* Race Monitor Compare Button - Quick per-car lookup */}
        {onOpenRaceMonitorCompare && (
          <button
            onClick={onOpenRaceMonitorCompare}
            className="btn"
            style={{
              width: '100%',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #0066ff22, #00ccff22)',
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)',
            }}
          >
            <Zap size={16} />
            Race Monitor: Quick Lookup
          </button>
        )}
        
        {/* Full Data Source Comparison */}
        {onOpenDataSourceComparison && (
          <button
            onClick={onOpenDataSourceComparison}
            className="btn"
            style={{
              width: '100%',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #ff990022, #ffcc0022)',
              border: '1px solid var(--accent-yellow)',
              color: 'var(--accent-yellow)',
            }}
          >
            <Zap size={16} />
            Full Data Comparison (RM vs RedMist)
          </button>
        )}
      </div>

      {/* Class Filter */}
      <div className="card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Class Filter</h3>
          </div>
          <button
            onClick={toggleClassGroups}
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            {showClassGroups ? 'Grouping On' : 'Grouping Off'}
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setClassFilter(null)}
            className={`btn ${!classFilter ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
          >
            All Classes
          </button>
          {classes.map(cls => (
            <button
              key={cls}
              onClick={() => setClassFilter(cls)}
              className={`btn ${classFilter === cls ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Nearby Competitors */}
      {myCar && (
        <div className="card">
          <button
            onClick={() => toggleSection('competitors')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: expandedSections.competitors ? '0.75rem' : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} style={{ color: 'var(--accent-red)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Competitors ({nearbyCompetitors.length})
              </h3>
            </div>
            {expandedSections.competitors ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {expandedSections.competitors && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {nearbyCompetitors.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  No nearby competitors in your class
                </p>
              ) : (
                nearbyCompetitors.map(car => (
                  <CompetitorRow key={car.n} car={car} myCarData={myCarData!} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Pit Strategy */}
      <div className="card">
        <button
          onClick={() => toggleSection('pitStrategy')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: expandedSections.pitStrategy ? '0.75rem' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flag size={18} style={{ color: 'var(--accent-green)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Pit Activity
            </h3>
          </div>
          {expandedSections.pitStrategy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        {expandedSections.pitStrategy && (
          <>
            {/* Cars currently in pit */}
            {carsInPit.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--accent-yellow)',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                }}>
                  IN PIT NOW ({carsInPit.length})
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {carsInPit.map(car => (
                    <span
                      key={car.n}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'var(--accent-yellow)',
                        color: 'black',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      #{car.n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pit stop counts */}
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}>
              PIT STOPS
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '0.5rem',
            }}>
              {pitActivity.map(car => (
                <div
                  key={car.n}
                  style={{
                    padding: '0.5rem',
                    background: car.n === myCar ? 'rgba(255, 215, 0, 0.2)' : 'var(--bg-secondary)',
                    borderRadius: '6px',
                    textAlign: 'center',
                    border: car.n === myCar ? '1px solid var(--accent-yellow)' : '1px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>#{car.n}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {car.pc} stops
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Session Status */}
      {isCompleted && (
        <div 
          style={{
            padding: '1rem',
            background: 'rgba(0, 255, 0, 0.1)',
            border: '1px solid rgba(0, 255, 0, 0.3)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <Flag size={24} style={{ color: 'var(--accent-green)', marginBottom: '0.5rem' }} />
          <div style={{ fontWeight: 600, color: 'var(--accent-green)' }}>Session Complete</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Final results - no live updates
          </div>
        </div>
      )}
    </div>
  );
}

// Small stat box component
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '0.5rem',
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

// Competitor row component
interface CompetitorRowProps {
  car: CarPosition & { positionDiff: number; trend: 'closing' | 'opening' | 'stable'; isAhead: boolean; isBehind: boolean };
  myCarData: CarPosition;
}

function CompetitorRow({ car, myCarData }: CompetitorRowProps) {
  const posLabel = car.isAhead 
    ? `${Math.abs(car.positionDiff)} ahead` 
    : car.isBehind 
      ? `${Math.abs(car.positionDiff)} behind`
      : 'Same position';

  const trendIcon = car.trend === 'closing' 
    ? <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
    : car.trend === 'opening'
      ? <TrendingDown size={14} style={{ color: 'var(--accent-red)' }} />
      : <Minus size={14} style={{ color: 'var(--text-secondary)' }} />;

  const trendLabel = car.trend === 'closing' 
    ? 'Closing'
    : car.trend === 'opening'
      ? 'Opening'
      : 'Stable';

  // Calculate lap time difference from last lap times
  const myLap = myCarData.lastLapMs || parseLapTimeToMsInternal(myCarData.ltm);
  const theirLap = car.lastLapMs || parseLapTimeToMsInternal(car.ltm);
  const lapDiff = theirLap - myLap;
  const lapDiffStr = (lapDiff !== 0 && myLap > 0 && theirLap > 0)
    ? (lapDiff > 0 
      ? `+${(lapDiff / 1000).toFixed(1)}s` 
      : `${(lapDiff / 1000).toFixed(1)}s`)
    : '-';

  const carPos = car.p ?? car.ovp ?? '?';
  const carClass = car.c ?? car.class ?? '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem',
        background: car.isAhead ? 'rgba(255, 59, 59, 0.1)' : 'rgba(0, 255, 127, 0.1)',
        borderRadius: '8px',
        borderLeft: `3px solid ${car.isAhead ? 'var(--accent-red)' : 'var(--accent-green)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          fontWeight: 700,
          fontSize: '0.75rem',
        }}>
          P{carPos}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>#{car.n}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {posLabel} • {carClass}
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
          {trendIcon}
          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{trendLabel}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {lapDiffStr}/lap
        </div>
      </div>
    </div>
  );
}


