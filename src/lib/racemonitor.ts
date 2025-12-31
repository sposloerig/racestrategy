/**
 * Race-Monitor API Client
 * 
 * Race-Monitor uses POST requests with apiToken in the body.
 * All endpoints are under https://api.race-monitor.com/v2/
 */

import type {
  RMRace,
  RMRaceDetails,
  RMSession,
  RMSessionDetails,
  RMCompetitor,
  RMCompetitorDetails,
  RMLiveSession,
  RMStreamingConnection,
  RMStreamCommand,
  RMCommand_A,
  RMCommand_B,
  RMCommand_C,
  RMCommand_COMP,
  RMCommand_E,
  RMCommand_F,
  RMCommand_G,
  RMCommand_H,
  RMCommand_I,
  RMCommand_J,
  RMCommand_RMS,
  RMCommand_RMLT,
  RMCommand_RMCA,
  RMCommand_RMHL,
} from '../types/racemonitor';

// API Base URL - Race-Monitor doesn't have CORS issues typically
const API_BASE_URL = 'https://api.race-monitor.com/v2';

/**
 * Race-Monitor API Client
 */
export class RaceMonitorApi {
  private apiToken: string | null = null;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || null;
  }

  /**
   * Set the API token
   */
  setApiToken(token: string) {
    this.apiToken = token;
  }

  /**
   * Get the current API token
   */
  getApiToken(): string | null {
    return this.apiToken;
  }

  /**
   * Make a POST request to the Race-Monitor API
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.apiToken) {
      throw new Error('Race-Monitor API token not configured');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apiToken: this.apiToken,
        ...Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Race-Monitor API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.Successful === false) {
      throw new Error(data.ErrorMessage || 'Race-Monitor API request failed');
    }

    return data;
  }

  // ===========================================================================
  // Account Endpoints (Your races)
  // ===========================================================================

  /**
   * Get all races associated with your account
   */
  async getAllRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Account/AllRaces');
    return response.Races || [];
  }

  /**
   * Get currently live races from your account
   */
  async getCurrentRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Account/CurrentRaces');
    return response.Races || [];
  }

  /**
   * Get past races from your account
   */
  async getPastRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Account/PastRaces');
    return response.Races || [];
  }

  /**
   * Get upcoming races from your account
   */
  async getUpcomingRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Account/UpcomingRaces');
    return response.Races || [];
  }

  // ===========================================================================
  // Common Endpoints (Public races)
  // ===========================================================================

  /**
   * Get all currently live races (public)
   */
  async getPublicCurrentRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Common/CurrentRaces');
    return response.Races || [];
  }

  /**
   * Get recent past races (public)
   */
  async getPublicPastRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Common/PastRaces');
    return response.Races || [];
  }

  /**
   * Get upcoming races (public)
   */
  async getPublicUpcomingRaces(): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Common/UpcomingRaces');
    return response.Races || [];
  }

  // ===========================================================================
  // Race Endpoints
  // ===========================================================================

  /**
   * Check if a race is currently live
   */
  async isRaceLive(raceID: number): Promise<boolean> {
    const response = await this.request<{ IsLive: boolean }>('/Race/IsLive', { raceID });
    return response.IsLive;
  }

  /**
   * Get details about a specific race
   */
  async getRaceDetails(raceID: number): Promise<RMRaceDetails> {
    const response = await this.request<{ Race: RMRaceDetails }>('/Race/RaceDetails', { raceID });
    return response.Race;
  }

  // ===========================================================================
  // Live Endpoints
  // ===========================================================================

  /**
   * Get current live session state
   */
  async getLiveSession(raceID: number): Promise<RMLiveSession> {
    const response = await this.request<{ Session: RMLiveSession }>('/Live/GetSession', { raceID });
    return response.Session;
  }

  /**
   * Get live racer details with all lap times
   */
  async getLiveRacer(raceID: number, racerID: string): Promise<RMCompetitorDetails> {
    const response = await this.request<{ Details: RMCompetitorDetails }>('/Live/GetRacer', { 
      raceID, 
      racerID 
    });
    return response.Details;
  }

  /**
   * Get the number of racers in a live session
   */
  async getLiveRacerCount(raceID: number): Promise<number> {
    const response = await this.request<{ Count: number }>('/Live/GetRacerCount', { raceID });
    return response.Count;
  }

  /**
   * Get streaming connection info for live WebSocket connection
   */
  async getStreamingConnection(raceID: number): Promise<RMStreamingConnection> {
    const response = await this.request<RMStreamingConnection>('/Live/GetStreamingConnection', { raceID });
    return response;
  }

  // ===========================================================================
  // Results Endpoints
  // ===========================================================================

  /**
   * Get all sessions for a race
   */
  async getSessionsForRace(raceID: number): Promise<RMSession[]> {
    const response = await this.request<{ Sessions: RMSession[] }>('/Results/SessionsForRace', { raceID });
    return response.Sessions || [];
  }

  /**
   * Get session details with results
   * @param includeLapTimes - Include lap times (can make response very large!)
   */
  async getSessionDetails(sessionID: number, includeLapTimes = false): Promise<RMSessionDetails> {
    const response = await this.request<{ Session: RMSessionDetails }>('/Results/SessionDetails', {
      sessionID,
      includeLapTimes,
    });
    return response.Session;
  }

  /**
   * Get competitor details with lap times
   * Better for getting individual car lap history than loading all at once
   */
  async getCompetitorDetails(sessionID: number, competitorID: number): Promise<RMCompetitorDetails> {
    const response = await this.request<{ Competitor: RMCompetitorDetails }>('/Results/CompetitorDetails', {
      sessionID,
      competitorID,
    });
    return response.Competitor;
  }

  /**
   * Search for results by racer name, number, or transponder
   */
  async searchResults(searchTerm: string): Promise<RMCompetitor[]> {
    const response = await this.request<{ Results: RMCompetitor[] }>('/Results/SearchResults', {
      searchTerm,
    });
    return response.Results || [];
  }

  /**
   * Get all races where a specific transponder has been used
   */
  async getRacesWithTransponder(transponder: string): Promise<RMRace[]> {
    const response = await this.request<{ Races: RMRace[] }>('/Results/RacesWithTransponder', {
      transponder,
    });
    return response.Races || [];
  }

  /**
   * Get all competitors in races that used a specific transponder
   */
  async getCompetitorsWithTransponder(transponder: string): Promise<RMCompetitor[]> {
    const response = await this.request<{ Competitors: RMCompetitor[] }>('/Results/CompetitorsWithTransponder', {
      transponder,
    });
    return response.Competitors || [];
  }
}

// ===========================================================================
// Live Streaming WebSocket Client
// ===========================================================================

export type RMStreamCallback = (command: RMStreamCommand) => void;

/**
 * Race-Monitor Live Streaming Client
 * Connects via WebSocket and receives real-time timing data
 */
export class RaceMonitorStream {
  private ws: WebSocket | null = null;
  private callbacks: Set<RMStreamCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionInfo: RMStreamingConnection | null = null;

  /**
   * Connect to live streaming for a race
   */
  async connect(connectionInfo: RMStreamingConnection): Promise<void> {
    this.connectionInfo = connectionInfo;
    
    return new Promise((resolve, reject) => {
      try {
        // Use secure WebSocket URL
        const url = connectionInfo.WebsocketURL || connectionInfo.WSS;
        console.log('[RaceMonitor] Connecting to WebSocket:', url);
        
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('[RaceMonitor] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('[RaceMonitor] WebSocket error:', error);
          reject(error);
        };
        
        this.ws.onclose = (event) => {
          console.log('[RaceMonitor] WebSocket closed:', event.code, event.reason);
          this.handleDisconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to stream updates
   */
  subscribe(callback: RMStreamCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Disconnect from the stream
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionInfo = null;
    this.callbacks.clear();
  }

  /**
   * Request historical laps for a racer
   */
  requestRacerHistory(racerID: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(`$GET,${racerID}`);
    }
  }

  private handleDisconnect() {
    if (this.connectionInfo && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[RaceMonitor] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.connectionInfo!).catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(data: string) {
    // Each command is on its own line
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const command = this.parseCommand(line);
      if (command) {
        this.callbacks.forEach(cb => cb(command));
      }
    }
  }

  /**
   * Parse a Race-Monitor protocol command
   */
  private parseCommand(line: string): RMStreamCommand | null {
    const parts = this.parseLine(line);
    if (parts.length === 0) return null;

    const cmdType = parts[0];

    try {
      switch (cmdType) {
        case '$A':
          return {
            type: '$A',
            racerID: parts[1] || '',
            number: parts[2] || '',
            transponder: parts[3] || '',
            firstName: parts[4] || '',
            lastName: parts[5] || '',
            nationality: parts[6] || '',
            classID: parseInt(parts[7]) || 0,
          } as RMCommand_A;

        case '$B':
          return {
            type: '$B',
            runID: parseInt(parts[1]) || 0,
            sessionName: parts[2] || '',
          } as RMCommand_B;

        case '$C':
          return {
            type: '$C',
            classID: parseInt(parts[1]) || 0,
            description: parts[2] || '',
          } as RMCommand_C;

        case '$COMP':
          return {
            type: '$COMP',
            racerID: parts[1] || '',
            number: parts[2] || '',
            classID: parseInt(parts[3]) || 0,
            firstName: parts[4] || '',
            lastName: parts[5] || '',
            nationality: parts[6] || '',
            additionalData: parts[7] || '',
          } as RMCommand_COMP;

        case '$E':
          return {
            type: '$E',
            settingType: parts[1] as 'TRACKNAME' | 'TRACKLENGTH',
            value: parts[2] || '',
          } as RMCommand_E;

        case '$F':
          return {
            type: '$F',
            lapsToGo: parseInt(parts[1]) || 0,
            timeToGo: parts[2] || '',
            timeOfDay: parts[3] || '',
            raceTime: parts[4] || '',
            flagStatus: (parts[5]?.trim() || '') as RMCommand_F['flagStatus'],
          } as RMCommand_F;

        case '$G':
          return {
            type: '$G',
            racePosition: parseInt(parts[1]) || 0,
            racerID: parts[2] || '',
            laps: parseInt(parts[3]) || 0,
            totalTime: parts[4] || '',
          } as RMCommand_G;

        case '$H':
          return {
            type: '$H',
            qualifyingPosition: parseInt(parts[1]) || 0,
            racerID: parts[2] || '',
            bestLap: parseInt(parts[3]) || 0,
            bestLapTime: parts[4] || '',
          } as RMCommand_H;

        case '$I':
          return {
            type: '$I',
            timeOfDay: parts[1] || undefined,
            date: parts[2] || undefined,
          } as RMCommand_I;

        case '$J':
          return {
            type: '$J',
            racerID: parts[1] || '',
            lapTime: parts[2] || '',
            totalTime: parts[3] || '',
          } as RMCommand_J;

        case '$RMS':
          return {
            type: '$RMS',
            sortMode: (parts[1] || 'race') as 'race' | 'qualifying',
          } as RMCommand_RMS;

        case '$RMLT':
          return {
            type: '$RMLT',
            racerID: parts[1] || '',
            timeOfLastPassing: parseInt(parts[2]) || 0,
          } as RMCommand_RMLT;

        case '$RMCA':
          return {
            type: '$RMCA',
            relayServerTime: parseInt(parts[1]) || 0,
          } as RMCommand_RMCA;

        case '$RMHL':
          return {
            type: '$RMHL',
            racerID: parts[1] || '',
            lapNumber: parseInt(parts[2]) || 0,
            racePosition: parseInt(parts[3]) || 0,
            lapTime: parts[4] || '',
            flagStatus: (parts[5]?.trim() || '') as RMCommand_RMHL['flagStatus'],
            totalTime: parts[6] || '',
          } as RMCommand_RMHL;

        default:
          console.log('[RaceMonitor] Unknown command:', cmdType);
          return null;
      }
    } catch (error) {
      console.error('[RaceMonitor] Error parsing command:', line, error);
      return null;
    }
  }

  /**
   * Parse a comma-separated line, handling quoted strings
   */
  private parseLine(line: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    parts.push(current.trim());
    return parts;
  }
}

// ===========================================================================
// Utility Functions
// ===========================================================================

/**
 * Parse Race-Monitor time string to milliseconds
 * Format: HH:MM:SS.DDD or MM:SS.DDD
 */
export function parseRMTime(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':');
  let ms = 0;
  
  if (parts.length === 2) {
    // MM:SS.DDD
    const [mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis || '0');
  } else if (parts.length === 3) {
    // HH:MM:SS.DDD
    const [hours, mins, secPart] = parts;
    const [secs, millis] = secPart.split('.');
    ms = parseInt(hours) * 3600000 + parseInt(mins) * 60000 + parseInt(secs) * 1000 + parseInt(millis || '0');
  }
  
  return ms;
}

/**
 * Format milliseconds to Race-Monitor time format
 */
export function formatRMTime(ms: number, includeHours = false): string {
  if (ms === 0) return '--:--.---';
  
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

/**
 * Convert Race-Monitor flag status to normalized format
 */
export function normalizeRMFlagStatus(status: string | number): 'green' | 'yellow' | 'red' | 'checkered' | 'unknown' {
  const statusStr = String(status).toLowerCase().trim();
  
  switch (statusStr) {
    case 'green':
    case '1':
      return 'green';
    case 'yellow':
    case '2':
      return 'yellow';
    case 'red':
    case '3':
      return 'red';
    case 'finish':
    case 'checkered':
    case '4':
      return 'checkered';
    default:
      return 'unknown';
  }
}

/**
 * Extract team name from AdditionalData field
 * Race-Monitor often stores team info in this field
 */
export function extractTeamFromAdditionalData(additionalData: string | undefined): string | null {
  if (!additionalData) return null;
  
  // Common patterns: "Team: TeamName" or just the team name
  const teamMatch = additionalData.match(/team[:\s]+(.+)/i);
  if (teamMatch) {
    return teamMatch[1].trim();
  }
  
  // If no pattern, return the whole thing if it looks like a team name
  if (additionalData.length > 0 && additionalData.length < 50) {
    return additionalData.trim();
  }
  
  return null;
}

// Create singleton instance
export const raceMonitorApi = new RaceMonitorApi();

