// Live Timing Table Component

import { useMemo } from 'react';
import type { CarPosition, SessionState, EventEntry } from '../types/redmist';
import { useUIStore } from '../store';
import { 
  ChevronUp, 
  ChevronDown, 
  Minus,
  Zap,
  Star,
  Users,
} from 'lucide-react';

interface TimingTableProps {
  cars: CarPosition[];
  sessionState: SessionState | null;
  selectedCar: string | null;
  onCarSelect: (carNumber: string) => void;
  sortByClass?: boolean;
}

export function TimingTable({ 
  cars, 
  sessionState, 
  selectedCar, 
  onCarSelect,
  sortByClass 
}: TimingTableProps) {
  const { myCar, classFilter, highlightMyCar, showClassGroups } = useUIStore();

  // Filter cars by class if filter is set
  const filteredCars = useMemo(() => {
    if (!classFilter) return cars;
    return cars.filter(car => car.c === classFilter);
  }, [cars, classFilter]);

  // Sort cars by position
  const sortedCars = useMemo(() => {
    const sorted = [...filteredCars];
    
    if (sortByClass || showClassGroups) {
      // Sort by class, then by class position
      sorted.sort((a, b) => {
        const classA = a.c || '';
        const classB = b.c || '';
        if (classA !== classB) return classA.localeCompare(classB);
        return (a.cp || 0) - (b.cp || 0);
      });
    } else {
      // Sort by overall position
      sorted.sort((a, b) => (a.p || 0) - (b.p || 0));
    }
    
    return sorted;
  }, [filteredCars, sortByClass, showClassGroups]);

  // Group cars by class for rendering with headers
  const groupedCars = useMemo(() => {
    if (!showClassGroups && !sortByClass) return null;
    
    const groups: Record<string, CarPosition[]> = {};
    sortedCars.forEach(car => {
      const cls = car.c || 'No Class';
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(car);
    });
    return groups;
  }, [sortedCars, showClassGroups, sortByClass]);

  // Get class colors from session state
  const classColors = sessionState?.classColors || {};

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

  // Find fastest lap
  const fastestLap = useMemo(() => {
    let fastest = '';
    let fastestTime = Infinity;
    
    cars.forEach(car => {
      if (car.bt) {
        const time = parseTime(car.bt);
        if (time < fastestTime) {
          fastestTime = time;
          fastest = car.n || '';
        }
      }
    });
    
    return fastest;
  }, [cars]);

  if (cars.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '3rem' }}>
        <p>No timing data available</p>
      </div>
    );
  }

  const renderTableHeader = () => (
    <thead>
      <tr>
        <th style={{ width: '50px' }}>Pos</th>
        <th style={{ width: '70px' }}>No</th>
        <th style={{ width: '120px' }}>Class</th>
        <th>Driver / Team</th>
        <th style={{ width: '100px', textAlign: 'right' }}>Last</th>
        <th style={{ width: '100px', textAlign: 'right' }}>Best</th>
        <th style={{ width: '80px', textAlign: 'right' }}>Gap</th>
        <th style={{ width: '80px', textAlign: 'right' }}>Int</th>
        <th style={{ width: '50px', textAlign: 'center' }}>Laps</th>
        <th style={{ width: '60px', textAlign: 'center' }}>+/-</th>
        <th style={{ width: '50px' }}>Pit</th>
      </tr>
    </thead>
  );

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table className="timing-table">
        {renderTableHeader()}
        <tbody>
          {groupedCars ? (
            // Render with class headers
            Object.entries(groupedCars).map(([className, classCars]) => (
              <>
                <tr key={`header-${className}`} className="class-header-row">
                  <td colSpan={11} style={{
                    background: 'var(--bg-tertiary)',
                    padding: '0.5rem 1rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    borderBottom: `2px solid ${classColors[className] || 'var(--accent-blue)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: classColors[className] || 'var(--accent-blue)',
                      }} />
                      {className} ({classCars.length} cars)
                    </div>
                  </td>
                </tr>
                {classCars.map((car) => (
                  <TimingRow
                    key={car.n}
                    car={car}
                    isSelected={selectedCar === car.n}
                    isMyCar={highlightMyCar && car.n === myCar}
                    onClick={() => car.n && onCarSelect(car.n)}
                    classColor={classColors[car.c || ''] || '#666'}
                    isFastestLap={car.n === fastestLap}
                    sortByClass={sortByClass || showClassGroups}
                    teamName={car.n ? teamLookup[car.n] : undefined}
                  />
                ))}
              </>
            ))
          ) : (
            // Render flat list
            sortedCars.map((car) => (
              <TimingRow
                key={car.n}
                car={car}
                isSelected={selectedCar === car.n}
                isMyCar={highlightMyCar && car.n === myCar}
                onClick={() => car.n && onCarSelect(car.n)}
                classColor={classColors[car.c || ''] || '#666'}
                isFastestLap={car.n === fastestLap}
                sortByClass={sortByClass || showClassGroups}
                teamName={car.n ? teamLookup[car.n] : undefined}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface TimingRowProps {
  car: CarPosition;
  isSelected: boolean;
  isMyCar: boolean;
  onClick: () => void;
  classColor: string;
  isFastestLap: boolean;
  sortByClass?: boolean;
  teamName?: string;
}

function TimingRow({ car, isSelected, isMyCar, onClick, classColor, isFastestLap, sortByClass, teamName }: TimingRowProps) {
  // Handle both full and abbreviated field names
  const overallPos = car.p ?? car.ovp ?? 0;
  const classPos = car.cp ?? car.clp ?? 0;
  const position = sortByClass ? classPos : overallPos;
  const posChange = sortByClass ? (car.cpg ?? 0) : (car.opg ?? 0);
  const carClass = car.c ?? car.class ?? '';
  const laps = car.l ?? car.ln ?? '-';
  const pitCount = car.pc ?? car.pl ?? 0;
  
  const rowClasses = [
    isSelected ? 'selected' : '',
    isMyCar ? 'my-car' : '',
  ].filter(Boolean).join(' ');
  
  return (
    <tr 
      className={rowClasses}
      onClick={onClick}
      style={{ 
        cursor: 'pointer',
        ...(isMyCar ? {
          background: 'rgba(255, 215, 0, 0.15)',
          borderLeft: '3px solid var(--accent-yellow)',
        } : {}),
      }}
    >
      {/* Position */}
      <td>
        <div 
          className={`position ${position <= 3 ? `position-${position}` : ''}`}
        >
          {position}
        </div>
      </td>

      {/* Car Number */}
      <td>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.375rem',
          }}
        >
          <div 
            className="class-color"
            style={{ 
              width: '4px', 
              height: '24px', 
              background: classColor,
              borderRadius: '2px',
            }}
          />
          {isMyCar && (
            <Star 
              size={14} 
              fill="var(--accent-yellow)" 
              style={{ color: 'var(--accent-yellow)' }} 
            />
          )}
          <span style={{ fontWeight: 600 }}>{car.n}</span>
        </div>
      </td>

      {/* Class */}
      <td>
        <span 
          style={{ 
            fontSize: '0.75rem', 
            color: classColor,
            fontWeight: 500,
          }}
        >
          {carClass || '-'}
        </span>
        {sortByClass && classPos === 1 && (
          <span 
            style={{ 
              marginLeft: '0.25rem',
              fontSize: '0.625rem',
              background: classColor,
              color: '#000',
              padding: '0.125rem 0.25rem',
              borderRadius: '2px',
              fontWeight: 600,
            }}
          >
            P1
          </span>
        )}
      </td>

      {/* Driver / Team */}
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-sans)' }}>
              {car.dn || '-'}
            </span>
            {car.ip && (
              <span className="in-pit">
                PIT
              </span>
            )}
            {car.flg === 6 && ( // Black flag
              <span 
                style={{ 
                  background: '#000',
                  color: '#fff',
                  padding: '0.125rem 0.25rem',
                  borderRadius: '2px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                }}
              >
                BLACK
              </span>
            )}
          </div>
          {teamName && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)',
            }}>
              <Users size={10} />
              <span style={{ 
                maxWidth: '200px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {teamName}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Last Lap Time */}
      <td style={{ textAlign: 'right' }}>
        <span className={getTimeClass(car.ltm, car.bt, car.ibt)}>
          {car.ltm || '-'}
        </span>
      </td>

      {/* Best Lap Time */}
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
          {isFastestLap && (
            <Zap 
              size={12} 
              style={{ color: 'var(--timing-fastest)' }}
              fill="var(--timing-fastest)"
            />
          )}
          <span className={isFastestLap ? 'time-fastest' : car.btc ? 'time-pb' : ''}>
            {car.bt || '-'}
          </span>
        </div>
      </td>

      {/* Gap to Leader */}
      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
        {sortByClass ? (car.cg ?? car.gl) : (car.og ?? car.gl) || (position === 1 ? 'Leader' : '-')}
      </td>

      {/* Interval (gap to car ahead) */}
      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
        {sortByClass ? (car.cd ?? car.gi) : (car.od ?? car.gi) || '-'}
      </td>

      {/* Laps */}
      <td style={{ textAlign: 'center' }}>
        {laps}
      </td>

      {/* Position Change */}
      <td style={{ textAlign: 'center' }}>
        <PositionChange change={posChange} />
      </td>

      {/* Pit Count */}
      <td>
        {pitCount > 0 && (
          <span 
            style={{ 
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            {pitCount}
          </span>
        )}
      </td>
    </tr>
  );
}

interface PositionChangeProps {
  change: number;
}

function PositionChange({ change }: PositionChangeProps) {
  if (change === 0) {
    return (
      <span className="pos-change" style={{ color: 'var(--text-muted)' }}>
        <Minus size={12} />
      </span>
    );
  }

  if (change > 0) {
    return (
      <span className="pos-change gain">
        <ChevronUp size={14} />
        {change}
      </span>
    );
  }

  return (
    <span className="pos-change loss">
      <ChevronDown size={14} />
      {Math.abs(change)}
    </span>
  );
}

// Parse time string to milliseconds for comparison
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');
  let ms = 0;
  
  if (parts.length === 2) {
    // MM:SS.sss
    const [mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis || '0');
  } else if (parts.length === 3) {
    // HH:MM:SS.sss
    const [hours, mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(hours) * 3600000 + parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis || '0');
  }
  
  return ms;
}

// Get CSS class for lap time display
function getTimeClass(lastTime: string | null | undefined, bestTime: string | null | undefined, isBestTime?: boolean): string {
  if (!lastTime) return '';
  
  if (isBestTime) {
    return 'time-pb';
  }
  
  if (bestTime) {
    const last = parseTime(lastTime);
    const best = parseTime(bestTime);
    const diff = ((last - best) / best) * 100;
    
    if (diff > 5) {
      return 'time-slow';
    }
  }
  
  return '';
}

