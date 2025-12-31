// Race Replay / Time Machine - Analyze historical race data at any point
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSessionStore, useUIStore } from '../store';
import { api } from '../lib/api';
import { db, isSupabaseEnabled } from '../lib/supabase';
import type { CarPosition, EventEntry } from '../types/redmist';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Clock,
  Flag,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  Database,
  Cloud,
} from 'lucide-react';

interface RaceReplayProps {
  eventId: number;
  sessionId: number;
  onClose: () => void;
}

interface CarLapData {
  carNumber: string;
  laps: CarPosition[];
  teamName?: string;
  className?: string;
}

interface ReplayState {
  currentLap: number;
  positions: CarPosition[];
  isPlaying: boolean;
  playbackSpeed: number;
}

// Helper to parse lap time to milliseconds
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

export function RaceReplay({ eventId, sessionId, onClose }: RaceReplayProps) {
  const { sessionState, carPositions } = useSessionStore();
  const { myCar } = useUIStore();
  
  const [allCarsLapData, setAllCarsLapData] = useState<CarLapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Checking cache...');
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | null>(null);
  const [cachedLapCount, setCachedLapCount] = useState(0);
  const [skipCache, setSkipCache] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // Ref to track if we've already started loading (prevent re-fetches from store updates)
  const loadingStartedRef = useRef(false);
  // Capture initial car positions to avoid dependency on changing carPositions
  const initialCarPositionsRef = useRef(carPositions);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detect if session is live (not completed - checkered flag = 5)
  const isSessionLive = useMemo(() => {
    return sessionState?.currentFlag !== 5; // Not checkered flag
  }, [sessionState?.currentFlag]);
  
  const [replayState, setReplayState] = useState<ReplayState>({
    currentLap: 1,
    positions: [],
    isPlaying: false,
    playbackSpeed: 1,
  });

  // Get team names from event entries
  const teamLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    if (sessionState?.eventEntries) {
      sessionState.eventEntries.forEach((entry: EventEntry) => {
        if (entry.no && (entry.t || entry.nm)) {
          lookup[entry.no] = entry.t || entry.nm || '';
        }
      });
    }
    return lookup;
  }, [sessionState?.eventEntries]);

  // Calculate max lap from all cars
  const maxLap = useMemo(() => {
    if (allCarsLapData.length === 0) return 0;
    return Math.max(...allCarsLapData.map(car => car.laps.length));
  }, [allCarsLapData]);

  // Load lap data - first check Supabase cache, then fall back to API
  useEffect(() => {
    async function loadAllLapData() {
      // Prevent re-fetching if already started or completed
      if (loadingStartedRef.current) return;
      
      const positions = initialCarPositionsRef.current;
      if (!sessionId || positions.length === 0) return;
      
      loadingStartedRef.current = true;
      setIsLoading(true);
      setError(null);
      
      const carNumbers = positions.map(c => c.n).filter(Boolean) as string[];
      
      // Step 1: Check Supabase cache first (unless skipCache is set or session is live)
      // For live sessions, always fetch fresh data from API
      const shouldSkipCache = skipCache || isSessionLive;
      
      if (isSupabaseEnabled() && !shouldSkipCache) {
        setLoadingMessage('Checking database cache...');
        console.log('[RaceReplay] Checking Supabase cache...');
        
        try {
          const cachedLaps = await db.getLapsForSession(sessionId);
          
          if (cachedLaps && cachedLaps.length > 0) {
            console.log(`[RaceReplay] Found ${cachedLaps.length} cached laps in Supabase!`);
            setCachedLapCount(cachedLaps.length);
            setLoadingMessage(`Loading ${cachedLaps.length.toLocaleString()} cached laps...`);
            
            // Group laps by car number
            const lapsByCarNumber = new Map<string, CarPosition[]>();
            for (const lap of cachedLaps) {
              const carNum = lap.car_number;
              if (!lapsByCarNumber.has(carNum)) {
                lapsByCarNumber.set(carNum, []);
              }
              // Convert DB lap to CarPosition format
              lapsByCarNumber.get(carNum)!.push({
                n: carNum,
                c: undefined, // Will be filled from positions
                l: lap.lap_number,
                ln: String(lap.lap_number),
                ltm: lap.lap_time_formatted || undefined,
                bt: lap.best_lap_time_ms ? formatMsToTime(lap.best_lap_time_ms) : undefined,
                ovp: lap.position || undefined,
                p: lap.position || undefined,
                og: lap.gap_to_leader || undefined,
                ip: lap.pit_in || undefined,
                raw_data: lap.raw_data,
              } as CarPosition);
            }
            
            // Build lap data array
            const lapDataArray: CarLapData[] = [];
            for (const carNumber of carNumbers) {
              const car = positions.find(c => c.n === carNumber);
              lapDataArray.push({
                carNumber,
                laps: lapsByCarNumber.get(carNumber) || [],
                teamName: teamLookup[carNumber],
                className: car?.c || car?.class || undefined,
              });
            }
            
            setAllCarsLapData(lapDataArray);
            setIsLoading(false);
            setDataSource('cache');
            setLoadingProgress(100);
            setLastRefreshTime(new Date());
            
            console.log(`[RaceReplay] Loaded from cache: ${lapDataArray.length} cars`);
            
            // Set initial replay state
            if (lapDataArray.length > 0) {
              updatePositionsAtLap(1, lapDataArray);
            }
            return;
          }
        } catch (err) {
          console.warn('[RaceReplay] Cache check failed, falling back to API:', err);
        }
      }
      
      // Step 2: Fetch from API (cache miss or Supabase disabled)
      setLoadingMessage('Fetching from API...');
      console.log(`[RaceReplay] Loading lap data for ${carNumbers.length} cars from API...`);
      
      const lapDataArray: CarLapData[] = [];
      const allLapsForDb: Array<{
        session_id: number;
        car_number: string;
        lap_number: number;
        lap_time_ms?: number;
        lap_time_formatted?: string;
        position?: number;
        gap_to_leader?: string;
        best_lap_time_ms?: number;
        pit_in?: boolean;
        pit_out?: boolean;
        raw_data?: Record<string, unknown>;
      }> = [];
      
      for (let i = 0; i < carNumbers.length; i++) {
        const carNumber = carNumbers[i];
        setLoadingMessage(`Loading car ${carNumber} (${i + 1}/${carNumbers.length})...`);
        
        try {
          const laps = await api.getCarLaps(eventId, sessionId, carNumber);
          const car = positions.find(c => c.n === carNumber);
          
          // Log first car's data structure for debugging
          if (i === 0 && laps && laps.length > 0) {
            const firstLap = laps[0];
            console.log(`[RaceReplay] Sample lap data for car ${carNumber}:`, {
              totalLaps: laps.length,
              firstLap,
              lastLap: laps[laps.length - 1],
              fields: Object.keys(firstLap),
              lapNumField_l: firstLap.l,
              lapNumField_ln: firstLap.ln,
              parsedLapNum: firstLap.l ?? parseInt(firstLap.ln || '0'),
            });
          }
          
          lapDataArray.push({
            carNumber,
            laps: laps || [],
            teamName: teamLookup[carNumber],
            className: car?.c || car?.class || undefined,
          });
          
          // Prepare laps for database storage
          // The laps array is indexed by lap number (index 0 = lap 1, index 1 = lap 2, etc.)
          if (laps && laps.length > 0) {
            for (let lapIndex = 0; lapIndex < laps.length; lapIndex++) {
              const lap = laps[lapIndex];
              const lapNum = lapIndex + 1; // Array index is lap number - 1
              
              allLapsForDb.push({
                session_id: sessionId,
                car_number: carNumber,
                lap_number: lapNum,
                lap_time_ms: parseLapTimeToMs(lap.ltm),
                lap_time_formatted: lap.ltm || undefined,
                position: lap.ovp ?? lap.p ?? lap.llo,
                gap_to_leader: lap.og ?? lap.gl,
                best_lap_time_ms: parseLapTimeToMs(lap.bt),
                pit_in: lap.ip,
                pit_out: lap.op,
                raw_data: lap as unknown as Record<string, unknown>,
              });
            }
          }
        } catch (err) {
          console.error(`Failed to load laps for car ${carNumber}:`, err);
        }
        setLoadingProgress(Math.round(((i + 1) / carNumbers.length) * 100));
      }
      
      console.log(`[RaceReplay] Loaded data for ${lapDataArray.length} cars, max laps:`, 
        Math.max(...lapDataArray.map(c => c.laps.length)));
      console.log(`[RaceReplay] Prepared ${allLapsForDb.length} laps for caching`);
      
      // Step 3: Save to Supabase cache for next time
      if (isSupabaseEnabled() && allLapsForDb.length > 0) {
        setLoadingMessage(`Caching ${allLapsForDb.length.toLocaleString()} laps...`);
        console.log(`[RaceReplay] Saving ${allLapsForDb.length} laps to Supabase cache...`);
        
        try {
          const inserted = await db.upsertLaps(allLapsForDb);
          console.log(`[RaceReplay] Cached ${inserted} laps to Supabase`);
        } catch (err) {
          console.warn('[RaceReplay] Failed to cache laps:', err);
        }
      }
      
      setAllCarsLapData(lapDataArray);
      setIsLoading(false);
      setDataSource('api');
      setSkipCache(false); // Reset so future opens can use cache
      setLastRefreshTime(new Date());
      
      // Set initial replay state to first lap
      if (lapDataArray.length > 0) {
        updatePositionsAtLap(1, lapDataArray);
      }
    }
    
    loadAllLapData();
  // Only run on mount or when refreshTrigger changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, sessionId, refreshTrigger, isSessionLive]);

  // Helper to format milliseconds back to time string
  function formatMsToTime(ms: number): string {
    if (!ms || ms === 0) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  // Force refresh from API (clear cache for this session)
  const forceRefresh = useCallback(() => {
    loadingStartedRef.current = false;
    setAllCarsLapData([]);
    setDataSource(null);
    setCachedLapCount(0);
    setLoadingProgress(0);
    setIsLoading(true);
    setSkipCache(true); // Skip cache and fetch from API
    setRefreshTrigger(n => n + 1); // Trigger useEffect re-run
    setLastRefreshTime(new Date());
  }, []);

  // Auto-refresh for live sessions (every 30 seconds)
  useEffect(() => {
    // Only auto-refresh if:
    // 1. Session is live (not completed)
    // 2. Auto-refresh is enabled
    // 3. Not currently loading
    if (!isSessionLive || !autoRefreshEnabled || isLoading) {
      // Clear any existing interval
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
      return;
    }
    
    console.log('[RaceReplay] Starting auto-refresh for live session (every 30s)');
    
    autoRefreshIntervalRef.current = setInterval(() => {
      console.log('[RaceReplay] Auto-refreshing live session data...');
      loadingStartedRef.current = false;
      setSkipCache(true); // Always fetch fresh from API during live
      setRefreshTrigger(n => n + 1);
      setLastRefreshTime(new Date());
    }, 30000); // 30 seconds
    
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [isSessionLive, autoRefreshEnabled, isLoading]);

  // Update positions at a specific lap
  const updatePositionsAtLap = useCallback((lap: number, lapData: CarLapData[] = allCarsLapData) => {
    const positionsAtLap: CarPosition[] = [];
    
    for (const carData of lapData) {
      // Find the lap data for this car at the specified lap
      // The laps array should be indexed by lap number (lap 1 = index 0, etc.)
      // Or we search for the entry with matching lap number
      
      let lapEntry: CarPosition | undefined;
      
      // First try: direct index access (lap 1 = index 0)
      if (carData.laps.length >= lap) {
        lapEntry = carData.laps[lap - 1];
      }
      
      // Second try: search by lap number fields
      if (!lapEntry) {
        lapEntry = carData.laps.find(l => {
          const lapNum = l.l ?? parseInt(l.ln || '0');
          return lapNum === lap;
        });
      }
      
      if (lapEntry) {
        // Get the position at this lap - try multiple fields:
        // llo = Last Lap Overall Position (position when this lap was completed)
        // ovp = Overall Position
        // p = Position (abbreviated)
        // llp = Last Lap Position
        const positionAtLap = lapEntry.llo ?? lapEntry.ovp ?? lapEntry.p ?? lapEntry.llp;
        
        positionsAtLap.push({
          ...lapEntry,
          n: carData.carNumber,
          c: carData.className,
          // Ensure we capture the position at this lap
          ovp: positionAtLap,
          p: positionAtLap,
        });
      } else if (carData.laps.length > 0 && lap > carData.laps.length) {
        // Car hasn't completed this lap yet - they're behind
        // Use their last completed lap's data
        const lastLap = carData.laps[carData.laps.length - 1];
        const lastLapNum = lastLap.l ?? parseInt(lastLap.ln || '0') ?? carData.laps.length;
        
        positionsAtLap.push({
          ...lastLap,
          n: carData.carNumber,
          c: carData.className,
          // Mark them as being behind - laps down
          l: lastLapNum,
        });
      }
    }
    
    // Sort by:
    // 1. Who has completed the most laps (more laps = higher position)
    // 2. Among cars on same lap, by their recorded position or time
    positionsAtLap.sort((a, b) => {
      const lapsA = a.l ?? parseInt(a.ln || '0') ?? 0;
      const lapsB = b.l ?? parseInt(b.ln || '0') ?? 0;
      
      // More laps completed = better position
      if (lapsA !== lapsB) return lapsB - lapsA;
      
      // Same laps - sort by recorded position
      const posA = a.ovp ?? a.p ?? a.llo ?? 999;
      const posB = b.ovp ?? b.p ?? b.llo ?? 999;
      
      if (posA !== posB && posA !== 999 && posB !== 999) {
        return posA - posB;
      }
      
      // Fallback: sort by lap time (faster = better)
      const timeA = parseLapTimeToMs(a.ltm);
      const timeB = parseLapTimeToMs(b.ltm);
      return timeA - timeB;
    });
    
    // Assign display positions based on sorted order
    positionsAtLap.forEach((car, index) => {
      car.p = index + 1;
      car.ovp = index + 1;
    });
    
    console.log(`[RaceReplay] Lap ${lap}: ${positionsAtLap.length} cars`);
    if (positionsAtLap.length > 0) {
      console.log(`[RaceReplay] Top 3:`, positionsAtLap.slice(0, 3).map(c => ({
        car: c.n,
        pos: c.ovp,
        laps: c.l ?? c.ln,
        lapTime: c.ltm,
      })));
    }
    
    setReplayState(prev => ({
      ...prev,
      currentLap: lap,
      positions: positionsAtLap,
    }));
  }, [allCarsLapData]);

  // Playback controls
  const play = useCallback(() => {
    setReplayState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setReplayState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const goToLap = useCallback((lap: number) => {
    const clampedLap = Math.max(1, Math.min(lap, maxLap));
    updatePositionsAtLap(clampedLap);
  }, [maxLap, updatePositionsAtLap]);

  const stepForward = useCallback(() => {
    goToLap(replayState.currentLap + 1);
  }, [replayState.currentLap, goToLap]);

  const stepBackward = useCallback(() => {
    goToLap(replayState.currentLap - 1);
  }, [replayState.currentLap, goToLap]);

  const jumpForward = useCallback(() => {
    goToLap(replayState.currentLap + 10);
  }, [replayState.currentLap, goToLap]);

  const jumpBackward = useCallback(() => {
    goToLap(replayState.currentLap - 10);
  }, [replayState.currentLap, goToLap]);

  const goToStart = useCallback(() => {
    goToLap(1);
  }, [goToLap]);

  const goToEnd = useCallback(() => {
    goToLap(maxLap);
  }, [maxLap, goToLap]);

  // Auto-advance when playing
  useEffect(() => {
    if (!replayState.isPlaying || replayState.currentLap >= maxLap) {
      if (replayState.currentLap >= maxLap && replayState.isPlaying) {
        pause();
      }
      return;
    }

    const interval = setInterval(() => {
      setReplayState(prev => {
        const nextLap = prev.currentLap + 1;
        if (nextLap > maxLap) {
          return { ...prev, isPlaying: false };
        }
        updatePositionsAtLap(nextLap);
        return { ...prev, currentLap: nextLap };
      });
    }, 1000 / replayState.playbackSpeed);

    return () => clearInterval(interval);
  }, [replayState.isPlaying, replayState.currentLap, replayState.playbackSpeed, maxLap, pause, updatePositionsAtLap]);

  // Calculate gap changes between laps for "my car"
  const myCarAnalysis = useMemo(() => {
    if (!myCar || allCarsLapData.length === 0) return null;
    
    const myCarData = allCarsLapData.find(c => c.carNumber === myCar);
    if (!myCarData || myCarData.laps.length === 0) return null;
    
    const currentLapData = myCarData.laps.find(l => parseInt(l.ln || '0') === replayState.currentLap);
    const prevLapData = myCarData.laps.find(l => parseInt(l.ln || '0') === replayState.currentLap - 1);
    
    if (!currentLapData) return null;
    
    const posChange = prevLapData 
      ? (prevLapData.ovp ?? prevLapData.p ?? 0) - (currentLapData.ovp ?? currentLapData.p ?? 0)
      : 0;
    
    return {
      position: currentLapData.ovp ?? currentLapData.p ?? 0,
      lapTime: currentLapData.ltm,
      bestLap: currentLapData.bt,
      isBestLap: currentLapData.ibt,
      positionChange: posChange,
      gap: currentLapData.og ?? currentLapData.gl,
      inPit: currentLapData.ip,
    };
  }, [myCar, allCarsLapData, replayState.currentLap]);

  // Get flag status at current lap (approximation based on lap times)
  const estimatedFlagStatus = useMemo(() => {
    // Check if multiple cars had slow laps at this point (indicating yellow)
    const carsAtLap = replayState.positions;
    if (carsAtLap.length === 0) return 'unknown';
    
    // Count cars with significantly slower lap times
    const avgLapTime = carsAtLap.reduce((sum, car) => sum + parseLapTimeToMs(car.ltm), 0) / carsAtLap.length;
    const slowCars = carsAtLap.filter(car => parseLapTimeToMs(car.ltm) > avgLapTime * 1.3).length;
    
    // If many cars are slow, likely yellow flag
    if (slowCars > carsAtLap.length * 0.5) return 'yellow';
    return 'green';
  }, [replayState.positions]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '1rem',
      }}>
        {loadingMessage.includes('cache') ? (
          <Database size={32} style={{ color: 'var(--accent-blue)', animation: 'pulse 1s ease-in-out infinite' }} />
        ) : (
          <RefreshCw size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
        )}
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>Loading Race History...</div>
        <div style={{ 
          width: '200px', 
          height: '8px', 
          background: 'var(--bg-tertiary)', 
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${loadingProgress}%`,
            height: '100%',
            background: loadingMessage.includes('cache') ? 'var(--accent-green)' : 'var(--accent-blue)',
            transition: 'width 0.2s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {loadingMessage}
        </div>
        {isSupabaseEnabled() && (
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            <Database size={12} />
            Database caching enabled
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '1rem',
        color: 'var(--accent-red)',
      }}>
        <AlertTriangle size={32} />
        <div>{error}</div>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    );
  }

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
          <Clock size={24} style={{ color: 'var(--accent-blue)' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Race Replay</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Analyze any point in the race
              {dataSource && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.125rem 0.5rem',
                  background: dataSource === 'cache' ? 'rgba(0, 255, 0, 0.15)' : 'rgba(0, 150, 255, 0.15)',
                  color: dataSource === 'cache' ? 'var(--accent-green)' : 'var(--accent-blue)',
                  borderRadius: '4px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                }}>
                  {dataSource === 'cache' ? (
                    <>
                      <Database size={10} />
                      Cached ({cachedLapCount.toLocaleString()} laps)
                    </>
                  ) : (
                    <>
                      <Cloud size={10} />
                      Live API
                    </>
                  )}
                </span>
              )}
              {/* Live Session Indicator */}
              {isSessionLive && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.125rem 0.5rem',
                  background: 'rgba(255, 100, 100, 0.15)',
                  color: '#ff6b6b',
                  borderRadius: '4px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#ff6b6b',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Auto-refresh toggle for live sessions */}
          {isSessionLive && (
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.375rem',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                style={{ width: '14px', height: '14px' }}
              />
              Auto-refresh
            </label>
          )}
          {/* Last refresh time */}
          {lastRefreshTime && (
            <span style={{ 
              fontSize: '0.625rem', 
              color: 'var(--text-tertiary)',
            }}>
              Updated {lastRefreshTime.toLocaleTimeString()}
            </span>
          )}
          {/* Manual refresh button */}
          <button 
            className="btn btn-ghost" 
            onClick={forceRefresh}
            title="Refresh from API"
            style={{ fontSize: '0.75rem' }}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Timeline Controls */}
      <div style={{
        padding: '1rem',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        {/* Lap Slider */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
          }}>
            <span>Lap {replayState.currentLap}</span>
            <span style={{ color: 'var(--text-secondary)' }}>of {maxLap}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxLap}
            value={replayState.currentLap}
            onChange={(e) => goToLap(parseInt(e.target.value))}
            style={{
              width: '100%',
              accentColor: 'var(--accent-blue)',
            }}
          />
        </div>

        {/* Playback Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          <button className="btn btn-ghost" onClick={goToStart} title="Go to Start">
            <SkipBack size={18} />
          </button>
          <button className="btn btn-ghost" onClick={jumpBackward} title="Back 10 laps">
            <Rewind size={18} />
          </button>
          <button className="btn btn-ghost" onClick={stepBackward} title="Previous lap">
            <SkipBack size={16} />
          </button>
          
          {replayState.isPlaying ? (
            <button 
              className="btn btn-primary" 
              onClick={pause}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              <Pause size={20} />
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={play}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              <Play size={20} />
            </button>
          )}
          
          <button className="btn btn-ghost" onClick={stepForward} title="Next lap">
            <SkipForward size={16} />
          </button>
          <button className="btn btn-ghost" onClick={jumpForward} title="Forward 10 laps">
            <FastForward size={18} />
          </button>
          <button className="btn btn-ghost" onClick={goToEnd} title="Go to End">
            <SkipForward size={18} />
          </button>

          {/* Playback Speed */}
          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Speed:</span>
            {[1, 2, 5, 10].map(speed => (
              <button
                key={speed}
                className={`btn btn-sm ${replayState.playbackSpeed === speed ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReplayState(prev => ({ ...prev, playbackSpeed: speed }))}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: '300px 1fr', 
        gap: '1rem',
        padding: '1rem',
        overflow: 'hidden',
      }}>
        {/* My Car Analysis Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto' }}>
          {/* Current Lap Info */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Flag size={18} style={{ color: estimatedFlagStatus === 'yellow' ? 'var(--accent-yellow)' : 'var(--accent-green)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Lap {replayState.currentLap}</h3>
            </div>
            
            <div style={{
              padding: '0.75rem',
              background: estimatedFlagStatus === 'yellow' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 255, 0, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              marginBottom: '1rem',
            }}>
              <span style={{ 
                color: estimatedFlagStatus === 'yellow' ? 'var(--accent-yellow)' : 'var(--accent-green)',
                fontWeight: 600,
              }}>
                {estimatedFlagStatus === 'yellow' ? '🟡 Possible Yellow Flag' : '🟢 Green Flag Racing'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <MiniStat label="Cars on Track" value={replayState.positions.length} />
              <MiniStat label="Progress" value={`${Math.round((replayState.currentLap / maxLap) * 100)}%`} />
            </div>
          </div>

          {/* My Car Status at this Lap */}
          {myCar && myCarAnalysis && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Target size={18} style={{ color: 'var(--accent-yellow)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  My Car #{myCar} at Lap {replayState.currentLap}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    P{myCarAnalysis.position}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Position</div>
                </div>
                
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                  }}>
                    {myCarAnalysis.positionChange > 0 && (
                      <>
                        <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ color: 'var(--accent-green)' }}>+{myCarAnalysis.positionChange}</span>
                      </>
                    )}
                    {myCarAnalysis.positionChange < 0 && (
                      <>
                        <TrendingDown size={14} style={{ color: 'var(--accent-red)' }} />
                        <span style={{ color: 'var(--accent-red)' }}>{myCarAnalysis.positionChange}</span>
                      </>
                    )}
                    {myCarAnalysis.positionChange === 0 && (
                      <>
                        <Minus size={14} />
                        <span>0</span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Pos Change</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                <MiniStat 
                  label="Lap Time" 
                  value={myCarAnalysis.lapTime || '-'} 
                  highlight={myCarAnalysis.isBestLap}
                />
                <MiniStat label="Gap" value={myCarAnalysis.gap || '-'} />
              </div>

              {myCarAnalysis.inPit && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(255, 136, 0, 0.2)',
                  border: '1px solid var(--accent-orange)',
                  borderRadius: '6px',
                  textAlign: 'center',
                  color: 'var(--accent-orange)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}>
                  🔧 IN PIT
                </div>
              )}
            </div>
          )}

          {/* What-If Analysis */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Target size={18} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Strategy Notes</h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                Use the timeline to analyze key moments:
              </p>
              <ul style={{ marginLeft: '1rem', marginBottom: 0 }}>
                <li>Pit stop timing opportunities</li>
                <li>Yellow flag periods</li>
                <li>Position battles</li>
                <li>Gap changes over time</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Flag size={18} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Positions at Lap {replayState.currentLap}
            </h3>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Pos</th>
                  <th style={{ width: '60px' }}>No</th>
                  <th style={{ width: '80px' }}>Class</th>
                  <th>Team</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Lap Time</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Best</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Gap</th>
                  <th style={{ width: '50px', textAlign: 'center' }}>Laps</th>
                  <th style={{ width: '50px', textAlign: 'center' }}>Pit</th>
                </tr>
              </thead>
              <tbody>
                {replayState.positions.map((car, index) => {
                  const isMyCar = car.n === myCar;
                  const displayPos = car.ovp ?? car.p ?? index + 1;
                  const carLaps = car.l ?? parseInt(car.ln || '0');
                  
                  return (
                    <tr 
                      key={car.n || index}
                      style={{
                        background: isMyCar ? 'rgba(255, 215, 0, 0.15)' : undefined,
                        borderLeft: isMyCar ? '3px solid var(--accent-yellow)' : undefined,
                      }}
                    >
                      <td>
                        <div className={`position ${displayPos <= 3 ? `position-${displayPos}` : ''}`}>
                          {displayPos}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{car.n}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {car.c || '-'}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {teamLookup[car.n || ''] || '-'}
                      </td>
                      <td style={{ 
                        textAlign: 'right',
                        color: car.ibt ? 'var(--timing-pb)' : undefined,
                      }}>
                        {car.ltm || '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{car.bt || '-'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {car.og ?? car.gl ?? (displayPos === 1 ? 'Leader' : '-')}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {carLaps}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {car.ip && (
                          <span style={{
                            padding: '0.125rem 0.375rem',
                            background: 'var(--accent-orange)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                          }}>
                            PIT
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{
      padding: '0.5rem',
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      textAlign: 'center',
      border: highlight ? '1px solid var(--timing-pb)' : undefined,
    }}>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ 
        fontWeight: 600, 
        fontSize: '0.875rem',
        color: highlight ? 'var(--timing-pb)' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

