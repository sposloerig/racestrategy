-- Fix for foreign key constraints preventing lap caching
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/njociburjabxapevzvia/sql

-- Drop the foreign key constraint on laps table
ALTER TABLE laps DROP CONSTRAINT IF EXISTS laps_session_id_fkey;

-- Drop the foreign key constraint on session_entries table  
ALTER TABLE session_entries DROP CONSTRAINT IF EXISTS session_entries_session_id_fkey;

-- Verify - should show no foreign keys now
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('laps', 'session_entries');

