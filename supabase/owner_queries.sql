-- Read-only queries to run in the existing Supabase SQL Editor.
SELECT * FROM survey_private.v_participation ORDER BY collection_mode;
-- Public individual responses, including email/preferences:
SELECT * FROM survey_private.v_responses WHERE collection_mode='public' ORDER BY created_at DESC;
-- Topic rankings and assigned group shares:
SELECT * FROM survey_private.v_topic_weights WHERE collection_mode='public' ORDER BY response_id,rank_position;
-- Deadline and survey status in Toronto time:
SELECT collection_mode,state,closes_at,closes_at AT TIME ZONE 'America/Toronto' AS toronto_cutoff FROM survey_private.controls ORDER BY collection_mode;
-- Checkpoint history for a chosen response (replace UUID):
SELECT revision,event_type,received_at,event_data->'snapshot' AS answers FROM survey_private.checkpoints WHERE response_id='00000000-0000-0000-0000-000000000000'::uuid ORDER BY revision;
