// RedMist API Client
// Based on Status API v2: https://api.redmist.racing/status/swagger

import * as msgpack from '@msgpack/msgpack';
import { tokenManager } from './auth';
import type {
  EventListSummary,
  Event,
  Session,
  SessionState,
  CarPosition,
  ControlLogEntry,
  CarControlLogs,
  CompetitorMetadata,
  InCarPayload,
  FlagDuration,
  UIVersionInfo,
} from '../types/redmist';

// Use proxy in development to bypass CORS
// Note: Status API endpoints are under /status/
const API_BASE_URL = import.meta.env.DEV 
  ? '/api/status'
  : 'https://api.redmist.racing/status';

type RequestOptions = {
  requiresAuth?: boolean;
  useMsgpack?: boolean;
};

class RedMistApiClient {
  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { requiresAuth = true, useMsgpack = false } = options;

    const headers: Record<string, string> = {};

    if (requiresAuth) {
      const token = await tokenManager.getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (useMsgpack) {
      headers['Accept'] = 'application/x-msgpack';
    } else {
      headers['Accept'] = 'application/json';
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`[API] Fetching: ${url}`);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    if (useMsgpack) {
      const buffer = await response.arrayBuffer();
      return msgpack.decode(new Uint8Array(buffer)) as T;
    }

    // Handle empty responses (some endpoints return 200 with no body)
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as T;
    }
    
    return JSON.parse(text);
  }

  // ============================================================================
  // Events Endpoints
  // ============================================================================

  /**
   * Get all currently live events
   * This endpoint is publicly accessible (no authentication required)
   */
  async getLiveEvents(): Promise<EventListSummary[]> {
    return this.request<EventListSummary[]>('/v2/Events/LoadLiveEvents', {
      requiresAuth: false,
    });
  }

  /**
   * Get all live events and the most recent 100 non-live events
   * This endpoint is publicly accessible
   */
  async getLiveAndRecentEvents(): Promise<EventListSummary[]> {
    return this.request<EventListSummary[]>('/v2/Events/LoadLiveAndRecentEvents', {
      requiresAuth: false,
    });
  }

  /**
   * Get all events starting from a specified date
   */
  async getEvents(startDateUtc?: Date): Promise<Event[]> {
    let endpoint = '/v2/Events/LoadEvents';
    if (startDateUtc) {
      endpoint += `?startDateUtc=${startDateUtc.toISOString()}`;
    }
    return this.request<Event[]>(endpoint);
  }

  /**
   * Get detailed information for a specific event
   */
  async getEvent(eventId: number): Promise<Event> {
    return this.request<Event>(`/v2/Events/LoadEvent?eventId=${eventId}`);
  }

  /**
   * Get all sessions for a specific event
   */
  async getSessions(eventId: number): Promise<Session[]> {
    return this.request<Session[]>(`/v2/Events/LoadSessions?eventId=${eventId}`);
  }

  /**
   * Get session results for a specific event and session
   * V2 returns SessionState object format
   */
  async getSessionResults(eventId: number, sessionId: number): Promise<SessionState> {
    return this.request<SessionState>(
      `/v2/Events/LoadSessionResults?eventId=${eventId}&sessionId=${sessionId}`
    );
  }

  /**
   * Get the current real-time session state from the event processor service
   * Returns MessagePack-serialized SessionState data for maximum performance
   */
  async getCurrentSessionState(eventId: number): Promise<SessionState> {
    return this.request<SessionState>(
      `/v2/Events/GetCurrentSessionState?eventId=${eventId}`,
      { useMsgpack: true }
    );
  }

  /**
   * Get completed lap data for a specific car in a session
   */
  async getCarLaps(
    eventId: number,
    sessionId: number,
    carNumber: string
  ): Promise<CarPosition[]> {
    return this.request<CarPosition[]>(
      `/v2/Events/LoadCarLaps?eventId=${eventId}&sessionId=${sessionId}&carNumber=${encodeURIComponent(carNumber)}`
    );
  }

  /**
   * Get competitor metadata (driver/car information) for a specific car
   */
  async getCompetitorMetadata(
    eventId: number,
    carNumber: string
  ): Promise<CompetitorMetadata> {
    return this.request<CompetitorMetadata>(
      `/v2/Events/LoadCompetitorMetadata?eventId=${eventId}&car=${encodeURIComponent(carNumber)}`
    );
  }

  /**
   * Get the complete control log for an event
   * Control logs contain race control decisions, penalties, and incident reports
   */
  async getControlLog(eventId: number): Promise<ControlLogEntry[]> {
    return this.request<ControlLogEntry[]>(
      `/v2/Events/LoadControlLog?eventId=${eventId}`
    );
  }

  /**
   * Get control log entries specific to a particular car
   */
  async getCarControlLogs(eventId: number, carNumber: string): Promise<CarControlLogs> {
    return this.request<CarControlLogs>(
      `/v2/Events/LoadCarControlLogs?eventId=${eventId}&car=${encodeURIComponent(carNumber)}`
    );
  }

  /**
   * Get the in-car driver mode payload for a specific car
   * Provides data optimized for in-car display to drivers during an event
   */
  async getInCarPayload(eventId: number, carNumber: string): Promise<InCarPayload> {
    return this.request<InCarPayload>(
      `/v2/Events/LoadInCarPayload?eventId=${eventId}&car=${encodeURIComponent(carNumber)}`
    );
  }

  /**
   * Get flag history for a specific session
   */
  async getFlags(eventId: number, sessionId: number): Promise<FlagDuration[]> {
    return this.request<FlagDuration[]>(
      `/v2/Events/LoadFlags?eventId=${eventId}&sessionId=${sessionId}`
    );
  }

  /**
   * Get the current UI version information
   */
  async getUIVersionInfo(): Promise<UIVersionInfo> {
    return this.request<UIVersionInfo>('/v2/Events/GetUIVersionInfo');
  }
}

// Export singleton instance
export const api = new RedMistApiClient();

