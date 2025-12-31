/**
 * Race-Monitor API Types
 * Based on https://www.race-monitor.com/APIDocs/
 * 
 * Race-Monitor uses MyLaps transponder-based timing and provides
 * per-lap flag status which is valuable for strategy analysis.
 */

// =============================================================================
// Common Types
// =============================================================================

export interface RaceMonitorResponse<T> {
  Successful: boolean;
  ErrorMessage?: string;
  ErrorCode?: number;
  Data?: T;
}

// =============================================================================
// Race & Event Types
// =============================================================================

export interface RMRace {
  ID: number;
  Name: string;
  TrackName: string;
  TrackCity: string;
  TrackState: string;
  TrackCountry: string;
  StartDate: string;
  EndDate: string;
  SeriesID?: number;
  SeriesName?: string;
  IsLive: boolean;
  LiveTimingAvailable: boolean;
}

export interface RMRaceDetails extends RMRace {
  TrackLength?: string;
  TrackConfig?: string;
  Website?: string;
  Description?: string;
}

// =============================================================================
// Session Types
// =============================================================================

export interface RMSession {
  ID: number;
  RaceID: number;
  Name: string;
  SessionDate: string;
  SessionTime: string;
  SortMode: 'race' | 'qualifying';
  ResultsProcessorVersion?: number;
  SessionStartDateEpoc?: number;
}

export interface RMSessionDetails extends RMSession {
  SortedCompetitors: RMCompetitor[];
  Categories: Record<string, RMCategory>;
  CategoryString?: string;
}

// =============================================================================
// Competitor Types
// =============================================================================

export interface RMCompetitor {
  ID: number;
  SessionID: number;
  RaceID: number;
  FirstName: string;
  LastName: string;
  Position: string;
  Laps: string;
  LastLapTime: string;
  BestPosition: string;
  BestLap: string;
  BestLapTime: string;
  TotalTime: string;
  Number: string;
  Transponder: string;
  Nationality?: string;
  AdditionalData?: string; // Often contains team name
  Category?: string;
  ClassID?: string;
  LapTimes?: RMLapTime[];
}

export interface RMCompetitorDetails {
  Competitor: RMCompetitor;
  Laps: RMLapTime[];
}

// =============================================================================
// Lap Time Types (includes FLAG STATUS!)
// =============================================================================

export interface RMLapTime {
  Lap: string;
  LapTime: string;
  Position: string;
  FlagStatus: RMFlagStatus; // KEY FEATURE: Flag status per lap!
  TotalTime?: string;
}

/**
 * Flag status values from Race-Monitor
 * This is crucial for strategy - knowing which laps were under yellow
 */
export type RMFlagStatus = 'Green' | 'Yellow' | 'Red' | 'Finish' | '' | number;

export const RMFlagStatusMap = {
  Green: 1,
  Yellow: 2,
  Red: 3,
  Finish: 4,
  '': 0,
} as const;

// =============================================================================
// Category/Class Types
// =============================================================================

export interface RMCategory {
  ID: string;
  Name: string;
}

// =============================================================================
// Live Session Types
// =============================================================================

export interface RMLiveSession {
  RunNumber: string;
  SessionName: string;
  TrackName: string;
  TrackLength: string;
  CurrentTime: string;
  SessionTime: string;
  TimeToGo: string;
  LapsToGo: string;
  FlagStatus: string;
  SortMode: 'race' | 'qualifying';
  Classes: Record<string, RMCategory>;
  Competitors: Record<string, RMLiveCompetitor>;
}

export interface RMLiveCompetitor {
  RacerID: string;
  Number: string;
  Transponder: string;
  FirstName: string;
  LastName: string;
  Nationality?: string;
  AdditionalData?: string;
  ClassID: string;
  Position: string;
  Laps: string;
  TotalTime: string;
  BestPosition: string;
  BestLap: string;
  BestLapTime: string;
  LastLapTime: string;
}

// =============================================================================
// Live Streaming Connection Types
// =============================================================================

export interface RMStreamingConnection {
  WebsocketURL: string;
  WS: string; // ws:// URL
  WSS: string; // wss:// URL
  Instance: string;
  LiveTimingToken: string;
  useHostNameForSocket?: boolean;
}

// =============================================================================
// Live Streaming Protocol Commands
// These are received via WebSocket connection
// =============================================================================

export type RMStreamCommand = 
  | RMCommand_A   // Competitor Information
  | RMCommand_B   // Run (Session) Information
  | RMCommand_C   // Class Information
  | RMCommand_COMP // Competitor Information (extended)
  | RMCommand_E   // Setting Information
  | RMCommand_F   // Heartbeat (FLAG STATUS!)
  | RMCommand_G   // Race Information
  | RMCommand_H   // Qualifying Information
  | RMCommand_I   // Reset Command
  | RMCommand_J   // Passing Information
  | RMCommand_RMS // Sort Mode
  | RMCommand_RMLT // Lap Ticks
  | RMCommand_RMCA // Clock Adjust
  | RMCommand_RMHL; // Historical Lap (with FLAG STATUS!)

export interface RMCommand_A {
  type: '$A';
  racerID: string;
  number: string;
  transponder: string;
  firstName: string;
  lastName: string;
  nationality: string;
  classID: number;
}

export interface RMCommand_B {
  type: '$B';
  runID: number;
  sessionName: string;
}

export interface RMCommand_C {
  type: '$C';
  classID: number;
  description: string;
}

export interface RMCommand_COMP {
  type: '$COMP';
  racerID: string;
  number: string;
  classID: number;
  firstName: string;
  lastName: string;
  nationality: string;
  additionalData: string;
}

export interface RMCommand_E {
  type: '$E';
  settingType: 'TRACKNAME' | 'TRACKLENGTH';
  value: string;
}

/**
 * Heartbeat - sent every second
 * Includes current flag status!
 */
export interface RMCommand_F {
  type: '$F';
  lapsToGo: number;
  timeToGo: string; // HH:MM:SS
  timeOfDay: string; // HH:MM:SS
  raceTime: string; // HH:MM:SS
  flagStatus: 'Green' | 'Yellow' | 'Red' | 'Finish' | '';
}

export interface RMCommand_G {
  type: '$G';
  racePosition: number;
  racerID: string;
  laps: number;
  totalTime: string; // HH:MM:SS.DDD
}

export interface RMCommand_H {
  type: '$H';
  qualifyingPosition: number;
  racerID: string;
  bestLap: number;
  bestLapTime: string; // HH:MM:SS.DDD
}

export interface RMCommand_I {
  type: '$I';
  timeOfDay?: string;
  date?: string;
}

/**
 * Passing Information - sent when a racer crosses timing loop
 */
export interface RMCommand_J {
  type: '$J';
  racerID: string;
  lapTime: string; // HH:MM:SS.DDD
  totalTime: string; // HH:MM:SS.DDD
}

export interface RMCommand_RMS {
  type: '$RMS';
  sortMode: 'race' | 'qualifying';
}

/**
 * Lap Ticks - epoch time of last passing
 * Useful for calculating exact gaps
 */
export interface RMCommand_RMLT {
  type: '$RMLT';
  racerID: string;
  timeOfLastPassing: number; // Epoch milliseconds
}

export interface RMCommand_RMCA {
  type: '$RMCA';
  relayServerTime: number; // Epoch milliseconds
}

/**
 * Historical Lap - includes FLAG STATUS when lap was completed!
 * This is the key data for strategy analysis
 */
export interface RMCommand_RMHL {
  type: '$RMHL';
  racerID: string;
  lapNumber: number;
  racePosition: number;
  lapTime: string; // HH:MM:SS.DDD
  flagStatus: 'Green' | 'Yellow' | 'Red' | 'Finish' | '';
  totalTime: string; // HH:MM:SS.DDD
}

// =============================================================================
// API Request Types
// =============================================================================

export interface RMApiRequest {
  apiToken: string;
}

export interface RMSessionRequest extends RMApiRequest {
  sessionID: number;
  includeLapTimes?: boolean;
}

export interface RMRaceRequest extends RMApiRequest {
  raceID: number;
}

export interface RMRacerRequest extends RMApiRequest {
  raceID: number;
  racerID: string;
}

export interface RMSearchRequest extends RMApiRequest {
  searchTerm: string;
  page?: number;
  pageSize?: number;
}

// =============================================================================
// Unified Data Types (for merging with RedMist)
// =============================================================================

/**
 * Unified lap data that combines both APIs
 * Transponder is the key for matching
 */
export interface UnifiedLapData {
  transponder: string;
  carNumber: string;
  lapNumber: number;
  lapTime: number; // milliseconds
  position: number;
  flagStatus: 'green' | 'yellow' | 'red' | 'checkered' | 'unknown';
  totalTime: number; // milliseconds
  source: 'redmist' | 'racemonitor' | 'merged';
}

/**
 * Unified competitor data
 */
export interface UnifiedCompetitor {
  transponder: string;
  carNumber: string;
  driverName: string;
  teamName?: string;
  className?: string;
  position: number;
  classPosition?: number;
  laps: number;
  lastLapTime: number;
  bestLapTime: number;
  totalTime: number;
  pitCount?: number;
  inPit?: boolean;
  flagStatus?: string;
  
  // Lap history with flag status (from Race-Monitor if available)
  lapHistory?: UnifiedLapData[];
  
  // Data source tracking
  sources: {
    redmist?: boolean;
    racemonitor?: boolean;
  };
}

/**
 * Transponder mapping for correlating data between APIs
 */
export interface TransponderMapping {
  transponder: string;
  carNumber: string;
  redmistEventId?: number;
  racemonitorRaceId?: number;
  driverName?: string;
  teamName?: string;
  className?: string;
}

