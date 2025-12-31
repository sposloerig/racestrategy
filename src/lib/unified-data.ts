/**
 * Unified Data Layer
 * 
 * Merges and correlates data from RedMist and Race-Monitor APIs
 * using transponder numbers as the common key.
 * 
 * This allows us to:
 * 1. Get the best data from each source
 * 2. Fill in gaps (e.g., Race-Monitor has per-lap flag status)
 * 3. Save combined historical data
 */

import type { CarPosition, SessionState } from '../types/redmist';
import type { 
  RMCompetitor, 
  RMLapTime, 
  RMLiveCompetitor,
  UnifiedLapData,
  UnifiedCompetitor,
  TransponderMapping,
} from '../types/racemonitor';
import { parseRMTime, normalizeRMFlagStatus, extractTeamFromAdditionalData } from './racemonitor';

// =============================================================================
// Transponder Mapping Store
// =============================================================================

/**
 * In-memory store for transponder mappings
 * In production, this could be persisted to localStorage or a database
 */
class TransponderStore {
  private mappings: Map<string, TransponderMapping> = new Map();

  /**
   * Add or update a transponder mapping
   */
  set(transponder: string, data: Partial<TransponderMapping>) {
    const existing = this.mappings.get(transponder) || { transponder, carNumber: '' };
    this.mappings.set(transponder, { ...existing, ...data, transponder });
  }

  /**
   * Get mapping by transponder
   */
  getByTransponder(transponder: string): TransponderMapping | undefined {
    return this.mappings.get(transponder);
  }

  /**
   * Get mapping by car number
   */
  getByCarNumber(carNumber: string): TransponderMapping | undefined {
    for (const mapping of this.mappings.values()) {
      if (mapping.carNumber === carNumber) {
        return mapping;
      }
    }
    return undefined;
  }

  /**
   * Get all mappings
   */
  getAll(): TransponderMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Load mappings from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('transponder-mappings');
      if (stored) {
        const data = JSON.parse(stored) as TransponderMapping[];
        data.forEach(m => this.mappings.set(m.transponder, m));
      }
    } catch (e) {
      console.error('[TransponderStore] Failed to load from storage:', e);
    }
  }

  /**
   * Save mappings to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('transponder-mappings', JSON.stringify(this.getAll()));
    } catch (e) {
      console.error('[TransponderStore] Failed to save to storage:', e);
    }
  }

  /**
   * Clear all mappings
   */
  clear() {
    this.mappings.clear();
  }
}

export const transponderStore = new TransponderStore();

// Initialize from storage on load
if (typeof window !== 'undefined') {
  transponderStore.loadFromStorage();
}

// =============================================================================
// Data Conversion Functions
// =============================================================================

/**
 * Convert RedMist CarPosition to UnifiedCompetitor
 */
export function redmistToUnified(car: CarPosition, sessionState?: SessionState | null): UnifiedCompetitor {
  // Try to find team name from event entries
  let teamName: string | undefined;
  if (sessionState?.eventEntries && car.n) {
    const entry = sessionState.eventEntries.find(e => e.no === car.n);
    if (entry?.t) {
      teamName = entry.t;
    }
  }

  // Get transponder from car data
  const transponder = car.tp?.toString() || '';

  // Update transponder store
  if (transponder && car.n) {
    transponderStore.set(transponder, {
      carNumber: car.n,
      driverName: car.dn || undefined,
      teamName,
      className: car.c || car.class || undefined,
    });
  }

  return {
    transponder,
    carNumber: car.n || '',
    driverName: car.dn || 'Unknown',
    teamName,
    className: car.c || car.class || undefined,
    position: car.p ?? car.ovp ?? 0,
    classPosition: car.cp ?? car.clp,
    laps: car.l ?? parseInt(car.ln || '0') ?? 0,
    lastLapTime: parseTimeToMs(car.ltm),
    bestLapTime: parseTimeToMs(car.bt),
    totalTime: 0, // RedMist doesn't provide this directly
    pitCount: car.pc ?? car.pl,
    inPit: car.ip,
    flagStatus: getFlagName(car.flg),
    sources: { redmist: true },
  };
}

/**
 * Convert Race-Monitor Competitor to UnifiedCompetitor
 */
export function raceMonitorToUnified(
  competitor: RMCompetitor | RMLiveCompetitor,
  lapTimes?: RMLapTime[]
): UnifiedCompetitor {
  const transponder = competitor.Transponder || '';
  const carNumber = competitor.Number || '';
  
  // Extract team from AdditionalData
  const teamName = extractTeamFromAdditionalData(
    'AdditionalData' in competitor ? competitor.AdditionalData : undefined
  );

  // Update transponder store
  if (transponder) {
    transponderStore.set(transponder, {
      carNumber,
      driverName: `${competitor.FirstName} ${competitor.LastName}`.trim(),
      teamName: teamName || undefined,
      className: 'Category' in competitor ? competitor.Category : competitor.ClassID,
    });
  }

  // Convert lap times with flag status
  const lapHistory: UnifiedLapData[] = (lapTimes || []).map(lap => ({
    transponder,
    carNumber,
    lapNumber: parseInt(lap.Lap) || 0,
    lapTime: parseRMTime(lap.LapTime),
    position: parseInt(lap.Position) || 0,
    flagStatus: normalizeRMFlagStatus(lap.FlagStatus),
    totalTime: parseRMTime(lap.TotalTime),
    source: 'racemonitor' as const,
  }));

  return {
    transponder,
    carNumber,
    driverName: `${competitor.FirstName} ${competitor.LastName}`.trim(),
    teamName: teamName || undefined,
    className: 'Category' in competitor ? competitor.Category : competitor.ClassID,
    position: parseInt(competitor.Position) || 0,
    laps: parseInt(competitor.Laps) || 0,
    lastLapTime: parseRMTime(competitor.LastLapTime),
    bestLapTime: parseRMTime(competitor.BestLapTime),
    totalTime: parseRMTime(competitor.TotalTime),
    lapHistory,
    sources: { racemonitor: true },
  };
}

/**
 * Merge data from both sources for the same competitor
 */
export function mergeCompetitorData(
  redmist: UnifiedCompetitor | null,
  raceMonitor: UnifiedCompetitor | null
): UnifiedCompetitor | null {
  if (!redmist && !raceMonitor) return null;
  if (!redmist) return raceMonitor;
  if (!raceMonitor) return redmist;

  // Merge: prefer RedMist for real-time data, Race-Monitor for historical/flag data
  return {
    transponder: redmist.transponder || raceMonitor.transponder,
    carNumber: redmist.carNumber || raceMonitor.carNumber,
    driverName: redmist.driverName || raceMonitor.driverName,
    teamName: redmist.teamName || raceMonitor.teamName,
    className: redmist.className || raceMonitor.className,
    // Real-time position from RedMist (more up-to-date)
    position: redmist.position || raceMonitor.position,
    classPosition: redmist.classPosition,
    laps: Math.max(redmist.laps, raceMonitor.laps),
    lastLapTime: redmist.lastLapTime || raceMonitor.lastLapTime,
    bestLapTime: Math.min(
      redmist.bestLapTime || Infinity,
      raceMonitor.bestLapTime || Infinity
    ) || 0,
    totalTime: raceMonitor.totalTime || redmist.totalTime,
    // RedMist has pit data
    pitCount: redmist.pitCount,
    inPit: redmist.inPit,
    flagStatus: redmist.flagStatus,
    // Race-Monitor has per-lap flag history
    lapHistory: raceMonitor.lapHistory,
    sources: {
      redmist: true,
      racemonitor: true,
    },
  };
}

// =============================================================================
// Lap Analysis Functions (using Race-Monitor flag data)
// =============================================================================

/**
 * Analyze laps by flag status
 */
export function analyzeLapsByFlag(lapHistory: UnifiedLapData[]): {
  greenLaps: UnifiedLapData[];
  yellowLaps: UnifiedLapData[];
  redLaps: UnifiedLapData[];
  averageGreenLapTime: number;
  averageYellowLapTime: number;
  fastestGreenLap: UnifiedLapData | null;
  yellowLapCount: number;
  greenLapPercentage: number;
} {
  const greenLaps = lapHistory.filter(l => l.flagStatus === 'green');
  const yellowLaps = lapHistory.filter(l => l.flagStatus === 'yellow');
  const redLaps = lapHistory.filter(l => l.flagStatus === 'red');

  const avgGreen = greenLaps.length > 0
    ? greenLaps.reduce((sum, l) => sum + l.lapTime, 0) / greenLaps.length
    : 0;

  const avgYellow = yellowLaps.length > 0
    ? yellowLaps.reduce((sum, l) => sum + l.lapTime, 0) / yellowLaps.length
    : 0;

  const fastestGreen = greenLaps.length > 0
    ? greenLaps.reduce((best, l) => l.lapTime < best.lapTime ? l : best)
    : null;

  return {
    greenLaps,
    yellowLaps,
    redLaps,
    averageGreenLapTime: avgGreen,
    averageYellowLapTime: avgYellow,
    fastestGreenLap: fastestGreen,
    yellowLapCount: yellowLaps.length,
    greenLapPercentage: lapHistory.length > 0
      ? (greenLaps.length / lapHistory.length) * 100
      : 0,
  };
}

/**
 * Calculate "true" pace by excluding yellow flag laps
 */
export function calculateTruePace(lapHistory: UnifiedLapData[], excludeOutliers = true): {
  truePace: number; // Average green lap time
  consistency: number; // Standard deviation
  sampleSize: number;
} {
  const greenLaps = lapHistory.filter(l => l.flagStatus === 'green');
  
  if (greenLaps.length === 0) {
    return { truePace: 0, consistency: 0, sampleSize: 0 };
  }

  let times = greenLaps.map(l => l.lapTime);

  // Optionally exclude outliers (laps > 1.5x average)
  if (excludeOutliers && times.length > 3) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    times = times.filter(t => t < avg * 1.5);
  }

  const truePace = times.reduce((a, b) => a + b, 0) / times.length;
  
  // Calculate standard deviation
  const variance = times.reduce((sum, t) => sum + Math.pow(t - truePace, 2), 0) / times.length;
  const consistency = Math.sqrt(variance);

  return {
    truePace,
    consistency,
    sampleSize: times.length,
  };
}

/**
 * Compare true pace between two competitors
 */
export function compareTruePace(
  myLapHistory: UnifiedLapData[],
  theirLapHistory: UnifiedLapData[]
): {
  myTruePace: number;
  theirTruePace: number;
  paceAdvantage: number; // Positive = I'm faster
  estimatedGapChangePerLap: number;
} {
  const myPace = calculateTruePace(myLapHistory);
  const theirPace = calculateTruePace(theirLapHistory);

  const paceAdvantage = theirPace.truePace - myPace.truePace;

  return {
    myTruePace: myPace.truePace,
    theirTruePace: theirPace.truePace,
    paceAdvantage,
    estimatedGapChangePerLap: paceAdvantage,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse time string to milliseconds
 */
function parseTimeToMs(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':');
  let ms = 0;
  
  if (parts.length === 2) {
    const [mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis?.slice(0, 3) || '0');
  } else if (parts.length === 3) {
    const [hours, mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(hours) * 3600000 + parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis?.slice(0, 3) || '0');
  }
  
  return ms;
}

/**
 * Convert flag number to name
 */
function getFlagName(flag: number | undefined): string {
  switch (flag) {
    case 1: return 'green';
    case 2: return 'yellow';
    case 3: return 'red';
    case 4: return 'white';
    case 5: return 'checkered';
    case 6: return 'black';
    case 7: return 'blue';
    default: return 'unknown';
  }
}

/**
 * Format milliseconds to time string
 */
export function formatMsToTime(ms: number, includeHours = false): string {
  if (ms === 0 || isNaN(ms)) return '--:--.---';
  
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  
  if (includeHours || hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

// =============================================================================
// Data Export/Import
// =============================================================================

export interface ExportedRaceData {
  exportDate: string;
  redmistEventId?: number;
  racemonitorRaceId?: number;
  eventName?: string;
  trackName?: string;
  sessionName?: string;
  competitors: UnifiedCompetitor[];
  transponderMappings: TransponderMapping[];
}

/**
 * Export race data for archiving
 */
export function exportRaceData(
  competitors: UnifiedCompetitor[],
  metadata: {
    redmistEventId?: number;
    racemonitorRaceId?: number;
    eventName?: string;
    trackName?: string;
    sessionName?: string;
  }
): ExportedRaceData {
  return {
    exportDate: new Date().toISOString(),
    ...metadata,
    competitors,
    transponderMappings: transponderStore.getAll(),
  };
}

/**
 * Import archived race data
 */
export function importRaceData(data: ExportedRaceData) {
  // Restore transponder mappings
  data.transponderMappings.forEach(mapping => {
    transponderStore.set(mapping.transponder, mapping);
  });
  transponderStore.saveToStorage();
  
  return data.competitors;
}

/**
 * Save race data to a JSON file (browser download)
 */
export function downloadRaceData(data: ExportedRaceData, filename?: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `race-data-${data.eventName || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

