// RedMist API Type Definitions
// Based on Swagger API v2: https://api.redmist.racing/status/swagger

// ============================================================================
// Constants (Flag and Video Types)
// ============================================================================

export const Flags = {
  None: 0,
  Green: 1,
  Yellow: 2,
  Red: 3,
  White: 4,
  Checkered: 5,
  Black: 6,
  Blue: 7,
} as const;

export type Flags = typeof Flags[keyof typeof Flags];

export const VideoSystemType = {
  None: 0,
  YouTube: 1,
  Twitch: 2,
  Custom: 3,
  RTMP: 4,
} as const;

export type VideoSystemType = typeof VideoSystemType[keyof typeof VideoSystemType];

export const VideoDestinationType = {
  None: 0,
  YouTube: 1,
  Twitch: 2,
  Custom: 3,
  RTMP: 4,
} as const;

export type VideoDestinationType = typeof VideoDestinationType[keyof typeof VideoDestinationType];

// ============================================================================
// Core Data Models
// ============================================================================

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  scope: string;
}

export interface EventListSummary {
  eid: number; // Event ID
  oid: number; // Organization ID
  on: string | null; // Organization Name
  en: string | null; // Event Name
  ed: string | null; // Event Date
  l: boolean; // Is Live
  t: string | null; // Track Name
  s: EventSchedule | null; // Schedule
}

export interface Event {
  e: number; // Event ID
  n: string | null; // Name
  d: string | null; // Date
  u: string | null; // URL
  s: Session[] | null; // Sessions
  on: string | null; // Organization Name
  ow: string | null; // Organization Website
  l: string | null; // Logo (base64)
  sc: EventSchedule | null; // Schedule
  t: string | null; // Track
  cc: string | null; // Country Code
  di: string | null; // Distance
  b: BroadcasterConfig | null; // Broadcaster
  hc: boolean; // Has Control Log
  il: boolean; // Is Live
}

export interface EventSchedule {
  n: string | null; // Name
  s: EventScheduleEntry[] | null; // Schedule Entries
}

export interface EventScheduleEntry {
  d: string; // Date
  s: string; // Start Time
  e: string; // End Time
  n: string | null; // Name
}

export interface Session {
  sid: number; // Session ID
  eid: number; // Event ID
  n: string | null; // Name
  st: string; // Start Time
  et: string | null; // End Time
  tz: number; // Time Zone Offset
  lu: string | null; // Last Updated
  il: boolean; // Is Live
  pq: boolean; // Is Practice/Qualifying
}

export interface SessionState {
  eventId: number;
  eventName: string | null;
  sessionId: number;
  sessionName: string | null;
  lapsToGo: number;
  timeToGo: string | null;
  localTimeOfDay: string | null;
  runningRaceTime: string | null;
  isPracticeQualifying: boolean;
  sessionStartTime: string;
  sessionEndTime: string | null;
  localTimeZoneOffset: number;
  isLive: boolean;
  eventEntries: EventEntry[] | null;
  carPositions: CarPosition[] | null;
  currentFlag: Flags;
  flagDurations: FlagDuration[] | null;
  greenTimeMs: number | null;
  greenLaps: number | null;
  yellowTimeMs: number | null;
  yellowLaps: number | null;
  numberOfYellows: number | null;
  redTimeMs: number | null;
  averageRaceSpeed: string | null;
  leadChanges: number | null;
  sections: Section[] | null;
  classColors: Record<string, string> | null;
  announcements: Announcement[] | null;
  lastUpdated: string | null;
  classOrder: Record<string, string> | null;
}

export interface EventEntry {
  no: string | null; // Number
  nm: string | null; // Name
  t: string | null; // Team
  c: string | null; // Class
}

export interface CarPosition {
  eid?: string | null; // Event ID
  sid?: string | null; // Session ID
  n: string | null; // Car Number
  tp?: number; // Transponder
  class?: string | null; // Class (full name)
  c?: string | null; // Class (abbreviated)
  bt?: string | null; // Best Time
  bl?: number; // Best Lap
  ibt?: boolean; // Is Best Time
  btc?: boolean; // Best Time in Class
  cg?: string | null; // Class Gap
  cd?: string | null; // Class Delta
  og?: string | null; // Overall Gap
  od?: string | null; // Overall Delta
  gl?: string | null; // Gap to Leader
  gi?: string | null; // Gap Interval
  ttm?: string | null; // Time to Make
  ltm?: string | null; // Last Time
  llp?: number; // Last Lap Position
  psc?: number | null; // Position Change
  lastLapPitted?: number | null;
  llo?: number | null; // Last Lap Overall Position
  llic?: number | null; // Last Lap In Class Position
  ovp?: number; // Overall Position (full)
  clp?: number; // Class Position (full)
  p?: number; // Position (abbreviated)
  cp?: number; // Class Position (abbreviated)
  l?: number; // Laps (abbreviated)
  pc?: number; // Pit Count (abbreviated)
  osp?: number; // Overall Start Position
  opg?: number; // Overall Position Gained
  icsp?: number; // In Class Start Position
  cpg?: number; // Class Position Gained
  ompg?: boolean; // Overall Most Positions Gained
  cmpg?: boolean; // Class Most Positions Gained
  pl?: number; // Pit Lap
  pw?: number; // Pit Window
  bf?: number; // Black Flag
  enp?: boolean; // Enter Pit
  psf?: boolean; // Pit Speed Flag
  exp?: boolean; // Exit Pit
  ip?: boolean; // In Pit
  lip?: boolean; // Last In Pit
  ln?: string | null; // Lap Number
  st?: boolean; // Starter
  flg?: Flags; // Flag
  lflg?: Flags; // Last Flag
  lhlf?: boolean | null; // Last Half Lap
  csec?: CompletedSection[] | null; // Completed Sections
  plt?: number; // Pit Lane Time
  lstt?: string; // Last Sector Time
  dn?: string | null; // Driver Name
  did?: string | null; // Driver ID
  vid?: VideoStatus | null; // Video Status
  lat?: number | null; // Latitude
  lon?: number | null; // Longitude
  mcs?: string | null; // Min Class Speed
  iw?: boolean; // Is Winner
  lastLapMs?: number | null; // Last lap time in ms
  bestLapMs?: number | null; // Best lap time in ms
}

export interface CompletedSection {
  number: string | null;
  sectionId: string | null;
  elapsedTimeMs: number;
  lastSectionTimeMs: number;
  lastLap: number;
}

export interface Section {
  name: string | null;
  lengthInches: number;
  startLabel: string | null;
  endLabel: string | null;
}

export interface FlagDuration {
  f: Flags; // Flag
  s: string; // Start Time
  e: string | null; // End Time
}

export interface ControlLogEntry {
  o: number; // Order
  t: string; // Time
  cor: string | null; // Corner
  c1: string | null; // Car 1
  c1h: boolean; // Car 1 Highlighted
  c2: string | null; // Car 2
  c2h: boolean; // Car 2 Highlighted
  n: string | null; // Note
  s: string | null; // Status
  a: string | null; // Action
  on: string | null; // Official Name
}

export interface CarControlLogs {
  cn: string | null; // Car Number
  entries: ControlLogEntry[] | null;
}

export interface CompetitorMetadata {
  e: number; // Event ID
  n: string; // Number
  lu: string; // Last Updated
  t: number; // Transponder
  t2: number; // Transponder 2
  cl: string | null; // Class
  fn: string | null; // First Name
  ln: string | null; // Last Name
  ns: string | null; // Name Suffix
  s: string | null; // Sponsor
  mk: string | null; // Make
  h: string | null; // Hometown
  c: string | null; // Country
  mo: string | null; // Model
  tr: string | null; // Tire
  a: string | null; // Additional Info
}

export interface InCarPayload {
  n: string | null; // Number
  p: string | null; // Position
  o: string | null; // Overall
  f: Flags; // Flag
  c: CarStatus[] | null; // Cars Around
}

export interface CarStatus {
  n: string | null; // Number
  c: string | null; // Class
  t: string | null; // Team
  l: string | null; // Lap
  gl: string | null; // Gap to Leader
  g: string | null; // Gap
  ct: string | null; // Current Time
  d: string | null; // Delta
  id: number; // ID
  i: string | null; // Image URL
}

export interface Announcement {
  timestamp: string;
  priority: string | null;
  text: string | null;
}

export interface BroadcasterConfig {
  c: string | null; // Channel
  u: string | null; // URL
}

export interface VideoStatus {
  videoSystemType: VideoSystemType;
  videoDestination: VideoDestination | null;
}

export interface VideoDestination {
  t: VideoDestinationType;
  u: string | null; // URL
  h: string | null; // Host
  p: number; // Port
  pa: string | null; // Path
}

export interface DriverInfo {
  eventId: number;
  carNumber: string | null;
  transponderId: number;
  driverName: string | null;
  driverId: string | null;
}

export interface VideoMetadata {
  eid: number; // Event ID
  cn: string | null; // Car Number
  tp: number; // Transponder
  utp: boolean; // Use Transponder
  t: VideoSystemType;
  d: VideoDestination[] | null; // Destinations
  l: boolean; // Live
  dn: string | null; // Driver Name (deprecated)
}

export interface UIVersionInfo {
  latestIOSVersion: string | null;
  minimumIOSVersion: string | null;
  recommendIOSUpdate: boolean;
  isIOSMinimumMandatory: boolean;
  latestAndroidVersion: string | null;
  minimumAndroidVersion: string | null;
  recommendAndroidUpdate: boolean;
  isAndroidMinimumMandatory: boolean;
  latestWebVersion: string | null;
  minimumWebVersion: string | null;
  recommendWebUpdate: boolean;
  isWebMinimumMandatory: boolean;
}

export interface ProblemDetails {
  type: string | null;
  title: string | null;
  status: number | null;
  detail: string | null;
  instance: string | null;
}

// ============================================================================
// SignalR Message Types
// ============================================================================

export interface SignalRMessage {
  t?: 'patch' | 'full';
  patches?: JsonPatch[];
  // Full session state properties if t !== 'patch'
  [key: string]: unknown;
}

export interface JsonPatch {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

// ============================================================================
// Application State Types
// ============================================================================

export interface AuthState {
  accessToken: string | null;
  tokenExpiry: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface DashboardState {
  currentEvent: Event | null;
  sessionState: SessionState | null;
  controlLog: ControlLogEntry[];
  selectedCar: string | null;
  isConnected: boolean;
  lastUpdate: Date | null;
}

// Helper function to get flag color
export function getFlagColor(flag: Flags): string {
  switch (flag) {
    case Flags.Green:
      return '#00ff00';
    case Flags.Yellow:
      return '#ffff00';
    case Flags.Red:
      return '#ff0000';
    case Flags.White:
      return '#ffffff';
    case Flags.Checkered:
      return '#000000';
    case Flags.Black:
      return '#000000';
    case Flags.Blue:
      return '#0000ff';
    default:
      return '#808080';
  }
}

// Helper function to get flag name
export function getFlagName(flag: Flags): string {
  switch (flag) {
    case Flags.Green:
      return 'Green';
    case Flags.Yellow:
      return 'Yellow (Caution)';
    case Flags.Red:
      return 'Red (Stopped)';
    case Flags.White:
      return 'White (Final Lap)';
    case Flags.Checkered:
      return 'Checkered (Finished)';
    case Flags.Black:
      return 'Black';
    case Flags.Blue:
      return 'Blue';
    default:
      return 'None';
  }
}

// Format milliseconds to time string
export function formatTime(ms: number | null | undefined): string {
  if (ms == null) return '--:--:--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  const remainingMs = ms % 1000;

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(3, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(3, '0')}`;
}

