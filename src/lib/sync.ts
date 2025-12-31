// Data Sync Service - Syncs RedMist API data to Supabase
import { api } from './api';
import { db, isSupabaseEnabled } from './supabase';
import type { DbLap, DbEvent, DbSession } from './supabase';

// ============================================
// SYNC STATUS TRACKING
// ============================================

interface SyncProgress {
  status: 'idle' | 'syncing' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

type SyncCallback = (progress: SyncProgress) => void;

// ============================================
// EVENT SYNC
// ============================================

export async function syncEvent(
  eventId: number,
  onProgress?: SyncCallback
): Promise<DbEvent | null> {
  if (!isSupabaseEnabled()) {
    console.log('[Sync] Supabase not configured, skipping event sync');
    return null;
  }

  onProgress?.({ status: 'syncing', progress: 0, message: 'Loading event data...' });

  try {
    // Fetch event from RedMist API
    const event = await api.getEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Upsert to Supabase
    // Map Event type (abbreviated properties) to DbEvent
    const dbEvent = await db.upsertEvent({
      redmist_event_id: eventId,
      name: event.n || `Event ${eventId}`,
      series: undefined, // Not available in Event type
      track_name: undefined, // Not available in Event type
      track_id: undefined, // Not available in Event type
      start_date: event.d || undefined,
      end_date: undefined, // Not available in Event type
      is_live: false,
      raw_data: event as unknown as Record<string, unknown>,
    });

    await db.updateSyncStatus('event', eventId.toString());

    onProgress?.({ status: 'complete', progress: 100, message: 'Event synced' });
    console.log(`[Sync] Event ${eventId} synced to Supabase`);
    
    return dbEvent;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({ status: 'error', progress: 0, message: 'Sync failed', error: message });
    console.error('[Sync] Event sync failed:', error);
    return null;
  }
}

// ============================================
// SESSION SYNC
// ============================================

export async function syncSession(
  eventId: number,
  sessionId: number,
  dbEventId: number,
  onProgress?: SyncCallback
): Promise<DbSession | null> {
  if (!isSupabaseEnabled()) return null;

  onProgress?.({ status: 'syncing', progress: 0, message: 'Loading session data...' });

  try {
    // Fetch session results from RedMist API
    const results = await api.getSessionResults(eventId, sessionId);
    if (!results) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Upsert session
    const dbSession = await db.upsertSession({
      event_id: dbEventId,
      redmist_session_id: sessionId,
      name: results.sessionName || `Session ${sessionId}`,
      session_type: results.isPracticeQualifying ? 'practice' : 'race',
      is_complete: !results.isLive,
      raw_data: results as unknown as Record<string, unknown>,
    });

    await db.updateSyncStatus('session', `${eventId}-${sessionId}`);

    onProgress?.({ status: 'complete', progress: 100, message: 'Session synced' });
    console.log(`[Sync] Session ${sessionId} synced to Supabase`);
    
    return dbSession;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({ status: 'error', progress: 0, message: 'Sync failed', error: message });
    console.error('[Sync] Session sync failed:', error);
    return null;
  }
}

// ============================================
// LAP DATA SYNC (for Race Replay)
// ============================================

export async function syncLapData(
  eventId: number,
  sessionId: number,
  dbSessionId: number,
  carNumbers: string[],
  onProgress?: SyncCallback
): Promise<number> {
  if (!isSupabaseEnabled()) {
    console.log('[Sync] Supabase not configured, skipping lap sync');
    return 0;
  }

  // Check if already synced
  const syncStatus = await db.getSyncStatus('laps', `${eventId}-${sessionId}`);
  if (syncStatus?.status === 'complete') {
    const lapCount = await db.getSessionLapCount(dbSessionId);
    if (lapCount > 0) {
      console.log(`[Sync] Laps for session ${sessionId} already synced (${lapCount} laps)`);
      onProgress?.({ status: 'complete', progress: 100, message: `Loaded ${lapCount} cached laps` });
      return lapCount;
    }
  }

  onProgress?.({ status: 'syncing', progress: 0, message: `Syncing lap data for ${carNumbers.length} cars...` });

  try {
    const allLaps: DbLap[] = [];
    let processed = 0;

    for (const carNumber of carNumbers) {
      try {
        const laps = await api.getCarLaps(eventId, sessionId, carNumber);
        
        if (laps && laps.length > 0) {
          for (let i = 0; i < laps.length; i++) {
            const lap = laps[i];
            allLaps.push({
              session_id: dbSessionId,
              car_number: carNumber,
              lap_number: i + 1, // Use index as lap number
              lap_time_ms: lap.ltm ? parseLapTimeToMs(lap.ltm) : undefined,
              lap_time_formatted: lap.ltm ?? undefined,
              position: lap.ovp ?? lap.p ?? undefined,
              class_position: lap.cp ?? undefined,
              gap_to_leader: lap.og ?? lap.gl ?? undefined,
              best_lap_time_ms: lap.bt ? parseLapTimeToMs(lap.bt) : undefined,
              pit_in: lap.ip === true,
              pit_out: lap.lip === true, // lip = last in pit
              flag_status: estimateFlagStatus(lap as unknown as Record<string, unknown>),
              raw_data: lap as unknown as Record<string, unknown>,
            });
          }
        }
      } catch (error) {
        console.warn(`[Sync] Failed to fetch laps for car ${carNumber}:`, error);
      }

      processed++;
      const progress = Math.round((processed / carNumbers.length) * 100);
      onProgress?.({ 
        status: 'syncing', 
        progress, 
        message: `Syncing laps: ${processed}/${carNumbers.length} cars` 
      });
    }

    // Batch insert all laps
    if (allLaps.length > 0) {
      await db.upsertLaps(allLaps);
      await db.updateSyncStatus('laps', `${eventId}-${sessionId}`);
    }

    console.log(`[Sync] Synced ${allLaps.length} laps for session ${sessionId}`);
    onProgress?.({ status: 'complete', progress: 100, message: `Synced ${allLaps.length} laps` });
    
    return allLaps.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({ status: 'error', progress: 0, message: 'Lap sync failed', error: message });
    console.error('[Sync] Lap sync failed:', error);
    return 0;
  }
}

// ============================================
// GET CACHED LAP DATA
// ============================================

export async function getCachedLapData(
  sessionId: number
): Promise<{ carNumber: string; laps: DbLap[] }[]> {
  if (!isSupabaseEnabled()) return [];

  try {
    const laps = await db.getLapsForSession(sessionId);
    
    // Group by car number
    const byCarNumber = new Map<string, DbLap[]>();
    for (const lap of laps) {
      const existing = byCarNumber.get(lap.car_number) || [];
      existing.push(lap);
      byCarNumber.set(lap.car_number, existing);
    }

    return Array.from(byCarNumber.entries()).map(([carNumber, laps]) => ({
      carNumber,
      laps,
    }));
  } catch (error) {
    console.error('[Sync] Failed to get cached laps:', error);
    return [];
  }
}

// ============================================
// FULL SESSION SYNC
// ============================================

export async function syncFullSession(
  eventId: number,
  sessionId: number,
  carNumbers: string[],
  onProgress?: SyncCallback
): Promise<{ success: boolean; lapCount: number; dbSessionId?: number }> {
  if (!isSupabaseEnabled()) {
    return { success: false, lapCount: 0 };
  }

  try {
    // Step 1: Sync event
    onProgress?.({ status: 'syncing', progress: 5, message: 'Syncing event...' });
    const dbEvent = await syncEvent(eventId);
    if (!dbEvent?.id) {
      throw new Error('Failed to sync event');
    }

    // Step 2: Sync session
    onProgress?.({ status: 'syncing', progress: 10, message: 'Syncing session...' });
    const dbSession = await syncSession(eventId, sessionId, dbEvent.id);
    if (!dbSession?.id) {
      throw new Error('Failed to sync session');
    }

    // Step 3: Sync lap data
    onProgress?.({ status: 'syncing', progress: 15, message: 'Syncing lap data...' });
    const lapCount = await syncLapData(
      eventId, 
      sessionId, 
      dbSession.id, 
      carNumbers,
      (p) => {
        // Scale progress from 15% to 100%
        const scaledProgress = 15 + (p.progress * 0.85);
        onProgress?.({ ...p, progress: Math.round(scaledProgress) });
      }
    );

    return { success: true, lapCount, dbSessionId: dbSession.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({ status: 'error', progress: 0, message: 'Full sync failed', error: message });
    console.error('[Sync] Full session sync failed:', error);
    return { success: false, lapCount: 0 };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseLapTimeToMs(timeStr: string): number {
  if (!timeStr || timeStr === '-' || timeStr === '00:00:00.000') return 0;
  
  // Handle formats like "01:43.615" or "1:43.615" or "00:01:43.615"
  const parts = timeStr.split(':');
  let ms = 0;
  
  if (parts.length === 2) {
    // MM:SS.mmm
    const minutes = parseInt(parts[0]) || 0;
    const secParts = parts[1].split('.');
    const seconds = parseInt(secParts[0]) || 0;
    const millis = parseInt(secParts[1]?.padEnd(3, '0') || '0');
    ms = (minutes * 60 + seconds) * 1000 + millis;
  } else if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const secParts = parts[2].split('.');
    const seconds = parseInt(secParts[0]) || 0;
    const millis = parseInt(secParts[1]?.padEnd(3, '0') || '0');
    ms = ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  }
  
  return ms;
}

function estimateFlagStatus(lap: Record<string, unknown>): string {
  // Try to determine flag status from lap data
  if (lap.flagStatus) return String(lap.flagStatus);
  if (lap.fs) return String(lap.fs);
  
  // If lap time is significantly slower, might be yellow
  // This is a rough heuristic
  return 'green';
}

// ============================================
// STRATEGY NOTES SYNC
// ============================================

export async function addStrategyNote(
  sessionId: number,
  note: {
    lapNumber?: number;
    raceTime?: string;
    carNumber?: string;
    noteType?: string;
    noteText: string;
    importance?: string;
  }
): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;

  const result = await db.addNote({
    session_id: sessionId,
    lap_number: note.lapNumber,
    race_time: note.raceTime,
    car_number: note.carNumber,
    note_type: note.noteType || 'general',
    note_text: note.noteText,
    importance: note.importance || 'normal',
  });

  return result !== null;
}

export async function getStrategyNotes(sessionId: number) {
  if (!isSupabaseEnabled()) return [];
  return db.getNotesForSession(sessionId);
}

export async function deleteStrategyNote(noteId: number): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;
  return db.deleteNote(noteId);
}

