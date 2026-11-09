-- Apply after schema.sql. Re-runnable activation hardening; no participant rows are changed.
begin;
do $activation$
declare definition text;
begin
 select pg_get_functiondef('public.ljov_check_rate(text)'::regprocedure) into definition;
 definition:=replace(definition,'if length(p_key)<>64 then','if p_key is null or p_key !~ ''^[a-f0-9]{64}$'' then');
 execute definition;
 select pg_get_functiondef('public.ljov_save_checkpoint(text,jsonb,jsonb,text,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'if length(p_token_hash)<>64 or p_mode not in','if p_token_hash is null or p_token_hash !~ ''^[a-f0-9]{64}$'' or p_mode is null or p_mode not in');
 definition:=replace(definition,'if r.token_hash<>p_token_hash then','if r.token_hash is distinct from p_token_hash then');
 definition:=replace(definition,'if r.source_version<>p_event->>''sourceVersion'' or','if r.source_version is distinct from (p_event->>''sourceVersion'') or');
 -- A revision conflict is an application HTTP 409, not a retryable serialization failure.
 definition:=replace(definition,'''40001''','''PT409''');
 execute definition;
 select pg_get_functiondef('public.ljov_resume_response(uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'if not found or r.token_hash<>p_token_hash or r.source_version<>p_source_version then','if not found or p_token_hash is null or r.token_hash is distinct from p_token_hash or r.source_version is distinct from p_source_version then');
 execute definition;
end;
$activation$;
create index if not exists contact_history_response_idx on survey_private.contact_history(response_id);
create index if not exists contact_history_event_idx on survey_private.contact_history(event_id);
commit;
