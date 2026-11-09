-- Run only in the authenticated SQL editor; export query results as CSV.
select id,created_at,updated_at,collection_mode,status,last_revision,first_completed_at,
 latest_event#>'{snapshot,themeRanking}' as theme_ranking,latest_event#>'{snapshot,outcomeRanking}' as outcome_ranking,
 latest_event#>'{snapshot,topicWeights}' as topic_weights,latest_event#>>'{snapshot,notes}' as comments
from survey_private.responses order by created_at desc;
-- Private email permissions: do not include in public reports.
select c.response_id,c.email,c.results_updates,c.newsletter,c.planning_updates,c.notice_version,c.updated_at,r.collection_mode
from survey_private.contacts c join survey_private.responses r on r.id=c.response_id where c.email is not null order by c.updated_at desc;
-- All values should be false.
select has_schema_privilege('anon','survey_private','USAGE') as anonymous_schema_access,
 has_function_privilege('anon','public.ljov_save_checkpoint(text,jsonb,jsonb,text,boolean)','EXECUTE') as anonymous_save_access,
 has_function_privilege('authenticated','public.ljov_resume_response(uuid,text,text)','EXECUTE') as authenticated_resume_access;
