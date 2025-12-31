// Supabase client configuration for RedMist Racing Dashboard
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Database features disabled.');
  console.warn('[Supabase] URL:', supabaseUrl ? 'set' : 'missing');
  console.warn('[Supabase] Key:', supabaseAnonKey ? 'set' : 'missing');
} else {
  console.log('[Supabase] ✓ Configured:', supabaseUrl);
}

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Check if Supabase is available
export const isSupabaseEnabled = (): boolean => {
  return supabase !== null;
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DbEvent {
  id?: number;
  redmist_event_id: number;
  name: string;
  series?: string;
  track_name?: string;
  track_id?: number;
  start_date?: string;
  end_date?: string;
  is_live?: boolean;
  raw_data?: Record<string, unknown>;
}

export interface DbSession {
  id?: number;
  event_id: number;
  redmist_session_id: number;
  name: string;
  session_type?: string;
  start_time?: string;
  end_time?: string;
  total_laps?: number;
  is_complete?: boolean;
  raw_data?: Record<string, unknown>;
}

export interface DbLap {
  id?: number;
  session_id: number;
  car_number: string;
  lap_number: number;
  lap_time_ms?: number;
  lap_time_formatted?: string;
  position?: number;
  class_position?: number;
  gap_to_leader?: string;
  gap_to_leader_ms?: number;
  best_lap_time_ms?: number;
  pit_in?: boolean;
  pit_out?: boolean;
  flag_status?: string;
  timestamp?: string;
  raw_data?: Record<string, unknown>;
}

export interface DbCompetitor {
  id?: number;
  car_number: string;
  transponder_id?: string;
  team_name?: string;
  class_name?: string;
  vehicle?: string;
  drivers?: string[];
}

export interface DbPitStop {
  id?: number;
  session_id: number;
  car_number: string;
  pit_stop_number: number;
  lap_in?: number;
  lap_out?: number;
  pit_duration_ms?: number;
  position_before?: number;
  position_after?: number;
}

export interface DbControlLogEntry {
  id?: number;
  session_id: number;
  timestamp: string;
  race_time?: string;
  lap_number?: number;
  entry_type?: string;
  car_number?: string;
  flag_type?: string;
  penalty_code?: string;
  penalty_description?: string;
  message?: string;
  raw_data?: Record<string, unknown>;
}

export interface DbStrategyNote {
  id?: number;
  session_id: number;
  lap_number?: number;
  race_time?: string;
  car_number?: string;
  note_type?: string;
  note_text: string;
  importance?: string;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

export const db = {
  // Events
  async upsertEvent(event: DbEvent): Promise<DbEvent | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('events')
      .upsert(event, { onConflict: 'redmist_event_id' })
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] Error upserting event:', error);
      return null;
    }
    return data;
  },

  async getEvent(redmistEventId: number): Promise<DbEvent | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('redmist_event_id', redmistEventId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // Not found is OK
        console.error('[Supabase] Error getting event:', error);
      }
      return null;
    }
    return data;
  },

  async getRecentEvents(limit = 20): Promise<DbEvent[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[Supabase] Error getting recent events:', error);
      return [];
    }
    return data || [];
  },

  // Sessions
  async upsertSession(session: DbSession): Promise<DbSession | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('sessions')
      .upsert(session, { onConflict: 'event_id,redmist_session_id' })
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] Error upserting session:', error);
      return null;
    }
    return data;
  },

  async getSession(eventId: number, redmistSessionId: number): Promise<DbSession | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('event_id', eventId)
      .eq('redmist_session_id', redmistSessionId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Supabase] Error getting session:', error);
      }
      return null;
    }
    return data;
  },

  async getSessionsByEvent(eventId: number): Promise<DbSession[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('event_id', eventId)
      .order('redmist_session_id', { ascending: true });
    
    if (error) {
      console.error('[Supabase] Error getting sessions:', error);
      return [];
    }
    return data || [];
  },

  // Laps - Bulk operations for Race Replay
  async upsertLaps(laps: DbLap[]): Promise<number> {
    if (!supabase || laps.length === 0) return 0;
    
    // Batch insert in chunks of 500
    const chunkSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < laps.length; i += chunkSize) {
      const chunk = laps.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('laps')
        .upsert(chunk, { onConflict: 'session_id,car_number,lap_number' });
      
      if (error) {
        console.error('[Supabase] Error upserting laps chunk:', error);
      } else {
        inserted += chunk.length;
      }
    }
    
    console.log(`[Supabase] Inserted ${inserted} laps`);
    return inserted;
  },

  async getLapsForSession(sessionId: number): Promise<DbLap[]> {
    if (!supabase) return [];
    
    console.log(`[Supabase] getLapsForSession called with sessionId: ${sessionId}`);
    
    // Supabase has a server-side limit of 1000 rows per query by default
    // We need to paginate to get all rows for endurance races (6000+ laps)
    const allLaps: DbLap[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('laps')
        .select('*')
        .eq('session_id', sessionId)
        .order('car_number', { ascending: true })
        .order('lap_number', { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (error) {
        console.error('[Supabase] Error getting laps:', error);
        return allLaps; // Return what we have so far
      }
      
      if (data && data.length > 0) {
        allLaps.push(...data);
        offset += data.length;
        hasMore = data.length === pageSize; // If we got a full page, there might be more
      } else {
        hasMore = false;
      }
    }
    
    console.log(`[Supabase] getLapsForSession returned ${allLaps.length} total rows`);
    return allLaps;
  },

  async getLapsForCar(sessionId: number, carNumber: string): Promise<DbLap[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('laps')
      .select('*')
      .eq('session_id', sessionId)
      .eq('car_number', carNumber)
      .order('lap_number', { ascending: true });
    
    if (error) {
      console.error('[Supabase] Error getting car laps:', error);
      return [];
    }
    return data || [];
  },

  async getSessionLapCount(sessionId: number): Promise<number> {
    if (!supabase) return 0;
    
    const { count, error } = await supabase
      .from('laps')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('[Supabase] Error counting laps:', error);
      return 0;
    }
    return count || 0;
  },

  // Competitors
  async upsertCompetitor(competitor: DbCompetitor): Promise<DbCompetitor | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('competitors')
      .upsert(competitor)
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] Error upserting competitor:', error);
      return null;
    }
    return data;
  },

  async getCompetitorByTransponder(transponderId: string): Promise<DbCompetitor | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('transponder_id', transponderId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Supabase] Error getting competitor:', error);
      }
      return null;
    }
    return data;
  },

  // Control Log
  async upsertControlLogEntries(entries: DbControlLogEntry[]): Promise<number> {
    if (!supabase || entries.length === 0) return 0;
    
    const { error } = await supabase
      .from('control_log')
      .upsert(entries);
    
    if (error) {
      console.error('[Supabase] Error upserting control log:', error);
      return 0;
    }
    return entries.length;
  },

  async getControlLog(sessionId: number): Promise<DbControlLogEntry[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('control_log')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('[Supabase] Error getting control log:', error);
      return [];
    }
    return data || [];
  },

  // Strategy Notes
  async addNote(note: DbStrategyNote): Promise<DbStrategyNote | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('strategy_notes')
      .insert(note)
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] Error adding note:', error);
      return null;
    }
    return data;
  },

  async getNotesForSession(sessionId: number): Promise<DbStrategyNote[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('strategy_notes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Supabase] Error getting notes:', error);
      return [];
    }
    return data || [];
  },

  async deleteNote(noteId: number): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('strategy_notes')
      .delete()
      .eq('id', noteId);
    
    if (error) {
      console.error('[Supabase] Error deleting note:', error);
      return false;
    }
    return true;
  },

  // Sync Status
  async getSyncStatus(entityType: string, entityId: string): Promise<{ lastSynced: Date | null; status: string } | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('sync_status')
      .select('last_synced_at, status')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Supabase] Error getting sync status:', error);
      }
      return null;
    }
    return {
      lastSynced: data.last_synced_at ? new Date(data.last_synced_at) : null,
      status: data.status,
    };
  },

  async updateSyncStatus(entityType: string, entityId: string, status: string = 'complete'): Promise<void> {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('sync_status')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        last_synced_at: new Date().toISOString(),
        status,
        sync_source: 'redmist',
      }, { onConflict: 'entity_type,entity_id' });
    
    if (error) {
      console.error('[Supabase] Error updating sync status:', error);
    }
  },

  // Pit Stops
  async upsertPitStops(pitStops: DbPitStop[]): Promise<number> {
    if (!supabase || pitStops.length === 0) return 0;
    
    const { error } = await supabase
      .from('pit_stops')
      .upsert(pitStops, { onConflict: 'session_id,car_number,pit_stop_number' });
    
    if (error) {
      console.error('[Supabase] Error upserting pit stops:', error);
      return 0;
    }
    return pitStops.length;
  },

  async getPitStops(sessionId: number): Promise<DbPitStop[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('pit_stops')
      .select('*')
      .eq('session_id', sessionId)
      .order('car_number', { ascending: true })
      .order('pit_stop_number', { ascending: true });
    
    if (error) {
      console.error('[Supabase] Error getting pit stops:', error);
      return [];
    }
    return data || [];
  },
};

export default supabase;

