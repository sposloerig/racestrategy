// Race Monitor Comparison Panel - Shows what extra data Race Monitor provides
import { useState } from 'react';
import { raceMonitorApi } from '../lib/racemonitor';
import type { RMRace, RMSession, RMCompetitorDetails, RMLapTime } from '../types/racemonitor';
import { 
  Search, 
  Zap, 
  Flag, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
} from 'lucide-react';

interface RaceMonitorCompareProps {
  onClose: () => void;
  currentEventName?: string;
  currentCarNumber?: string;
}

export function RaceMonitorCompare({ onClose, currentEventName, currentCarNumber }: RaceMonitorCompareProps) {
  const [searchTerm, setSearchTerm] = useState(currentEventName || '');
  const [races, setRaces] = useState<RMRace[]>([]);
  const [sessions, setSessions] = useState<RMSession[]>([]);
  const [selectedRace, setSelectedRace] = useState<RMRace | null>(null);
  const [selectedSession, setSelectedSession] = useState<RMSession | null>(null);
  const [competitorData, setCompetitorData] = useState<RMCompetitorDetails | null>(null);
  const [carNumber, setCarNumber] = useState(currentCarNumber || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  const apiToken = import.meta.env.VITE_RACEMONITOR_API_TOKEN;
  const isConfigured = !!apiToken;

  // Search for races (1 request)
  const handleSearch = async () => {
    if (!searchTerm.trim() || !isConfigured) return;
    
    setIsLoading(true);
    setError(null);
    setRaces([]);
    setSessions([]);
    setSelectedRace(null);
    setSelectedSession(null);
    setCompetitorData(null);

    try {
      raceMonitorApi.setApiToken(apiToken);
      const results = await raceMonitorApi.searchRaces(searchTerm);
      setRaces(results.slice(0, 10)); // Limit to 10
      setRequestCount(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Load sessions for a race (1 request)
  const handleSelectRace = async (race: RMRace) => {
    setSelectedRace(race);
    setSessions([]);
    setSelectedSession(null);
    setCompetitorData(null);
    setIsLoading(true);
    setError(null);

    try {
      const sessionList = await raceMonitorApi.getSessionsForRace(parseInt(race.ID));
      setSessions(sessionList);
      setRequestCount(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  // Load lap data for a car (1 request)
  const handleLoadLapData = async () => {
    if (!selectedSession || !carNumber.trim()) return;

    setIsLoading(true);
    setError(null);
    setCompetitorData(null);

    try {
      // First get session details to find the competitor ID
      const sessionDetails = await raceMonitorApi.getSessionDetails(parseInt(selectedSession.ID), true);
      setRequestCount(prev => prev + 1);

      // Find competitor by car number
      const competitor = sessionDetails.Competitors?.find(
        c => c.Number === carNumber || c.Number === `#${carNumber}` || c.Number === carNumber.replace('#', '')
      );

      if (!competitor) {
        setError(`Car #${carNumber} not found in this session. Available: ${sessionDetails.Competitors?.map(c => c.Number).join(', ')}`);
        return;
      }

      // Get detailed lap data
      const details = await raceMonitorApi.getCompetitorDetails(parseInt(selectedSession.ID), competitor.ID);
      setCompetitorData(details);
      setRequestCount(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lap data');
    } finally {
      setIsLoading(false);
    }
  };

  // Count laps by flag status
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
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '95%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={20} style={{ color: 'var(--accent-yellow)' }} />
              Race Monitor Comparison
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              See what extra data Race Monitor provides (per-lap flag status)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ 
              fontSize: '0.7rem', 
              color: requestCount >= 5 ? 'var(--accent-red)' : 'var(--text-tertiary)',
            }}>
              {requestCount}/6 requests used
            </span>
            <button className="btn btn-ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
          {!isConfigured ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
            }}>
              <AlertTriangle size={32} style={{ color: 'var(--accent-yellow)', marginBottom: '0.5rem' }} />
              <p>Race Monitor API token not configured</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Add VITE_RACEMONITOR_API_TOKEN to your environment
              </p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                  Search for race/event:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. Lucky Dog, ChampCar, LDRL..."
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSearch}
                    disabled={isLoading || !searchTerm.trim()}
                  >
                    <Search size={16} />
                    Search
                  </button>
                </div>
              </div>

              {/* Race Selection */}
              {races.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                    Select race:
                  </label>
                  <select
                    value={selectedRace?.ID || ''}
                    onChange={(e) => {
                      const race = races.find(r => r.ID === e.target.value);
                      if (race) handleSelectRace(race);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">Select a race...</option>
                    {races.map(race => (
                      <option key={race.ID} value={race.ID}>
                        {race.Name} - {race.Date} ({race.Track})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Session Selection */}
              {sessions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                    Select session:
                  </label>
                  <select
                    value={selectedSession?.ID || ''}
                    onChange={(e) => {
                      const session = sessions.find(s => s.ID === e.target.value);
                      setSelectedSession(session || null);
                      setCompetitorData(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">Select a session...</option>
                    {sessions.map(session => (
                      <option key={session.ID} value={session.ID}>
                        {session.Name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Car Number Input */}
              {selectedSession && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                    Car number:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={carNumber}
                      onChange={(e) => setCarNumber(e.target.value)}
                      placeholder="e.g. 123"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleLoadLapData}
                      disabled={isLoading || !carNumber.trim()}
                    >
                      {isLoading ? <RefreshCw size={16} className="spin" /> : <Clock size={16} />}
                      Load Lap Data
                    </button>
                  </div>
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
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                }}>
                  {error}
                </div>
              )}

              {/* Lap Data Display */}
              {competitorData && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ 
                    margin: '0 0 1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '1rem',
                  }}>
                    <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
                    Car #{competitorData.Competitor.Number} - {competitorData.Laps.length} Laps
                  </h3>

                  {/* Flag Stats Summary */}
                  {competitorData.Laps.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                    }}>
                      {(() => {
                        const stats = getFlagStats(competitorData.Laps);
                        return (
                          <>
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(0, 200, 83, 0.1)', 
                              borderRadius: '6px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#00c853' }}>
                                {stats.green}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                🟢 Green Laps
                              </div>
                            </div>
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(255, 193, 7, 0.1)', 
                              borderRadius: '6px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffc107' }}>
                                {stats.yellow}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                🟡 Yellow Laps
                              </div>
                            </div>
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(255, 59, 59, 0.1)', 
                              borderRadius: '6px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff3b3b' }}>
                                {stats.red}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                🔴 Red Laps
                              </div>
                            </div>
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(255, 255, 255, 0.05)', 
                              borderRadius: '6px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {Math.round((stats.green / competitorData.Laps.length) * 100)}%
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Green Flag %
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Key Insight */}
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(0, 150, 255, 0.1)',
                    border: '1px solid var(--accent-blue)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--accent-blue)', fontSize: '0.875rem' }}>
                      💡 This is what Race Monitor adds
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      RedMist shows lap times, but doesn't tell you which laps were under yellow.
                      Race Monitor's <strong>per-lap flag status</strong> lets you calculate "true pace" 
                      by filtering out yellow flag laps - crucial for pit strategy decisions.
                    </p>
                  </div>

                  {/* Lap Table */}
                  <div style={{
                    maxHeight: '300px',
                    overflow: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead style={{ 
                        position: 'sticky', 
                        top: 0, 
                        background: 'var(--bg-tertiary)',
                        zIndex: 1,
                      }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Lap</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Time</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>Flag</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitorData.Laps.map((lap, i) => {
                          const flag = String(lap.FlagStatus).toLowerCase();
                          const isGreen = flag === 'green' || flag === '1';
                          const isYellow = flag === 'yellow' || flag === '2';
                          const isRed = flag === 'red' || flag === '3';
                          
                          return (
                            <tr key={i} style={{
                              background: isYellow ? 'rgba(255, 193, 7, 0.1)' : 
                                          isRed ? 'rgba(255, 59, 59, 0.1)' : 'transparent',
                            }}>
                              <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                {lap.Lap}
                              </td>
                              <td style={{ 
                                padding: '0.35rem 0.5rem', 
                                borderBottom: '1px solid var(--border-color)',
                                fontFamily: 'monospace',
                              }}>
                                {lap.LapTime}
                              </td>
                              <td style={{ 
                                padding: '0.35rem 0.5rem', 
                                borderBottom: '1px solid var(--border-color)',
                                textAlign: 'center',
                              }}>
                                {isGreen && <Flag size={14} style={{ color: '#00c853' }} />}
                                {isYellow && <Flag size={14} style={{ color: '#ffc107' }} />}
                                {isRed && <Flag size={14} style={{ color: '#ff3b3b' }} />}
                                {!isGreen && !isYellow && !isRed && '-'}
                              </td>
                              <td style={{ 
                                padding: '0.35rem 0.5rem', 
                                borderBottom: '1px solid var(--border-color)',
                                textAlign: 'right',
                              }}>
                                P{lap.Position}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          fontSize: '0.7rem',
          color: 'var(--text-tertiary)',
        }}>
          ⚠️ Free tier: 6 requests/minute • The $100/year plan removes this limit
        </div>
      </div>
    </div>
  );
}

