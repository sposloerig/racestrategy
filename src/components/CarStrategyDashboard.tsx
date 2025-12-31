// Car Strategy Dashboard - Deep dive into race strategy
import { useState, useMemo } from 'react';
import { useSessionStore } from '../store';
import type { ControlLogEntry } from '../types/redmist';
import { 
  ArrowLeft,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flag,
  Calculator,
  Users,
  Timer,
  BarChart3,
  Activity,
  Clock,
} from 'lucide-react';

interface CarStrategyDashboardProps {
  carNumber: string;
  onBack: () => void;
}

// Default stint assumptions (can be customized)
const DEFAULT_STINT_LAPS = 45; // Typical stint in endurance racing
const DEFAULT_PIT_TIME_SECONDS = 180; // 3 minute pit stop
const MAX_DRIVER_STINT_MINUTES = 120; // 2-hour max driver stint (ChampCar rule)
const FUEL_STOP_PENALTY_SECONDS = 300; // 5-minute stop when taking fuel

// Helper to parse race time string to milliseconds
function parseRaceTimeToMs(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const [hours, mins, secs] = parts;
    return parseInt(hours) * 3600000 + parseInt(mins) * 60000 + parseFloat(secs) * 1000;
  } else if (parts.length === 2) {
    const [mins, secs] = parts;
    return parseInt(mins) * 60000 + parseFloat(secs) * 1000;
  }
  return 0;
}

// Format milliseconds to HH:MM:SS
function formatMsToTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CarStrategyDashboard({ carNumber, onBack }: CarStrategyDashboardProps) {
  const { carPositions, sessionState, controlLog } = useSessionStore();
  
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [stintLength, setStintLength] = useState(DEFAULT_STINT_LAPS);
  const [maxStintMinutes, setMaxStintMinutes] = useState(MAX_DRIVER_STINT_MINUTES);
  const [pitTimeSeconds, _setPitTimeSeconds] = useState(DEFAULT_PIT_TIME_SECONDS);
  const [_targetGapSeconds, _setTargetGapSeconds] = useState(0);
  const [takingFuel, setTakingFuel] = useState(true); // Whether pit stop includes fuel
  const [stintMode, setStintMode] = useState<'laps' | 'time'>('time'); // Calculate by laps or time
  
  // Suppress unused variable warnings (used for future features)
  void _setPitTimeSeconds;
  void _targetGapSeconds;
  void _setTargetGapSeconds;

  // Get my car data
  const myCarData = useMemo(() => {
    return carPositions.find(car => car.n === carNumber);
  }, [carNumber, carPositions]);

  // Time-based session data
  const sessionTiming = useMemo(() => {
    if (!sessionState) return null;
    
    const runningRaceTimeMs = parseRaceTimeToMs(sessionState.runningRaceTime);
    const timeToGoMs = parseRaceTimeToMs(sessionState.timeToGo);
    const greenTimeMs = sessionState.greenTimeMs ?? 0;
    const yellowTimeMs = sessionState.yellowTimeMs ?? 0;
    const redTimeMs = sessionState.redTimeMs ?? 0;
    const currentFlag = sessionState.currentFlag;
    
    // Get flag durations for analysis
    const flagDurations = sessionState.flagDurations ?? [];
    const currentYellow = flagDurations.find(f => f.f === 2 && !f.e); // Active yellow
    const currentCode35 = currentFlag === 2; // Yellow/Code 35 active
    
    return {
      runningRaceTimeMs,
      timeToGoMs,
      greenTimeMs,
      yellowTimeMs,
      redTimeMs,
      currentFlag,
      currentYellow,
      isYellow: currentCode35,
      numberOfYellows: sessionState.numberOfYellows ?? 0,
      flagDurations,
      sessionStartTime: sessionState.sessionStartTime,
    };
  }, [sessionState]);

  // Calculate driver stint timing
  const stintTiming = useMemo(() => {
    if (!myCarData || !sessionTiming) return null;
    
    const lastPitLap = myCarData.lastLapPitted ?? myCarData.pl ?? 0;
    const currentLap = myCarData.l ?? parseInt(myCarData.ln || '0') ?? 0;
    const lapsSinceLastPit = currentLap - lastPitLap;
    
    // Estimate time since last pit based on laps and average lap time
    const avgLapTimeMs = parseLapTimeToMs(myCarData.bt) || parseLapTimeToMs(myCarData.ltm) || 150000; // Default 2:30
    const estimatedTimeSincePitMs = lapsSinceLastPit * avgLapTimeMs;
    
    // Max stint in milliseconds
    const maxStintMs = maxStintMinutes * 60 * 1000;
    const stintTimeRemainingMs = Math.max(0, maxStintMs - estimatedTimeSincePitMs);
    const stintTimeUsedPercent = Math.min(100, (estimatedTimeSincePitMs / maxStintMs) * 100);
    
    // Calculate effective pit stop time (with fuel penalty if applicable)
    const effectivePitTimeSeconds = takingFuel ? pitTimeSeconds + FUEL_STOP_PENALTY_SECONDS : pitTimeSeconds;
    
    // Calculate how many more stints/pits needed based on time remaining
    const raceTimeRemainingMs = sessionTiming.timeToGoMs;
    const estimatedStintsRemaining = Math.ceil(raceTimeRemainingMs / maxStintMs);
    const estimatedPitsRemaining = Math.max(0, estimatedStintsRemaining - 1); // Current stint counts
    
    // Optimal pit window (when to pit to avoid extra stint)
    // If we pit too late, we might need an extra short stint at the end
    const _lapsRemainingInRace = sessionState?.lapsToGo ?? 0; // Reserved for future use
    void _lapsRemainingInRace;
    const optimalPitWindowStartLap = currentLap + Math.max(0, stintLength - 5); // 5 laps buffer
    const optimalPitWindowEndLap = currentLap + stintLength;
    
    // Warning thresholds
    const isStintCritical = stintTimeRemainingMs < 10 * 60 * 1000; // < 10 min remaining
    const isStintWarning = stintTimeRemainingMs < 20 * 60 * 1000; // < 20 min remaining
    
    return {
      lastPitLap,
      currentLap,
      lapsSinceLastPit,
      estimatedTimeSincePitMs,
      maxStintMs,
      stintTimeRemainingMs,
      stintTimeUsedPercent,
      effectivePitTimeSeconds,
      estimatedStintsRemaining,
      estimatedPitsRemaining,
      optimalPitWindowStartLap,
      optimalPitWindowEndLap,
      isStintCritical,
      isStintWarning,
      raceTimeRemainingMs,
    };
  }, [myCarData, sessionTiming, maxStintMinutes, stintLength, takingFuel, pitTimeSeconds, sessionState]);

  // Yellow flag optimization
  const yellowFlagStrategy = useMemo(() => {
    if (!sessionTiming || !stintTiming) return null;
    
    const isCurrentlyYellow = sessionTiming.isYellow;
    const stintUsed = stintTiming.stintTimeUsedPercent;
    
    // Should we pit under yellow?
    // Pit if: currently yellow AND (stint > 50% used OR approaching max stint)
    const shouldPitUnderYellow = isCurrentlyYellow && (stintUsed > 50 || stintTiming.isStintWarning);
    
    // Calculate time saved by pitting under yellow
    // Under yellow/Code 35, everyone is slow, so you lose less relative time
    const avgLapTimeMs = parseLapTimeToMs(myCarData?.bt) || 150000;
    const yellowLapTimeMs = 180000; // Assume ~3 min lap under yellow (slower pace)
    const timeSavedUnderYellow = avgLapTimeMs - yellowLapTimeMs + (stintTiming.effectivePitTimeSeconds * 1000 * 0.3); // ~30% time saved on pit stop impact
    
    return {
      isCurrentlyYellow,
      shouldPitUnderYellow,
      timeSavedUnderYellow,
      recommendation: shouldPitUnderYellow 
        ? '🟡 PIT NOW - Yellow flag opportunity!' 
        : isCurrentlyYellow 
          ? 'Yellow active - consider pitting if stint > 50%'
          : 'Wait for yellow to optimize pit stop',
    };
  }, [sessionTiming, stintTiming, myCarData]);

  // Get all cars sorted by position
  const sortedCars = useMemo(() => {
    return [...carPositions].sort((a, b) => (a.p ?? a.ovp ?? 0) - (b.p ?? b.ovp ?? 0));
  }, [carPositions]);

  // Get cars ahead and behind (same class)
  const competitorsInClass = useMemo(() => {
    if (!myCarData) return { ahead: [], behind: [] };
    const myClass = myCarData.c ?? myCarData.class;
    const myPos = myCarData.p ?? myCarData.ovp ?? 0;
    
    const classmates = sortedCars.filter(car => 
      (car.c ?? car.class) === myClass && car.n !== carNumber
    );
    
    return {
      ahead: classmates.filter(car => (car.p ?? car.ovp ?? 0) < myPos),
      behind: classmates.filter(car => (car.p ?? car.ovp ?? 0) > myPos),
    };
  }, [myCarData, sortedCars, carNumber]);

  // Get selected competitor data
  const competitorData = useMemo(() => {
    if (!selectedCompetitor) return null;
    return carPositions.find(car => car.n === selectedCompetitor);
  }, [selectedCompetitor, carPositions]);

  // Calculate pit window projection
  const pitWindowProjection = useMemo(() => {
    if (!myCarData) return null;
    
    const currentLap = myCarData.l ?? parseInt(myCarData.ln || '0') ?? 0;
    const lastPitLap = myCarData.pl ?? 0; // Last pit lap
    const lapsSinceLastPit = currentLap - lastPitLap;
    const lapsUntilNextPit = Math.max(0, stintLength - lapsSinceLastPit);
    
    // Calculate time until next pit based on average lap time
    const avgLapTimeMs = parseLapTimeToMs(myCarData.bt) || parseLapTimeToMs(myCarData.ltm) || 0;
    const timeUntilPitMs = lapsUntilNextPit * avgLapTimeMs;
    
    return {
      currentLap,
      lastPitLap,
      lapsSinceLastPit,
      lapsUntilNextPit,
      timeUntilPitMs,
      projectedPitLap: currentLap + lapsUntilNextPit,
      pitCount: myCarData.pc ?? myCarData.pl ?? 0,
    };
  }, [myCarData, stintLength]);

  // Calculate catch/gap analysis
  const catchAnalysis = useMemo(() => {
    if (!myCarData || !competitorData) return null;
    
    const myLapMs = parseLapTimeToMs(myCarData.ltm) || parseLapTimeToMs(myCarData.bt) || 0;
    const theirLapMs = parseLapTimeToMs(competitorData.ltm) || parseLapTimeToMs(competitorData.bt) || 0;
    
    if (myLapMs === 0 || theirLapMs === 0) return null;
    
    const lapTimeDiff = myLapMs - theirLapMs; // Negative = we're faster
    const gapMs = parseGapToMs(competitorData.og ?? competitorData.gl) || 0;
    
    // Calculate laps to catch (if we're faster)
    const lapsToReachZeroGap = lapTimeDiff < 0 ? Math.ceil(gapMs / Math.abs(lapTimeDiff)) : Infinity;
    
    // Calculate what lap times would be needed to catch in X laps
    const lapsRemaining = sessionState?.lapsToGo ?? 100;
    const neededPaceAdvantageMs = gapMs / lapsRemaining;
    const neededLapTimeMs = theirLapMs - neededPaceAdvantageMs;
    
    // Scenarios at different pace deltas
    const scenarios = [
      { delta: 0.5, laps: Math.ceil(gapMs / 500) },
      { delta: 1.0, laps: Math.ceil(gapMs / 1000) },
      { delta: 2.0, laps: Math.ceil(gapMs / 2000) },
      { delta: 3.0, laps: Math.ceil(gapMs / 3000) },
    ];
    
    return {
      myLapMs,
      theirLapMs,
      lapTimeDiff,
      gapMs,
      lapsToReachZeroGap,
      lapsRemaining,
      neededLapTimeMs,
      scenarios,
      weAreFaster: lapTimeDiff < 0,
      theyAreFaster: lapTimeDiff > 0,
    };
  }, [myCarData, competitorData, sessionState]);

  // Competitor pit strategy analysis
  const competitorPitAnalysis = useMemo(() => {
    if (!competitorData) return null;
    
    const theirCurrentLap = competitorData.l ?? parseInt(competitorData.ln || '0') ?? 0;
    const theirPitCount = competitorData.pc ?? competitorData.pl ?? 0;
    const theirLastPitLap = competitorData.pl ?? 0;
    
    // Estimate their stint length based on pit count and laps
    const estimatedStintLength = theirPitCount > 0 
      ? Math.round(theirCurrentLap / theirPitCount)
      : stintLength;
    
    const lapsSinceTheirPit = theirCurrentLap - theirLastPitLap;
    const estimatedLapsUntilTheirPit = Math.max(0, estimatedStintLength - lapsSinceTheirPit);
    
    return {
      pitCount: theirPitCount,
      lastPitLap: theirLastPitLap,
      lapsSinceLastPit: lapsSinceTheirPit,
      estimatedStintLength,
      estimatedLapsUntilPit: estimatedLapsUntilTheirPit,
      currentLap: theirCurrentLap,
    };
  }, [competitorData, stintLength]);

  // Get incidents from control log related to our car or team
  const relevantIncidents = useMemo(() => {
    if (!controlLog || controlLog.length === 0) return [];
    
    const carNumLower = carNumber.toLowerCase();
    
    return controlLog
      .filter(entry => {
        // Control log entries use: n=note, c1=car1, c2=car2, a=action, s=status
        const note = (entry.n || '').toLowerCase();
        const action = (entry.a || '').toLowerCase();
        const status = (entry.s || '').toLowerCase();
        const car1 = (entry.c1 || '').toLowerCase();
        const car2 = (entry.c2 || '').toLowerCase();
        const combinedText = `${note} ${action} ${status}`;
        
        // Check if our car is involved
        const isOurCar = car1 === carNumLower || car2 === carNumLower ||
                         car1 === `#${carNumLower}` || car2 === `#${carNumLower}`;
        
        // Include if our car is involved OR if it's a significant incident
        return isOurCar || 
               combinedText.includes('incident') || 
               combinedText.includes('penalty') ||
               combinedText.includes('black flag') ||
               combinedText.includes('warning');
      })
      .slice(0, 10);
  }, [controlLog, carNumber]);

  const isRaceComplete = sessionState?.currentFlag === 5;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={18} />
            Back to Strategy
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={20} style={{ color: 'var(--accent-yellow)' }} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Car #{carNumber} Strategy Center
            </h2>
          </div>
        </div>
        
        {myCarData && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <StatChip label="Position" value={`P${myCarData.p ?? myCarData.ovp ?? '?'}`} color="var(--accent-yellow)" />
            <StatChip label="Class" value={myCarData.c ?? myCarData.class ?? 'N/A'} />
            <StatChip label="Laps" value={myCarData.l ?? myCarData.ln ?? '-'} />
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '1rem',
        padding: '1rem',
        overflow: 'auto',
      }}>
        {/* Driver Stint Timer - TIME BASED */}
        <div className="card" style={{ gridRow: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Timer size={20} style={{ color: 'var(--accent-orange)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Driver Stint</h3>
            </div>
            {/* Yellow Flag Alert */}
            {yellowFlagStrategy?.isCurrentlyYellow && (
              <div style={{
                padding: '0.25rem 0.5rem',
                background: 'rgba(255, 215, 0, 0.3)',
                border: '1px solid var(--accent-yellow)',
                borderRadius: '4px',
                color: 'var(--accent-yellow)',
                fontSize: '0.75rem',
                fontWeight: 600,
                animation: 'pulse 1s infinite',
              }}>
                🟡 YELLOW
              </div>
            )}
          </div>
          
          {/* Stint Mode Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setStintMode('time')}
              className={`btn btn-sm ${stintMode === 'time' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Clock size={14} /> Time Based
            </button>
            <button
              onClick={() => setStintMode('laps')}
              className={`btn btn-sm ${stintMode === 'laps' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Activity size={14} /> Lap Based
            </button>
          </div>

          {/* Time-based stint settings */}
          {stintMode === 'time' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Max Stint (minutes)
                </label>
                <input
                  type="number"
                  value={maxStintMinutes}
                  onChange={(e) => setMaxStintMinutes(parseInt(e.target.value) || 120)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={takingFuel}
                    onChange={(e) => setTakingFuel(e.target.checked)}
                    style={{ marginRight: '0.25rem' }}
                  />
                  Taking Fuel (+5min)
                </label>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: takingFuel ? 'var(--accent-red)' : 'var(--text-secondary)',
                  marginTop: '0.25rem',
                }}>
                  Pit time: {stintTiming?.effectivePitTimeSeconds ?? pitTimeSeconds}s
                </div>
              </div>
            </div>
          )}

          {/* Lap-based stint settings */}
          {stintMode === 'laps' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Stint Length (laps)
              </label>
              <input
                type="number"
                value={stintLength}
                onChange={(e) => setStintLength(parseInt(e.target.value) || 45)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  marginTop: '0.25rem',
                }}
              />
            </div>
          )}

          {/* Stint Time Display */}
          {stintTiming && stintMode === 'time' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Stint Progress Bar */}
              <div style={{
                padding: '1rem',
                background: stintTiming.isStintCritical 
                  ? 'rgba(255, 59, 59, 0.2)' 
                  : stintTiming.isStintWarning
                    ? 'rgba(255, 215, 0, 0.2)'
                    : 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: stintTiming.isStintCritical 
                  ? '1px solid var(--accent-red)'
                  : stintTiming.isStintWarning
                    ? '1px solid var(--accent-yellow)'
                    : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stint Time Used</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {formatMsToTime(stintTiming.estimatedTimeSincePitMs)} / {maxStintMinutes}min
                  </span>
                </div>
                <div style={{
                  height: '12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${stintTiming.stintTimeUsedPercent}%`,
                    height: '100%',
                    background: stintTiming.isStintCritical 
                      ? 'var(--accent-red)' 
                      : stintTiming.isStintWarning
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-green)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                  <div style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 700,
                    color: stintTiming.isStintCritical ? 'var(--accent-red)' : 'var(--text-primary)',
                  }}>
                    {formatMsToTime(stintTiming.stintTimeRemainingMs)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Time Remaining in Stint
                  </div>
                </div>
              </div>
              
              {/* Race Planning */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MiniStat label="Laps in Stint" value={stintTiming.lapsSinceLastPit} />
                <MiniStat label="Pit Stops" value={myCarData?.pc ?? myCarData?.pl ?? 0} />
                <MiniStat label="Est. Stints Left" value={stintTiming.estimatedStintsRemaining} />
                <MiniStat label="Est. Pits Left" value={stintTiming.estimatedPitsRemaining} />
              </div>

              {/* Yellow Flag Recommendation */}
              {yellowFlagStrategy && (
                <div style={{
                  padding: '0.75rem',
                  background: yellowFlagStrategy.shouldPitUnderYellow 
                    ? 'rgba(255, 215, 0, 0.2)' 
                    : 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: yellowFlagStrategy.shouldPitUnderYellow 
                    ? '1px solid var(--accent-yellow)' 
                    : 'none',
                }}>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    color: yellowFlagStrategy.shouldPitUnderYellow 
                      ? 'var(--accent-yellow)' 
                      : 'var(--text-secondary)',
                  }}>
                    {yellowFlagStrategy.recommendation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lap-based display (original) */}
          {pitWindowProjection && stintMode === 'laps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                padding: '1rem',
                background: pitWindowProjection.lapsUntilNextPit <= 5 
                  ? 'rgba(255, 59, 59, 0.2)' 
                  : 'var(--bg-tertiary)',
                borderRadius: '8px',
                textAlign: 'center',
                border: pitWindowProjection.lapsUntilNextPit <= 5 
                  ? '1px solid var(--accent-red)'
                  : '1px solid transparent',
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                  {pitWindowProjection.lapsUntilNextPit}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Laps until pit window
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MiniStat label="Current Lap" value={pitWindowProjection.currentLap} />
                <MiniStat label="Pit Stops" value={pitWindowProjection.pitCount} />
                <MiniStat label="Laps in Stint" value={pitWindowProjection.lapsSinceLastPit} />
                <MiniStat label="Projected Pit" value={`Lap ${pitWindowProjection.projectedPitLap}`} />
              </div>

              {pitWindowProjection.timeUntilPitMs > 0 && (
                <div style={{ 
                  padding: '0.5rem', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ~{formatTime(pitWindowProjection.timeUntilPitMs)} until pit
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Competitor Selection & Catch Calculator */}
        <div className="card" style={{ gridRow: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calculator size={20} style={{ color: 'var(--accent-green)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Catch Calculator</h3>
          </div>
          
          {/* Competitor selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Select Target
            </label>
            <select
              value={selectedCompetitor || ''}
              onChange={(e) => setSelectedCompetitor(e.target.value || null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
              }}
            >
              <option value="">Choose competitor...</option>
              <optgroup label="Cars Ahead">
                {competitorsInClass.ahead.map(car => (
                  <option key={car.n} value={car.n || ''}>
                    P{car.p ?? car.ovp} - #{car.n}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cars Behind">
                {competitorsInClass.behind.map(car => (
                  <option key={car.n} value={car.n || ''}>
                    P{car.p ?? car.ovp} - #{car.n}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {catchAnalysis && competitorData && (
            <>
              {/* Gap summary */}
              <div style={{
                padding: '1rem',
                background: catchAnalysis.weAreFaster 
                  ? 'rgba(0, 255, 127, 0.1)' 
                  : 'rgba(255, 59, 59, 0.1)',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: `1px solid ${catchAnalysis.weAreFaster ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <span style={{ fontWeight: 600 }}>vs #{competitorData.n}</span>
                  {catchAnalysis.weAreFaster ? (
                    <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <TrendingUp size={14} /> Closing
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <TrendingDown size={14} /> Opening
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Gap: {formatTime(catchAnalysis.gapMs)}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Pace diff: {catchAnalysis.lapTimeDiff > 0 ? '+' : ''}{(catchAnalysis.lapTimeDiff / 1000).toFixed(2)}s/lap
                </div>
              </div>

              {/* Lap time comparison */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Your Lap</div>
                  <div style={{ fontWeight: 600 }}>{formatTime(catchAnalysis.myLapMs)}</div>
                </div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Their Lap</div>
                  <div style={{ fontWeight: 600 }}>{formatTime(catchAnalysis.theirLapMs)}</div>
                </div>
              </div>

              {/* Catch scenarios */}
              <div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                }}>
                  LAPS TO CATCH AT PACE ADVANTAGE:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {catchAnalysis.scenarios.map(scenario => (
                    <div
                      key={scenario.delta}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span>+{scenario.delta}s faster/lap</span>
                      <span style={{ fontWeight: 600 }}>
                        {scenario.laps === Infinity ? '∞' : scenario.laps} laps
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needed lap time */}
              {catchAnalysis.lapsRemaining > 0 && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.1))',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-yellow)',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    To catch before checkered ({catchAnalysis.lapsRemaining} laps remaining):
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                    Need: {formatTime(catchAnalysis.neededLapTimeMs)}/lap
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedCompetitor && (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: 'var(--text-secondary)',
            }}>
              <Users size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>Select a competitor to analyze</p>
            </div>
          )}
        </div>

        {/* Race Timing & Flags */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Flag size={20} style={{ color: sessionTiming?.isYellow ? 'var(--accent-yellow)' : 'var(--accent-green)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Race Timing & Flags</h3>
          </div>

          {sessionTiming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Current Flag Status */}
              <div style={{
                padding: '0.75rem',
                background: sessionTiming.isYellow 
                  ? 'rgba(255, 215, 0, 0.2)' 
                  : 'rgba(0, 255, 0, 0.1)',
                borderRadius: '8px',
                border: sessionTiming.isYellow 
                  ? '1px solid var(--accent-yellow)' 
                  : '1px solid var(--accent-green)',
                textAlign: 'center',
              }}>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 700,
                  color: sessionTiming.isYellow ? 'var(--accent-yellow)' : 'var(--accent-green)',
                }}>
                  {sessionTiming.isYellow ? '🟡 YELLOW / CODE 35' : '🟢 GREEN FLAG'}
                </div>
                {sessionTiming.isYellow && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', marginTop: '0.25rem' }}>
                    Consider pitting now if stint &gt; 50%!
                  </div>
                )}
              </div>

              {/* Race Time Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MiniStat 
                  label="Race Time" 
                  value={sessionState?.runningRaceTime ?? '--:--:--'} 
                />
                <MiniStat 
                  label="Time Remaining" 
                  value={sessionState?.timeToGo ?? '--:--:--'} 
                />
                <MiniStat 
                  label="Green Time" 
                  value={formatMsToTime(sessionTiming.greenTimeMs)} 
                  color="var(--accent-green)"
                />
                <MiniStat 
                  label="Yellow Time" 
                  value={formatMsToTime(sessionTiming.yellowTimeMs)} 
                  color="var(--accent-yellow)"
                />
              </div>

              {/* Yellow Count */}
              <div style={{
                padding: '0.5rem',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total Yellow Flags
                </span>
                <span style={{ fontWeight: 600, color: 'var(--accent-yellow)' }}>
                  {sessionTiming.numberOfYellows}
                </span>
              </div>

              {/* Fuel Strategy Note */}
              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
                borderLeft: '3px solid var(--accent-blue)',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  💡 Fuel Stop Strategy
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Taking fuel adds 5-min penalty. Optimize by pitting under yellow 
                  when stint is &gt; 50% used to minimize time lost.
                </div>
              </div>
            </div>
          )}

          {!sessionTiming && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
              No timing data available
            </div>
          )}
        </div>

        {/* Competitor Pit Strategy */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Activity size={20} style={{ color: 'var(--accent-purple)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Competitor Pit Strategy</h3>
          </div>

          {competitorPitAnalysis && competitorData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ 
                padding: '0.75rem', 
                background: 'var(--bg-tertiary)', 
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  #{competitorData.n} Est. Pit In
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: competitorPitAnalysis.estimatedLapsUntilPit <= 5 
                    ? 'var(--accent-yellow)' 
                    : 'var(--text-primary)',
                }}>
                  ~{competitorPitAnalysis.estimatedLapsUntilPit} laps
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MiniStat label="Their Pit Stops" value={competitorPitAnalysis.pitCount} />
                <MiniStat label="Laps in Stint" value={competitorPitAnalysis.lapsSinceLastPit} />
                <MiniStat label="Est. Stint" value={`${competitorPitAnalysis.estimatedStintLength} laps`} />
                <MiniStat label="Current Lap" value={competitorPitAnalysis.currentLap} />
              </div>

              {/* Pit timing advantage */}
              {pitWindowProjection && (
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}>
                  <strong>Strategy Note:</strong>{' '}
                  {competitorPitAnalysis.estimatedLapsUntilPit < pitWindowProjection.lapsUntilNextPit
                    ? `They'll pit ~${pitWindowProjection.lapsUntilNextPit - competitorPitAnalysis.estimatedLapsUntilPit} laps before you`
                    : competitorPitAnalysis.estimatedLapsUntilPit > pitWindowProjection.lapsUntilNextPit
                      ? `You'll pit ~${competitorPitAnalysis.estimatedLapsUntilPit - pitWindowProjection.lapsUntilNextPit} laps before them`
                      : 'Similar pit windows'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: 'var(--text-secondary)',
            }}>
              <BarChart3 size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>Select a competitor above</p>
            </div>
          )}
        </div>

        {/* Incidents & Control Log */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--accent-red)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Race Incidents</h3>
          </div>

          {relevantIncidents.length > 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem',
              maxHeight: '200px',
              overflow: 'auto',
            }}>
              {relevantIncidents.map((entry, idx) => (
                <IncidentRow 
                  key={idx} 
                  entry={entry}
                  carNumber={carNumber}
                  isOurCar={false}
                />
              ))}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '1.5rem',
              color: 'var(--text-secondary)',
            }}>
              <Flag size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No relevant incidents</p>
            </div>
          )}
        </div>
      </div>

      {/* Race status footer */}
      {isRaceComplete && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(0, 255, 127, 0.1)',
          borderTop: '1px solid rgba(0, 255, 127, 0.3)',
          textAlign: 'center',
          color: 'var(--accent-green)',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          <Flag size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Race Complete - Final Results
        </div>
      )}
    </div>
  );
}

// Helper components
function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      padding: '0.375rem 0.75rem',
      background: 'var(--bg-tertiary)',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      padding: '0.5rem',
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function IncidentRow({ entry, isOurCar, carNumber }: { entry: ControlLogEntry; isOurCar: boolean; carNumber: string }) {
  // Control log entries use: n=note, c1=car1, c2=car2, a=action, s=status, t=time, cor=corner
  const note = entry.n || '';
  const action = entry.a || '';
  const status = entry.s || '';
  const car1 = entry.c1 || '';
  const car2 = entry.c2 || '';
  const corner = entry.cor || '';
  const timestamp = entry.t || '';
  
  // Build display message
  const message = [note, action && `(${action})`].filter(Boolean).join(' ') || 'Entry';
  const carsInvolved = car2 ? `${car1} & ${car2}` : car1;
  const location = corner ? `@ Turn ${corner}` : '';
  
  const combinedText = `${note} ${action} ${status}`.toLowerCase();
  const isIncident = combinedText.includes('incident') || combinedText.includes('spin') || combinedText.includes('off track');
  const isPenalty = combinedText.includes('penalty') || combinedText.includes('black flag');
  
  // Check if our car is involved
  const carNumLower = carNumber.toLowerCase();
  const isOurCarInEntry = car1.toLowerCase() === carNumLower || car2.toLowerCase() === carNumLower;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '0.75rem',
      background: (isOurCar || isOurCarInEntry)
        ? 'rgba(255, 215, 0, 0.15)' 
        : isPenalty
          ? 'rgba(255, 59, 59, 0.1)'
          : 'var(--bg-secondary)',
      borderRadius: '8px',
      borderLeft: `3px solid ${(isOurCar || isOurCarInEntry) ? 'var(--accent-yellow)' : isPenalty ? 'var(--accent-red)' : 'var(--border-color)'}`,
    }}>
      {isIncident ? (
        <AlertTriangle size={16} style={{ color: 'var(--accent-yellow)', flexShrink: 0, marginTop: '2px' }} />
      ) : isPenalty ? (
        <Flag size={16} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: '2px' }} />
      ) : (
        <Activity size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          {carsInvolved && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{carsInvolved}</span>}
          {location && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{location}</span>}
        </div>
        <div style={{ fontSize: '0.875rem' }}>{message}</div>
        {status && (
          <div style={{ 
            fontSize: '0.75rem', 
            color: isPenalty ? 'var(--accent-red)' : 'var(--text-secondary)', 
            marginTop: '0.25rem',
            fontWeight: isPenalty ? 600 : 400,
          }}>
            {status}
          </div>
        )}
        {timestamp && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {timestamp}
          </div>
        )}
      </div>
      {(isOurCar || isOurCarInEntry) && (
        <span style={{
          padding: '0.125rem 0.5rem',
          background: 'var(--accent-yellow)',
          color: 'black',
          borderRadius: '4px',
          fontSize: '0.625rem',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          OUR CAR
        </span>
      )}
    </div>
  );
}

// Utility functions
function parseLapTimeToMs(timeStr: string | null | undefined): number {
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

function parseGapToMs(gapStr: string | null | undefined): number {
  if (!gapStr) return 0;
  // Handle "X laps" format
  if (gapStr.includes('lap')) {
    const laps = parseInt(gapStr) || 0;
    return laps * 150000; // Assume ~2:30 lap time
  }
  // Handle time format
  return parseLapTimeToMs(gapStr);
}

function formatTime(ms: number): string {
  if (ms <= 0) return '-';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

