-- RedMist Racing Dashboard - Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/njociburjabxapevzvia/sql

-- ============================================
-- EVENTS TABLE
-- Stores race events from RedMist API
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  redmist_event_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  series TEXT,
  track_name TEXT,
  track_id INTEGER,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_live BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast event lookups
CREATE INDEX IF NOT EXISTS idx_events_redmist_id ON events(redmist_event_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date DESC);

-- ============================================
-- SESSIONS TABLE
-- Practice, Qualifying, Race sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  redmist_session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  session_type TEXT, -- 'practice', 'qualifying', 'race'
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  total_laps INTEGER,
  green_flag_laps INTEGER,
  yellow_flag_laps INTEGER,
  red_flag_laps INTEGER,
  is_complete BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, redmist_session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id);

-- ============================================
-- COMPETITORS TABLE
-- Cars/Teams with transponder linking
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
  id BIGSERIAL PRIMARY KEY,
  car_number TEXT NOT NULL,
  transponder_id TEXT, -- For linking RedMist + Race-Monitor data
  team_name TEXT,
  class_name TEXT,
  vehicle TEXT,
  drivers JSONB, -- Array of driver names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on car number + transponder
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_car_transponder 
  ON competitors(car_number, COALESCE(transponder_id, ''));
CREATE INDEX IF NOT EXISTS idx_competitors_transponder ON competitors(transponder_id);

-- ============================================
-- SESSION ENTRIES TABLE
-- Links competitors to specific sessions
-- ============================================
CREATE TABLE IF NOT EXISTS session_entries (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions(id) ON DELETE CASCADE,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  car_number TEXT NOT NULL,
  class_name TEXT,
  starting_position INTEGER,
  finishing_position INTEGER,
  total_laps INTEGER,
  best_lap_time_ms INTEGER,
  total_pit_stops INTEGER,
  status TEXT, -- 'running', 'finished', 'dnf', 'dsq'
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, car_number)
);

CREATE INDEX IF NOT EXISTS idx_session_entries_session ON session_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_session_entries_competitor ON session_entries(competitor_id);

-- ============================================
-- LAPS TABLE
-- Individual lap records for Race Replay
-- ============================================
CREATE TABLE IF NOT EXISTS laps (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions(id) ON DELETE CASCADE,
  car_number TEXT NOT NULL,
  lap_number INTEGER NOT NULL,
  lap_time_ms INTEGER,
  lap_time_formatted TEXT,
  position INTEGER, -- Overall position at end of this lap
  class_position INTEGER,
  gap_to_leader TEXT,
  gap_to_leader_ms INTEGER,
  interval_to_ahead TEXT,
  interval_to_ahead_ms INTEGER,
  best_lap_time_ms INTEGER,
  sector_1_ms INTEGER,
  sector_2_ms INTEGER,
  sector_3_ms INTEGER,
  pit_in BOOLEAN DEFAULT FALSE,
  pit_out BOOLEAN DEFAULT FALSE,
  flag_status TEXT, -- 'green', 'yellow', 'red', 'checkered'
  timestamp TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, car_number, lap_number)
);

-- Indexes for fast lap queries
CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id);
CREATE INDEX IF NOT EXISTS idx_laps_session_car ON laps(session_id, car_number);
CREATE INDEX IF NOT EXISTS idx_laps_session_lap ON laps(session_id, lap_number);

-- ============================================
-- PIT STOPS TABLE
-- Detailed pit stop records
-- ============================================
CREATE TABLE IF NOT EXISTS pit_stops (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions(id) ON DELETE CASCADE,
  car_number TEXT NOT NULL,
  pit_stop_number INTEGER NOT NULL,
  lap_in INTEGER,
  lap_out INTEGER,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  pit_duration_ms INTEGER,
  pit_lane_time_ms INTEGER, -- Time from pit entry to exit
  position_before INTEGER,
  position_after INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, car_number, pit_stop_number)
);

CREATE INDEX IF NOT EXISTS idx_pit_stops_session ON pit_stops(session_id);
CREATE INDEX IF NOT EXISTS idx_pit_stops_car ON pit_stops(session_id, car_number);

-- ============================================
-- CONTROL LOG TABLE
-- Race control entries, penalties, flags
-- ============================================
CREATE TABLE IF NOT EXISTS control_log (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  race_time TEXT, -- "01:23:45" format
  lap_number INTEGER,
  entry_type TEXT, -- 'flag', 'penalty', 'message', 'pit_open', 'pit_closed'
  car_number TEXT,
  flag_type TEXT, -- 'green', 'yellow', 'red', 'checkered', 'black', 'meatball'
  penalty_code TEXT,
  penalty_description TEXT,
  message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_log_session ON control_log(session_id);
CREATE INDEX IF NOT EXISTS idx_control_log_timestamp ON control_log(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_control_log_car ON control_log(session_id, car_number);

-- ============================================
-- STRATEGY NOTES TABLE
-- User's personal race notes
-- ============================================
CREATE TABLE IF NOT EXISTS strategy_notes (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions(id) ON DELETE CASCADE,
  lap_number INTEGER,
  race_time TEXT,
  car_number TEXT, -- Optional, if note is about a specific car
  note_type TEXT, -- 'observation', 'pit_strategy', 'competitor', 'flag', 'general'
  note_text TEXT NOT NULL,
  importance TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_session ON strategy_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_car ON strategy_notes(session_id, car_number);

-- ============================================
-- SYNC STATUS TABLE
-- Track what data has been synced
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'event', 'session', 'laps', 'control_log'
  entity_id TEXT NOT NULL, -- The ID of what was synced
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_source TEXT, -- 'redmist', 'racemonitor'
  status TEXT DEFAULT 'complete', -- 'complete', 'partial', 'failed'
  error_message TEXT,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_status_entity ON sync_status(entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- For now, allow all access (single user app)
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE pit_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (anon key)
-- You can restrict this later with proper auth
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true);
CREATE POLICY "Allow all access to sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all access to competitors" ON competitors FOR ALL USING (true);
CREATE POLICY "Allow all access to session_entries" ON session_entries FOR ALL USING (true);
CREATE POLICY "Allow all access to laps" ON laps FOR ALL USING (true);
CREATE POLICY "Allow all access to pit_stops" ON pit_stops FOR ALL USING (true);
CREATE POLICY "Allow all access to control_log" ON control_log FOR ALL USING (true);
CREATE POLICY "Allow all access to strategy_notes" ON strategy_notes FOR ALL USING (true);
CREATE POLICY "Allow all access to sync_status" ON sync_status FOR ALL USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_notes_updated_at
  BEFORE UPDATE ON strategy_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Race results view
CREATE OR REPLACE VIEW race_results AS
SELECT 
  e.name as event_name,
  s.name as session_name,
  se.finishing_position as position,
  se.car_number,
  c.team_name,
  se.class_name,
  se.total_laps,
  se.best_lap_time_ms,
  se.total_pit_stops,
  se.status
FROM session_entries se
JOIN sessions s ON se.session_id = s.id
JOIN events e ON s.event_id = e.id
LEFT JOIN competitors c ON se.competitor_id = c.id
ORDER BY e.start_date DESC, s.id, se.finishing_position;

-- Lap time analysis view
CREATE OR REPLACE VIEW lap_analysis AS
SELECT 
  l.session_id,
  l.car_number,
  COUNT(*) as total_laps,
  MIN(l.lap_time_ms) as best_lap_ms,
  AVG(l.lap_time_ms) as avg_lap_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.lap_time_ms) as median_lap_ms,
  COUNT(*) FILTER (WHERE l.flag_status = 'green') as green_flag_laps,
  MIN(l.lap_time_ms) FILTER (WHERE l.flag_status = 'green') as best_green_lap_ms,
  AVG(l.lap_time_ms) FILTER (WHERE l.flag_status = 'green') as avg_green_lap_ms
FROM laps l
WHERE l.lap_time_ms > 0
GROUP BY l.session_id, l.car_number;

-- ============================================
-- DONE! Schema ready for RedMist Racing Dashboard
-- ============================================

