// Data Source Comparison - Side-by-side view of RedMist vs Race Monitor
import { useState, useEffect } from 'react';
import { useSessionStore } from '../store';
import { raceMonitorApi } from '../lib/racemonitor';
import type { RMRace, RMSession, RMCompetitor, RMCompetitorDetails, RMLapTime } from '../types/racemonitor';
import type { CarPosition } from '../types/redmist';
import { 
  X, 
  Search,
  Zap,
  Database,
  Flag,
  Clock,
  TrendingUp,
  User,
  MapPin,
  History,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface DataSourceComparisonProps {
  onClose: () => void;
}

interface ComparisonData {
  carNumber: string;
  redmist: {
    position: number;
    laps: number;
    lastLapTime: string;
    bestLapTime: string;
    gap: string;
    pitCount: number;
    inPit: boolean;
    className: string;
  } | null;
  racemonitor: {
    position: string;
    laps: string;
    lastLapTime: string;
    bestLapTime: string;
    totalTime: string;
    bestPosition: string;
    transponder: string;
    driverName: string;
    nationality: string;
    lapDetails: RMLapTime[];
  } | null;
}

export function DataSourceComparison({ onClose }: DataSourceComparisonProps) {
  const { carPositions, sessionState, selectedEvent } = useSessionStore();
  
  // Race Monitor state
  const [searchTerm, setSearchTerm] = useState(selectedEvent?.n || '');
  const [rmRaces, setRmRaces] = useState<RMRace[]>([]);
  const [rmSessions, setRmSessions] = useState<RMSession[]>([]);
  const [selectedRmRace, setSelectedRmRace] = useState<RMRace | null>(null);
  const [selectedRmSession, setSelectedRmSession] = useState<RMSession | null>(null);
  const [rmCompetitors, setRmCompetitors] = useState<RMCompetitor[]>([]);
  
  // Comparison state
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [selectedCar, setSelectedCar] = useState<ComparisonData | null>(null);
  const [carLapDetails, setCarLapDetails] = useState<RMCompetitorDetails | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'laps' | 'unique'>('overview');

  const apiToken = import.meta.env.VITE_RACEMONITOR_API_TOKEN;
  const isConfigured = !!apiToken;

  // Search for races
  const handleSearch = async () => {
    if (!searchTerm.trim() || !isConfigured) return;
    
    setIsLoading(true);
    setLoadingStep('Searching races...');
    setError(null);
    setRmRaces([]);
    setRmSessions([]);
    setSelectedRmRace(null);
    setSelectedRmSession(null);
    setComparisonData([]);

    try {
      raceMonitorApi.setApiToken(apiToken);
      const results = await raceMonitorApi.searchRaces(searchTerm);
      setRmRaces(results.slice(0, 15));
      setRequestCount(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Select a race and load sessions
  const handleSelectRace = async (race: RMRace) => {
    setSelectedRmRace(race);
    setRmSessions([]);
    setSelectedRmSession(null);
    setComparisonData([]);
    setIsLoading(true);
    setLoadingStep('Loading sessions...');
    setError(null);

    try {
      const sessions = await raceMonitorApi.getSessionsForRace(parseInt(race.ID));
      setRmSessions(sessions);
      setRequestCount(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Select session and load competitor data
  const handleSelectSession = async (session: RMSession) => {
    setSelectedRmSession(session);
    setIsLoading(true);
    setLoadingStep('Loading competitors...');
    setError(null);

    try {
      const sessionDetails = await raceMonitorApi.getSessionDetails(parseInt(session.ID), false);
      setRmCompetitors(sessionDetails.SortedCompetitors || []);
      setRequestCount(prev => prev + 1);
      
      // Build comparison data
      buildComparisonData(sessionDetails.SortedCompetitors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Build comparison between RedMist and Race Monitor data
  const buildComparisonData = (rmCompetitors: RMCompetitor[]) => {
    const comparisons: ComparisonData[] = [];
    
    // Create lookup by car number from RedMist
    const redmistByNumber: Record<string, CarPosition> = {};
    carPositions.forEach(car => {
      if (car.n) {
        redmistByNumber[car.n] = car;
        redmistByNumber[car.n.replace('#', '')] = car;
        redmistByNumber[`#${car.n}`] = car;
      }
    });
    
    // Match Race Monitor competitors
    rmCompetitors.forEach(rmCar => {
      const carNum = rmCar.Number?.replace('#', '') || '';
      const redmistCar = redmistByNumber[carNum] || redmistByNumber[`#${carNum}`] || redmistByNumber[rmCar.Number];
      
      comparisons.push({
        carNumber: carNum,
        redmist: redmistCar ? {
          position: redmistCar.ovp || redmistCar.p || 0,
          laps: redmistCar.l || 0,
          lastLapTime: redmistCar.ltm || '-',
          bestLapTime: redmistCar.bt || '-',
          gap: redmistCar.og || redmistCar.gl || '-',
          pitCount: redmistCar.pc || 0,
          inPit: redmistCar.ip || false,
          className: redmistCar.c || redmistCar.class || '',
        } : null,
        racemonitor: {
          position: rmCar.Position,
          laps: rmCar.Laps,
          lastLapTime: rmCar.LastLapTime,
          bestLapTime: rmCar.BestLapTime,
          totalTime: rmCar.TotalTime,
          bestPosition: rmCar.BestPosition,
          transponder: rmCar.Transponder,
          driverName: `${rmCar.FirstName} ${rmCar.LastName}`.trim(),
          nationality: rmCar.Nationality || '',
          lapDetails: rmCar.LapTimes || [],
        },
      });
    });
    
    // Add RedMist-only cars
    carPositions.forEach(car => {
      if (!car.n) return;
      const carNum = car.n.replace('#', '');
      if (!comparisons.find(c => c.carNumber === carNum)) {
        comparisons.push({
          carNumber: carNum,
          redmist: {
            position: car.ovp || car.p || 0,
            laps: car.l || 0,
            lastLapTime: car.ltm || '-',
            bestLapTime: car.bt || '-',
            gap: car.og || car.gl || '-',
            pitCount: car.pc || 0,
            inPit: car.ip || false,
            className: car.c || car.class || '',
          },
          racemonitor: null,
        });
      }
    });
    
    // Sort by position
    comparisons.sort((a, b) => {
      const posA = a.racemonitor ? parseInt(a.racemonitor.position) : (a.redmist?.position || 999);
      const posB = b.racemonitor ? parseInt(b.racemonitor.position) : (b.redmist?.position || 999);
      return posA - posB;
    });
    
    setComparisonData(comparisons);
  };

  // Load detailed lap data for a car
  const handleSelectCar = async (car: ComparisonData) => {
    setSelectedCar(car);
    setActiveTab('laps');
    
    if (!selectedRmSession || !car.racemonitor) return;
    
    setIsLoading(true);
    setLoadingStep('Loading lap details...');

    try {
      // Find competitor ID
      const competitor = rmCompetitors.find(c => 
        c.Number === car.carNumber || 
        c.Number === `#${car.carNumber}` ||
        c.Number?.replace('#', '') === car.carNumber
      );
      
      if (competitor) {
        const details = await raceMonitorApi.getCompetitorDetails(
          parseInt(selectedRmSession.ID), 
          competitor.ID
        );
        setCarLapDetails(details);
        setRequestCount(prev => prev + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lap details');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Calculate flag statistics
  const getFlagStats = (laps: RMLapTime[]) => {
    const stats = { green: 0, yellow: 0, red: 0, other: 0 };
    laps.forEach(lap => {
      const flag = String(lap.FlagStatus).toLowerCase();
      if (flag === 'green' || flag === '1') stats.green++;
      else if (flag === 'yellow' || flag === '2') stats.yellow++;
      else if (flag === 'red' || flag === '3') stats.red++;
      else stats.other++;
    });
    return stats;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '95%',
        maxWidth: '1200px',
        height: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-color)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
        }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} style={{ color: 'var(--accent-blue)' }} />
              Data Source Comparison
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Side-by-side view of RedMist vs Race Monitor data
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.25rem 0.75rem',
              background: requestCount >= 5 ? 'rgba(255, 59, 59, 0.2)' : 'var(--bg-tertiary)',
              borderRadius: '20px',
              fontSize: '0.75rem',
            }}>
              <Zap size={12} />
              {requestCount}/6 req
            </div>
            <button className="btn btn-ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Panel - Selection */}
          <div style={{
            width: '300px',
            borderRight: '1px solid var(--border-color)',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
            padding: '1rem',
          }}>
            {!isConfigured ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <AlertTriangle size={32} style={{ color: 'var(--accent-yellow)', marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.875rem' }}>Race Monitor API not configured</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'block' }}>
                    SEARCH RACE MONITOR
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Event name..."
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSearch}
                      disabled={isLoading}
                      style={{ padding: '0.5rem' }}
                    >
                      <Search size={16} />
                    </button>
                  </div>
                </div>

                {/* Race Selection */}
                {rmRaces.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'block' }}>
                      SELECT RACE
                    </label>
                    <div style={{ 
                      maxHeight: '150px', 
                      overflow: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}>
                      {rmRaces.map(race => (
                        <button
                          key={race.ID}
                          onClick={() => handleSelectRace(race)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: selectedRmRace?.ID === race.ID ? 'var(--accent-blue)' : 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{race.Name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {race.TrackName} • {race.StartDate}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Selection */}
                {rmSessions.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'block' }}>
                      SELECT SESSION
                    </label>
                    <div style={{ 
                      maxHeight: '120px', 
                      overflow: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}>
                      {rmSessions.map(session => (
                        <button
                          key={session.ID}
                          onClick={() => handleSelectSession(session)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: selectedRmSession?.ID === session.ID ? 'var(--accent-blue)' : 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          {session.Name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading */}
                {isLoading && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <RefreshCw size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.75rem' }}>{loadingStep}</div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '0.75rem',
                    background: 'rgba(255, 59, 59, 0.1)',
                    border: '1px solid var(--accent-red)',
                    borderRadius: '6px',
                    color: 'var(--accent-red)',
                    fontSize: '0.75rem',
                  }}>
                    {error}
                  </div>
                )}

                {/* Data Source Legend */}
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Legend:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ width: 12, height: 12, background: '#ff6b6b', borderRadius: 2 }} />
                    RedMist only
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ width: 12, height: 12, background: '#4dabf7', borderRadius: 2 }} />
                    Race Monitor only
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#51cf66', borderRadius: 2 }} />
                    Both sources match
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Comparison Data */}
          <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
            {comparisonData.length === 0 ? (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'var(--text-secondary)',
              }}>
                <Database size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>Select a Race Monitor session to compare data</p>
                <p style={{ fontSize: '0.75rem' }}>RedMist data: {carPositions.length} cars loaded</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.5rem',
                }}>
                  <TabButton 
                    active={activeTab === 'overview'} 
                    onClick={() => setActiveTab('overview')}
                    label="Overview"
                  />
                  <TabButton 
                    active={activeTab === 'laps'} 
                    onClick={() => setActiveTab('laps')}
                    label="Lap Details"
                    disabled={!selectedCar}
                  />
                  <TabButton 
                    active={activeTab === 'unique'} 
                    onClick={() => setActiveTab('unique')}
                    label="RM Unique Data"
                  />
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>
                        <tr>
                          <th style={thStyle}>Car</th>
                          <th style={thStyle}>Source</th>
                          <th style={thStyle}>Pos</th>
                          <th style={thStyle}>Laps</th>
                          <th style={thStyle}>Last Lap</th>
                          <th style={thStyle}>Best Lap</th>
                          <th style={thStyle}>RM: Driver</th>
                          <th style={thStyle}>RM: Transponder</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.map(car => {
                          const hasBoth = car.redmist && car.racemonitor;
                          const rmOnly = !car.redmist && car.racemonitor;
                          const redmistOnly = car.redmist && !car.racemonitor;
                          
                          return (
                            <tr 
                              key={car.carNumber}
                              style={{ 
                                cursor: car.racemonitor ? 'pointer' : 'default',
                                background: selectedCar?.carNumber === car.carNumber ? 'var(--bg-tertiary)' : 'transparent',
                              }}
                              onClick={() => car.racemonitor && handleSelectCar(car)}
                            >
                              <td style={tdStyle}>
                                <span style={{ fontWeight: 600 }}>#{car.carNumber}</span>
                              </td>
                              <td style={tdStyle}>
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '4px',
                                }}>
                                  {hasBoth && <SourceBadge color="#51cf66" label="Both" />}
                                  {rmOnly && <SourceBadge color="#4dabf7" label="RM" />}
                                  {redmistOnly && <SourceBadge color="#ff6b6b" label="RedMist" />}
                                </div>
                              </td>
                              <td style={tdStyle}>
                                {car.racemonitor?.position || car.redmist?.position || '-'}
                              </td>
                              <td style={tdStyle}>
                                {car.racemonitor?.laps || car.redmist?.laps || '-'}
                              </td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                                {car.racemonitor?.lastLapTime || car.redmist?.lastLapTime || '-'}
                              </td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                                {car.racemonitor?.bestLapTime || car.redmist?.bestLapTime || '-'}
                              </td>
                              <td style={tdStyle}>
                                {car.racemonitor?.driverName || '-'}
                              </td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                {car.racemonitor?.transponder || '-'}
                              </td>
                              <td style={tdStyle}>
                                {car.racemonitor && <ChevronRight size={14} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Laps Tab */}
                {activeTab === 'laps' && selectedCar && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                    }}>
                      <div>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>#{selectedCar.carNumber}</span>
                        {selectedCar.racemonitor && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                            {selectedCar.racemonitor.driverName}
                          </span>
                        )}
                      </div>
                      {carLapDetails && carLapDetails.Laps.length > 0 && (
                        <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                          {(() => {
                            const stats = getFlagStats(carLapDetails.Laps);
                            return (
                              <>
                                <FlagStat color="#51cf66" count={stats.green} label="Green" />
                                <FlagStat color="#ffc107" count={stats.yellow} label="Yellow" />
                                <FlagStat color="#ff6b6b" count={stats.red} label="Red" />
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {isLoading ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <RefreshCw size={24} className="spin" />
                      </div>
                    ) : carLapDetails ? (
                      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>
                            <tr>
                              <th style={thStyle}>Lap</th>
                              <th style={thStyle}>Time</th>
                              <th style={thStyle}>Flag</th>
                              <th style={thStyle}>Position</th>
                              <th style={thStyle}>Total Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {carLapDetails.Laps.map((lap, i) => {
                              const flag = String(lap.FlagStatus).toLowerCase();
                              const isGreen = flag === 'green' || flag === '1';
                              const isYellow = flag === 'yellow' || flag === '2';
                              const isRed = flag === 'red' || flag === '3';
                              
                              return (
                                <tr key={i} style={{
                                  background: isYellow ? 'rgba(255, 193, 7, 0.15)' : 
                                              isRed ? 'rgba(255, 59, 59, 0.15)' : 'transparent',
                                }}>
                                  <td style={tdStyle}>{lap.Lap}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{lap.LapTime}</td>
                                  <td style={tdStyle}>
                                    {isGreen && <Flag size={14} style={{ color: '#51cf66' }} />}
                                    {isYellow && <Flag size={14} style={{ color: '#ffc107' }} />}
                                    {isRed && <Flag size={14} style={{ color: '#ff6b6b' }} />}
                                  </td>
                                  <td style={tdStyle}>P{lap.Position}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                    {lap.TotalTime || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Select a car from Overview to see lap details
                      </p>
                    )}
                  </div>
                )}

                {/* Unique RM Data Tab */}
                {activeTab === 'unique' && (
                  <div>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
                      Race Monitor Unique Data Points
                    </h3>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '1rem',
                    }}>
                      <UniqueDataCard
                        icon={<Flag size={20} />}
                        title="Per-Lap Flag Status"
                        description="Know exactly which laps were under green, yellow, or red flag"
                        value={`${comparisonData.filter(c => c.racemonitor).length} cars with flag data`}
                        highlight
                      />
                      <UniqueDataCard
                        icon={<User size={20} />}
                        title="Driver Names"
                        description="Full driver first and last names"
                        value={`${comparisonData.filter(c => c.racemonitor?.driverName).length} drivers identified`}
                      />
                      <UniqueDataCard
                        icon={<MapPin size={20} />}
                        title="Nationality"
                        description="Driver nationality/country"
                        value={`${comparisonData.filter(c => c.racemonitor?.nationality).length} with nationality`}
                      />
                      <UniqueDataCard
                        icon={<TrendingUp size={20} />}
                        title="Best Position"
                        description="Highest position achieved during race"
                        value={comparisonData[0]?.racemonitor?.bestPosition ? `Leader peaked at P${comparisonData[0].racemonitor.bestPosition}` : '-'}
                      />
                      <UniqueDataCard
                        icon={<Database size={20} />}
                        title="Transponder IDs"
                        description="MyLaps transponder for driver tracking"
                        value={`${comparisonData.filter(c => c.racemonitor?.transponder).length} transponders`}
                      />
                      <UniqueDataCard
                        icon={<History size={20} />}
                        title="Historical Lookup"
                        description="Search any transponder to see all past races"
                        value="API endpoint available"
                      />
                    </div>

                    <div style={{
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: 'linear-gradient(135deg, rgba(0, 150, 255, 0.1), rgba(0, 200, 150, 0.1))',
                      border: '1px solid var(--accent-blue)',
                      borderRadius: '8px',
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: 'var(--accent-blue)' }}>
                        💡 Why Per-Lap Flag Status Matters
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        When calculating pit strategy, you need <strong>"true pace"</strong> - the average lap time
                        under green flag conditions only. Yellow flag laps are 20-40% slower and skew your calculations.
                        Race Monitor is the only source that provides this data for each individual lap.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  textAlign: 'left',
  borderBottom: '2px solid var(--border-color)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '1px solid var(--border-color)',
};

function TabButton({ active, onClick, label, disabled }: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5rem 1rem',
        background: active ? 'var(--accent-blue)' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function SourceBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      padding: '2px 6px',
      background: color,
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: 600,
      color: '#000',
    }}>
      {label}
    </span>
  );
}

function FlagStat({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function UniqueDataCard({ 
  icon, 
  title, 
  description, 
  value, 
  highlight 
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      padding: '1rem',
      background: highlight ? 'rgba(0, 200, 83, 0.1)' : 'var(--bg-secondary)',
      border: `1px solid ${highlight ? 'var(--accent-green)' : 'var(--border-color)'}`,
      borderRadius: '8px',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '0.5rem',
        color: highlight ? 'var(--accent-green)' : 'var(--text-primary)',
      }}>
        {icon}
        <span style={{ fontWeight: 600 }}>{title}</span>
      </div>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {description}
      </p>
      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

