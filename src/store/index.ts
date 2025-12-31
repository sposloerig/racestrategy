// Zustand Store for RedMist Dashboard
// Global state management for events, sessions, and real-time data
// Supports both RedMist and Race-Monitor APIs

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tokenManager, startAutoRefresh, stopAutoRefresh } from '../lib/auth';
import { api } from '../lib/api';
import { raceMonitorApi, RaceMonitorStream } from '../lib/racemonitor';
import type {
  EventListSummary,
  Event,
  Session,
  SessionState,
  ControlLogEntry,
  CarPosition,
  InCarPayload,
  CompetitorMetadata,
} from '../types/redmist';
import type {
  RMRace,
  RMLiveSession,
  RMSessionDetails,
  UnifiedCompetitor,
  UnifiedLapData,
} from '../types/racemonitor';
import {
  redmistToUnified,
  raceMonitorToUnified,
  mergeCompetitorData,
  analyzeLapsByFlag,
  transponderStore,
} from '../lib/unified-data';

// ============================================================================
// Auth Store (RedMist)
// ============================================================================

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  clientId: string;
  clientSecret: string;
  
  // Actions
  setCredentials: (clientId: string, clientSecret: string) => Promise<void>;
  clearCredentials: () => void;
  checkAuth: () => void;
}

// Check for environment variables (loaded from .env.local)
const ENV_CLIENT_ID = import.meta.env.VITE_REDMIST_CLIENT_ID || '';
const ENV_CLIENT_SECRET = import.meta.env.VITE_REDMIST_CLIENT_SECRET || '';

// Race-Monitor API token from environment
const ENV_RACEMONITOR_TOKEN = import.meta.env.VITE_RACEMONITOR_API_TOKEN || '';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      // Pre-fill with environment variables if available
      clientId: ENV_CLIENT_ID,
      clientSecret: ENV_CLIENT_SECRET,

      setCredentials: async (clientId, clientSecret) => {
        set({ isLoading: true, error: null });
        
        try {
          tokenManager.configure({ clientId, clientSecret });
          await tokenManager.getToken(); // Verify credentials work
          startAutoRefresh();
          set({ 
            isAuthenticated: true, 
            isLoading: false, 
            clientId,
            clientSecret,
          });
        } catch (error) {
          set({ 
            isAuthenticated: false, 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
          throw error;
        }
      },

      clearCredentials: () => {
        stopAutoRefresh();
        tokenManager.clearToken();
        set({ 
          isAuthenticated: false, 
          clientId: '', 
          clientSecret: '',
          error: null,
        });
      },

      checkAuth: async () => {
        const { clientId, clientSecret, setCredentials } = get();
        if (clientId && clientSecret) {
          // If we have credentials (from env or localStorage), try to authenticate
          try {
            tokenManager.configure({ clientId, clientSecret });
            if (tokenManager.isAuthenticated()) {
              startAutoRefresh();
              set({ isAuthenticated: true });
            } else {
              // Token expired or not present, re-authenticate
              await setCredentials(clientId, clientSecret);
            }
          } catch (error) {
            console.error('[Auth] Auto-auth failed:', error);
          }
        }
      },
    }),
    {
      name: 'redmist-auth',
      partialize: (state) => ({ 
        clientId: state.clientId, 
        clientSecret: state.clientSecret,
      }),
    }
  )
);

// ============================================================================
// Events Store
// ============================================================================

interface EventsState {
  liveEvents: EventListSummary[];
  recentEvents: EventListSummary[];
  selectedEvent: Event | null;
  selectedEventId: number | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLiveEvents: () => Promise<void>;
  fetchLiveAndRecentEvents: () => Promise<void>;
  selectEvent: (eventId: number) => Promise<void>;
  clearSelectedEvent: () => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  liveEvents: [],
  recentEvents: [],
  selectedEvent: null,
  selectedEventId: null,
  sessions: [],
  isLoading: false,
  error: null,

  fetchLiveEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await api.getLiveEvents();
      set({ liveEvents: events, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        isLoading: false,
      });
    }
  },

  fetchLiveAndRecentEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await api.getLiveAndRecentEvents();
      const live = events.filter(e => e.l);
      const recent = events.filter(e => !e.l);
      set({ liveEvents: live, recentEvents: recent, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        isLoading: false,
      });
    }
  },

  selectEvent: async (eventId) => {
    set({ isLoading: true, error: null, selectedEventId: eventId });
    try {
      const [event, sessions] = await Promise.all([
        api.getEvent(eventId),
        api.getSessions(eventId),
      ]);
      set({ selectedEvent: event, sessions, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch event',
        isLoading: false,
      });
    }
  },

  clearSelectedEvent: () => {
    set({ selectedEvent: null, selectedEventId: null, sessions: [] });
  },
}));

// ============================================================================
// Race-Monitor Store
// ============================================================================

interface RaceMonitorState {
  isConfigured: boolean;
  apiToken: string;
  currentRaces: RMRace[];
  selectedRace: RMRace | null;
  liveSession: RMLiveSession | null;
  sessionDetails: RMSessionDetails | null;
  isLoading: boolean;
  error: string | null;
  streamClient: RaceMonitorStream | null;

  // Unified data (merged from both sources)
  unifiedCompetitors: UnifiedCompetitor[];
  lapHistoryByTransponder: Map<string, UnifiedLapData[]>;

  // Actions
  setApiToken: (token: string) => void;
  checkConfig: () => void;
  fetchCurrentRaces: () => Promise<void>;
  fetchPastRaces: () => Promise<void>;
  selectRace: (raceId: number) => Promise<void>;
  fetchLiveSession: (raceId: number) => Promise<void>;
  fetchSessionDetails: (sessionId: number, includeLapTimes?: boolean) => Promise<void>;
  connectToStream: (raceId: number) => Promise<void>;
  disconnectStream: () => void;
  mergeWithRedMist: (redmistCars: CarPosition[], sessionState?: SessionState | null) => void;
}

export const useRaceMonitorStore = create<RaceMonitorState>()(
  persist(
    (set, get) => ({
      isConfigured: !!ENV_RACEMONITOR_TOKEN,
      apiToken: ENV_RACEMONITOR_TOKEN,
      currentRaces: [],
      selectedRace: null,
      liveSession: null,
      sessionDetails: null,
      isLoading: false,
      error: null,
      streamClient: null,
      unifiedCompetitors: [],
      lapHistoryByTransponder: new Map(),

      setApiToken: (token) => {
        raceMonitorApi.setApiToken(token);
        set({ apiToken: token, isConfigured: !!token });
      },

      checkConfig: () => {
        const { apiToken } = get();
        if (apiToken) {
          raceMonitorApi.setApiToken(apiToken);
          set({ isConfigured: true });
        }
      },

      fetchCurrentRaces: async () => {
        const { isConfigured } = get();
        if (!isConfigured) {
          set({ error: 'Race-Monitor API token not configured' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const races = await raceMonitorApi.getPublicCurrentRaces();
          set({ currentRaces: races, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch races',
            isLoading: false,
          });
        }
      },

      fetchPastRaces: async () => {
        const { isConfigured } = get();
        if (!isConfigured) return;

        set({ isLoading: true, error: null });
        try {
          const races = await raceMonitorApi.getPublicPastRaces();
          set({ currentRaces: races, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch races',
            isLoading: false,
          });
        }
      },

      selectRace: async (raceId) => {
        set({ isLoading: true, error: null });
        try {
          const race = await raceMonitorApi.getRaceDetails(raceId);
          set({ selectedRace: race, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch race details',
            isLoading: false,
          });
        }
      },

      fetchLiveSession: async (raceId) => {
        set({ isLoading: true, error: null });
        try {
          const session = await raceMonitorApi.getLiveSession(raceId);
          set({ liveSession: session, isLoading: false });

          // Convert to unified format
          const unified: UnifiedCompetitor[] = [];
          if (session.Competitors) {
            Object.values(session.Competitors).forEach(comp => {
              unified.push(raceMonitorToUnified(comp));
            });
          }
          set({ unifiedCompetitors: unified });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch live session',
            isLoading: false,
          });
        }
      },

      fetchSessionDetails: async (sessionId, includeLapTimes = true) => {
        set({ isLoading: true, error: null });
        try {
          const details = await raceMonitorApi.getSessionDetails(sessionId, includeLapTimes);
          set({ sessionDetails: details, isLoading: false });

          // Convert competitors to unified format with lap times
          const unified: UnifiedCompetitor[] = [];
          const lapHistory = new Map<string, UnifiedLapData[]>();

          details.SortedCompetitors?.forEach(comp => {
            const unifiedComp = raceMonitorToUnified(comp, comp.LapTimes);
            unified.push(unifiedComp);

            // Store lap history by transponder
            if (comp.Transponder && unifiedComp.lapHistory) {
              lapHistory.set(comp.Transponder, unifiedComp.lapHistory);
            }
          });

          set({ unifiedCompetitors: unified, lapHistoryByTransponder: lapHistory });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch session details',
            isLoading: false,
          });
        }
      },

      connectToStream: async (raceId) => {
        const { isConfigured } = get();
        if (!isConfigured) return;

        try {
          const connectionInfo = await raceMonitorApi.getStreamingConnection(raceId);
          const streamClient = new RaceMonitorStream();

          // Subscribe to updates
          streamClient.subscribe((command) => {
            console.log('[RaceMonitor Stream]', command.type, command);
            // Handle real-time updates here
            // This would update unifiedCompetitors based on command type
          });

          await streamClient.connect(connectionInfo);
          set({ streamClient });
        } catch (error) {
          console.error('[RaceMonitor] Failed to connect to stream:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to connect to stream' });
        }
      },

      disconnectStream: () => {
        const { streamClient } = get();
        if (streamClient) {
          streamClient.disconnect();
          set({ streamClient: null });
        }
      },

      /**
       * Merge Race-Monitor data with RedMist data using transponder numbers
       */
      mergeWithRedMist: (redmistCars, sessionState) => {
        const { unifiedCompetitors, lapHistoryByTransponder } = get();

        // Convert RedMist cars to unified format
        const redmistUnified = redmistCars.map(car => redmistToUnified(car, sessionState));

        // Create a map by transponder for Race-Monitor data
        const rmByTransponder = new Map<string, UnifiedCompetitor>();
        unifiedCompetitors.forEach(comp => {
          if (comp.transponder) {
            rmByTransponder.set(comp.transponder, comp);
          }
        });

        // Merge data
        const merged: UnifiedCompetitor[] = redmistUnified.map(rmCar => {
          // Find matching Race-Monitor data by transponder
          const rmData = rmCar.transponder ? rmByTransponder.get(rmCar.transponder) : null;

          if (rmData) {
            // Merge the two sources
            const mergedCar = mergeCompetitorData(rmCar, rmData);

            // Add lap history with flag status from Race-Monitor
            if (mergedCar && rmCar.transponder) {
              mergedCar.lapHistory = lapHistoryByTransponder.get(rmCar.transponder);
            }

            return mergedCar || rmCar;
          }

          return rmCar;
        });

        set({ unifiedCompetitors: merged });

        // Save transponder mappings
        transponderStore.saveToStorage();
      },
    }),
    {
      name: 'racemonitor-store',
      partialize: (state) => ({
        apiToken: state.apiToken,
      }),
    }
  )
);

// ============================================================================
// Session Store (Real-Time Data)
// ============================================================================

interface SessionStore {
  sessionState: SessionState | null;
  carPositions: CarPosition[];
  controlLog: ControlLogEntry[];
  selectedCar: string | null;
  selectedCarMetadata: CompetitorMetadata | null;
  inCarPayload: InCarPayload | null;
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  lastUpdate: Date | null;
  isLoading: boolean;
  error: string | null;
  selectedSessionId: number | null;

  // Actions
  fetchSessionState: (eventId: number) => Promise<void>;
  fetchSpecificSession: (eventId: number, sessionId: number) => Promise<void>;
  setSelectedSession: (sessionId: number | null) => void;
  fetchControlLog: (eventId: number) => Promise<void>;
  connectToLive: (eventId: number) => Promise<void>;
  disconnect: () => Promise<void>;
  selectCar: (eventId: number, carNumber: string) => Promise<void>;
  clearSelectedCar: () => void;
  subscribeToInCar: (eventId: number, carNumber: string) => Promise<void>;

  // Internal update handlers
  updateSessionState: (session: Partial<SessionState>) => void;
  updateCarPositions: (cars: unknown) => void;
  updateControlLog: (entries: ControlLogEntry[]) => void;
  updateInCarPayload: (payload: InCarPayload) => void;
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionState: null,
  carPositions: [],
  controlLog: [],
  selectedCar: null,
  selectedCarMetadata: null,
  inCarPayload: null,
  isConnected: false,
  connectionState: 'disconnected',
  lastUpdate: null,
  isLoading: false,
  error: null,
  selectedSessionId: null,

  setSelectedSession: (sessionId) => {
    set({ selectedSessionId: sessionId });
  },

  fetchSpecificSession: async (eventId, sessionId) => {
    set({ isLoading: true, error: null, selectedSessionId: sessionId });
    try {
      console.log('[Store] Loading specific session:', sessionId);
      const results = await api.getSessionResults(eventId, sessionId);
      if (results && results.carPositions && results.carPositions.length > 0) {
        console.log('[Store] Loaded session with', results.carPositions.length, 'cars');
        set({ 
          sessionState: results, 
          carPositions: results.carPositions || [],
          isLoading: false,
          lastUpdate: new Date(),
        });
      } else {
        console.log('[Store] Session has no results data');
        set({ 
          sessionState: results,
          carPositions: [],
          isLoading: false,
          error: 'No timing data available for this session',
        });
      }
    } catch (error) {
      console.error('[Store] Failed to load session:', error);
      set({ 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load session',
      });
    }
  },

  fetchSessionState: async (eventId) => {
    set({ isLoading: true, error: null });
    try {
      // Try to get live session state first
      const state = await api.getCurrentSessionState(eventId);
      set({ 
        sessionState: state, 
        carPositions: state.carPositions || [],
        isLoading: false,
        lastUpdate: new Date(),
      });
    } catch (error) {
      // GetCurrentSessionState failed - try to load historical session results
      console.log('[Store] Live session not available, trying historical results...');
      try {
        // Get list of sessions for this event
        const sessions = await api.getSessions(eventId);
        if (sessions && sessions.length > 0) {
          console.log('[Store] Found', sessions.length, 'sessions for event');
          
          // Try each session from most recent to oldest
          for (let i = sessions.length - 1; i >= 0; i--) {
            const session = sessions[i];
            console.log('[Store] Trying session:', session.n, 'ID:', session.sid);
            try {
              const results = await api.getSessionResults(eventId, session.sid);
              console.log('[Store] Session results:', JSON.stringify(results, null, 2).substring(0, 500));
              if (results && results.carPositions && results.carPositions.length > 0) {
                console.log('[Store] Found results with', results.carPositions.length, 'cars');
                set({ 
                  sessionState: results, 
                  carPositions: results.carPositions || [],
                  isLoading: false,
                  lastUpdate: new Date(),
                  selectedSessionId: session.sid,
                });
                return; // Successfully loaded results
              } else if (results) {
                // Check for alternative field names
                const possibleCarData = (results as unknown as Record<string, unknown>).competitors || 
                                       (results as unknown as Record<string, unknown>).cars ||
                                       (results as unknown as Record<string, unknown>).entries;
                if (possibleCarData) {
                  console.log('[Store] Found alternative car data field');
                  set({ 
                    sessionState: results, 
                    carPositions: possibleCarData as CarPosition[],
                    isLoading: false,
                    lastUpdate: new Date(),
                  });
                  return;
                }
                console.log('[Store] Session has no car positions, trying next...');
              }
            } catch (sessionErr) {
              console.log('[Store] Failed to load session', session.sid, ':', sessionErr);
            }
          }
          console.log('[Store] No sessions had available results');
          set({ isLoading: false, error: null });
        } else {
          console.log('[Store] No sessions found for event');
          set({ isLoading: false, error: null });
        }
      } catch (histError) {
        console.log('[Store] No historical results available:', histError);
        set({ isLoading: false, error: null });
      }
    }
  },

  fetchControlLog: async (eventId) => {
    try {
      const log = await api.getControlLog(eventId);
      set({ controlLog: log });
    } catch (error) {
      console.error('Failed to fetch control log:', error);
    }
  },

  connectToLive: async (eventId) => {
    const store = get();
    
    // Fetch initial state from REST API
    try {
      await store.fetchSessionState(eventId);
      await store.fetchControlLog(eventId);
      
      // Check if session is completed (checkered flag = 5)
      const currentState = get().sessionState;
      const isCompleted = currentState?.currentFlag === 5; // Checkered flag
      
      if (isCompleted) {
        console.log('[Store] Session is completed (checkered flag) - no polling needed');
        set({ isConnected: true, connectionState: 'connected' });
        return;
      }
      
      // Note: SignalR real-time updates are disabled due to CORS limitations
      // in local development. The data is fetched via REST API polling instead.
      console.log('[Store] Real-time updates via SignalR are not available in dev mode due to CORS');
      console.log('[Store] Using REST API polling for updates instead');
      
      // Set up polling for updates (every 5 seconds for live events)
      const pollInterval = setInterval(async () => {
        try {
          const state = get().sessionState;
          // Stop polling if session becomes completed
          if (state?.currentFlag === 5) {
            console.log('[Store] Session completed - stopping polling');
            clearInterval(pollInterval);
            return;
          }
          await store.fetchSessionState(eventId);
        } catch (e) {
          console.error('[Store] Polling error:', e);
        }
      }, 5000);
      
      // Store the interval ID for cleanup
      (window as unknown as { __pollInterval?: ReturnType<typeof setInterval> }).__pollInterval = pollInterval;
      
      set({ isConnected: true, connectionState: 'connected' });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch session state',
        isConnected: false,
      });
    }
  },

  disconnect: async () => {
    // Clear polling interval
    const pollInterval = (window as unknown as { __pollInterval?: ReturnType<typeof setInterval> }).__pollInterval;
    if (pollInterval) {
      clearInterval(pollInterval);
      (window as unknown as { __pollInterval?: ReturnType<typeof setInterval> }).__pollInterval = undefined;
    }
    
    set({ 
      isConnected: false, 
      connectionState: 'disconnected',
      sessionState: null, 
      carPositions: [], 
      controlLog: [],
      inCarPayload: null,
    });
  },

  selectCar: async (eventId, carNumber) => {
    set({ selectedCar: carNumber, selectedCarMetadata: null });
    try {
      const metadata = await api.getCompetitorMetadata(eventId, carNumber);
      set({ selectedCarMetadata: metadata });
    } catch (error) {
      console.error('Failed to fetch car metadata:', error);
    }
  },

  clearSelectedCar: () => {
    set({ selectedCar: null, selectedCarMetadata: null, inCarPayload: null });
  },

  subscribeToInCar: async (eventId, carNumber) => {
    try {
      // Note: SignalR real-time subscription disabled, using REST polling
      // Fetch initial in-car payload
      const payload = await api.getInCarPayload(eventId, carNumber);
      set({ inCarPayload: payload });
    } catch (error) {
      console.error('Failed to fetch in-car data:', error);
    }
  },

  // Internal update handlers
  updateSessionState: (session) => {
    set((state) => ({
      sessionState: state.sessionState 
        ? { ...state.sessionState, ...session }
        : session as SessionState,
      carPositions: session.carPositions || state.carPositions,
      lastUpdate: new Date(),
    }));
  },

  updateCarPositions: (cars) => {
    if (Array.isArray(cars)) {
      set({ carPositions: cars as CarPosition[], lastUpdate: new Date() });
    }
  },

  updateControlLog: (entries) => {
    set({ controlLog: entries });
  },

  updateInCarPayload: (payload) => {
    set({ inCarPayload: payload });
  },

  setConnectionState: (connectionState) => {
    set({ 
      connectionState,
      isConnected: connectionState === 'connected',
    });
  },
}));

// ============================================================================
// UI Store
// ============================================================================

type ViewMode = 'timing' | 'standings' | 'control-log' | 'in-car' | 'strategy';

interface UIState {
  viewMode: ViewMode;
  isDarkMode: boolean;
  showClassGroups: boolean;
  autoScroll: boolean;
  fontSize: 'small' | 'medium' | 'large';
  myCar: string | null; // User's car number for strategy view
  classFilter: string | null; // Filter to show only specific class
  highlightMyCar: boolean; // Highlight user's car in timing table

  // Actions
  setViewMode: (mode: ViewMode) => void;
  toggleDarkMode: () => void;
  toggleClassGroups: () => void;
  toggleAutoScroll: () => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setMyCar: (carNumber: string | null) => void;
  setClassFilter: (classId: string | null) => void;
  toggleHighlightMyCar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'timing',
      isDarkMode: true,
      showClassGroups: false,
      autoScroll: true,
      fontSize: 'medium',
      myCar: null,
      classFilter: null,
      highlightMyCar: true,

      setViewMode: (mode) => set({ viewMode: mode }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      toggleClassGroups: () => set((state) => ({ showClassGroups: !state.showClassGroups })),
      toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),
      setFontSize: (size) => set({ fontSize: size }),
      setMyCar: (carNumber) => set({ myCar: carNumber }),
      setClassFilter: (classId) => set({ classFilter: classId }),
      toggleHighlightMyCar: () => set((state) => ({ highlightMyCar: !state.highlightMyCar })),
    }),
    {
      name: 'redmist-ui',
    }
  )
);

