// Auto-generated types for Supabase tables
// These match the schema in supabase/schema.sql

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: number;
          redmist_event_id: number;
          name: string;
          series: string | null;
          track_name: string | null;
          track_id: number | null;
          start_date: string | null;
          end_date: string | null;
          is_live: boolean;
          raw_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          redmist_event_id: number;
          name: string;
          series?: string | null;
          track_name?: string | null;
          track_id?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_live?: boolean;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          redmist_event_id?: number;
          name?: string;
          series?: string | null;
          track_name?: string | null;
          track_id?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_live?: boolean;
          raw_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: number;
          event_id: number;
          redmist_session_id: number;
          name: string;
          session_type: string | null;
          start_time: string | null;
          end_time: string | null;
          total_laps: number | null;
          green_flag_laps: number | null;
          yellow_flag_laps: number | null;
          red_flag_laps: number | null;
          is_complete: boolean;
          raw_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          redmist_session_id: number;
          name: string;
          session_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          total_laps?: number | null;
          green_flag_laps?: number | null;
          yellow_flag_laps?: number | null;
          red_flag_laps?: number | null;
          is_complete?: boolean;
          raw_data?: Record<string, unknown> | null;
        };
        Update: {
          name?: string;
          session_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          total_laps?: number | null;
          is_complete?: boolean;
          raw_data?: Record<string, unknown> | null;
        };
      };
      laps: {
        Row: {
          id: number;
          session_id: number;
          car_number: string;
          lap_number: number;
          lap_time_ms: number | null;
          lap_time_formatted: string | null;
          position: number | null;
          class_position: number | null;
          gap_to_leader: string | null;
          gap_to_leader_ms: number | null;
          interval_to_ahead: string | null;
          interval_to_ahead_ms: number | null;
          best_lap_time_ms: number | null;
          sector_1_ms: number | null;
          sector_2_ms: number | null;
          sector_3_ms: number | null;
          pit_in: boolean;
          pit_out: boolean;
          flag_status: string | null;
          timestamp: string | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          car_number: string;
          lap_number: number;
          lap_time_ms?: number | null;
          lap_time_formatted?: string | null;
          position?: number | null;
          class_position?: number | null;
          gap_to_leader?: string | null;
          gap_to_leader_ms?: number | null;
          interval_to_ahead?: string | null;
          interval_to_ahead_ms?: number | null;
          best_lap_time_ms?: number | null;
          sector_1_ms?: number | null;
          sector_2_ms?: number | null;
          sector_3_ms?: number | null;
          pit_in?: boolean;
          pit_out?: boolean;
          flag_status?: string | null;
          timestamp?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
        Update: {
          lap_time_ms?: number | null;
          position?: number | null;
          flag_status?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
      };
      competitors: {
        Row: {
          id: number;
          car_number: string;
          transponder_id: string | null;
          team_name: string | null;
          class_name: string | null;
          vehicle: string | null;
          drivers: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          car_number: string;
          transponder_id?: string | null;
          team_name?: string | null;
          class_name?: string | null;
          vehicle?: string | null;
          drivers?: string[] | null;
        };
        Update: {
          car_number?: string;
          transponder_id?: string | null;
          team_name?: string | null;
          class_name?: string | null;
          vehicle?: string | null;
          drivers?: string[] | null;
        };
      };
      session_entries: {
        Row: {
          id: number;
          session_id: number;
          competitor_id: number | null;
          car_number: string;
          class_name: string | null;
          starting_position: number | null;
          finishing_position: number | null;
          total_laps: number | null;
          best_lap_time_ms: number | null;
          total_pit_stops: number | null;
          status: string | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          competitor_id?: number | null;
          car_number: string;
          class_name?: string | null;
          starting_position?: number | null;
          finishing_position?: number | null;
          total_laps?: number | null;
          best_lap_time_ms?: number | null;
          total_pit_stops?: number | null;
          status?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
        Update: {
          finishing_position?: number | null;
          total_laps?: number | null;
          best_lap_time_ms?: number | null;
          status?: string | null;
        };
      };
      pit_stops: {
        Row: {
          id: number;
          session_id: number;
          car_number: string;
          pit_stop_number: number;
          lap_in: number | null;
          lap_out: number | null;
          time_in: string | null;
          time_out: string | null;
          pit_duration_ms: number | null;
          pit_lane_time_ms: number | null;
          position_before: number | null;
          position_after: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          car_number: string;
          pit_stop_number: number;
          lap_in?: number | null;
          lap_out?: number | null;
          time_in?: string | null;
          time_out?: string | null;
          pit_duration_ms?: number | null;
          pit_lane_time_ms?: number | null;
          position_before?: number | null;
          position_after?: number | null;
          notes?: string | null;
        };
        Update: {
          lap_out?: number | null;
          time_out?: string | null;
          pit_duration_ms?: number | null;
          position_after?: number | null;
          notes?: string | null;
        };
      };
      control_log: {
        Row: {
          id: number;
          session_id: number;
          timestamp: string;
          race_time: string | null;
          lap_number: number | null;
          entry_type: string | null;
          car_number: string | null;
          flag_type: string | null;
          penalty_code: string | null;
          penalty_description: string | null;
          message: string | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          timestamp: string;
          race_time?: string | null;
          lap_number?: number | null;
          entry_type?: string | null;
          car_number?: string | null;
          flag_type?: string | null;
          penalty_code?: string | null;
          penalty_description?: string | null;
          message?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
        Update: {
          message?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
      };
      strategy_notes: {
        Row: {
          id: number;
          session_id: number;
          lap_number: number | null;
          race_time: string | null;
          car_number: string | null;
          note_type: string | null;
          note_text: string;
          importance: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          session_id: number;
          lap_number?: number | null;
          race_time?: string | null;
          car_number?: string | null;
          note_type?: string | null;
          note_text: string;
          importance?: string;
        };
        Update: {
          lap_number?: number | null;
          note_text?: string;
          importance?: string;
        };
      };
      sync_status: {
        Row: {
          id: number;
          entity_type: string;
          entity_id: string;
          last_synced_at: string;
          sync_source: string | null;
          status: string;
          error_message: string | null;
        };
        Insert: {
          id?: number;
          entity_type: string;
          entity_id: string;
          last_synced_at?: string;
          sync_source?: string | null;
          status?: string;
          error_message?: string | null;
        };
        Update: {
          last_synced_at?: string;
          status?: string;
          error_message?: string | null;
        };
      };
    };
    Views: {
      race_results: {
        Row: {
          event_name: string;
          session_name: string;
          position: number | null;
          car_number: string;
          team_name: string | null;
          class_name: string | null;
          total_laps: number | null;
          best_lap_time_ms: number | null;
          total_pit_stops: number | null;
          status: string | null;
        };
      };
      lap_analysis: {
        Row: {
          session_id: number;
          car_number: string;
          total_laps: number;
          best_lap_ms: number | null;
          avg_lap_ms: number | null;
          median_lap_ms: number | null;
          green_flag_laps: number;
          best_green_lap_ms: number | null;
          avg_green_lap_ms: number | null;
        };
      };
    };
  };
}

