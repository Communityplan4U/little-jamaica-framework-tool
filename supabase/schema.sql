-- Dedicated Little Jamaica project only. Do not apply to the mapping project.
begin;
create schema if not exists survey_private;
revoke all on schema survey_private from public,anon,authenticated;
grant usage on schema survey_private to service_role;
create table if not exists survey_private.responses(
 id uuid primary key,token_hash text not null check(length(token_hash)=64),
 source_version text not null,survey_version text not null,collection_mode text not null check(collection_mode in ('test','public')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 last_revision integer not null default 0,answer_revision integer not null default 0,
 status text not null default 'in_progress' check(status in ('in_progress','completed','edited_after_completion')),
 first_completed_at timestamptz,last_completed_at timestamptz,first_results_at timestamptz,
 latest_event jsonb not null default '{}'::jsonb,pre_results_snapshot jsonb,first_completed_snapshot jsonb,latest_completed_snapshot jsonb
);
create table if not exists survey_private.checkpoints(
 event_id uuid primary key,response_id uuid not null references survey_private.responses(id) on delete cascade,
 revision integer not null,received_at timestamptz not null default now(),event_type text not null,
 after_results_shown boolean not null,event_data jsonb not null,unique(response_id,revision)
);
create table if not exists survey_private.contacts(
 response_id uuid primary key references survey_private.responses(id) on delete cascade,
 email text,results_updates boolean not null default false,newsletter boolean not null default false,
 planning_updates boolean not null default false,notice_version text not null,updated_at timestamptz not null default now()
);
create table if not exists survey_private.contact_history(
 id bigint generated always as identity primary key,response_id uuid not null references survey_private.responses(id) on delete cascade,
 event_id uuid not null references survey_private.checkpoints(event_id) on delete cascade,
 preferences jsonb not null,received_at timestamptz not null default now()
);
create table if not exists survey_private.request_buckets(bucket_key text primary key,request_count integer not null default 1,created_at timestamptz not null default now());
alter table survey_private.responses enable row level security;
alter table survey_private.checkpoints enable row level security;
alter table survey_private.contacts enable row level security;
alter table survey_private.contact_history enable row level security;
alter table survey_private.request_buckets enable row level security;
revoke all on all tables in schema survey_private from public,anon,authenticated;
grant select,insert,update,delete on all tables in schema survey_private to service_role;
grant usage,select on all sequences in schema survey_private to service_role;
create index if not exists responses_completed on survey_private.responses(source_version,collection_mode,first_completed_at);
create index if not exists checkpoints_response_time on survey_private.checkpoints(response_id,received_at);
create or replace function public.ljov_check_rate(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if length(p_key)<>64 then raise exception 'Invalid rate key'; end if;
 insert into survey_private.request_buckets(bucket_key) values(p_key) on conflict(bucket_key) do update set request_count=survey_private.request_buckets.request_count+1 returning request_count into n;
 delete from survey_private.request_buckets where created_at<now()-interval '2 hours';return n<=600;
end;$$;
create or replace function public.ljov_save_checkpoint(p_token_hash text,p_event jsonb,p_contact jsonb,p_mode text,p_core_completed boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r survey_private.responses;old_event survey_private.checkpoints;old_contact jsonb;
 rid uuid:=(p_event->>'responseId')::uuid;eid uuid:=(p_event->>'eventId')::uuid;rev integer:=(p_event->>'revision')::integer;
 event_type text:=p_event->>'eventType';is_complete boolean:=event_type='complete';new_status text;receipt_time timestamptz:=clock_timestamp();
begin
 if length(p_token_hash)<>64 or p_mode not in('test','public') then raise exception 'Invalid request';end if;
 if not exists(select 1 from survey_private.responses where id=rid) then
  if rev<>1 then raise exception 'Initial checkpoint missing' using errcode='40001';end if;
  insert into survey_private.responses(id,token_hash,source_version,survey_version,collection_mode) values(rid,p_token_hash,p_event->>'sourceVersion',p_event->>'surveyVersion',p_mode) on conflict do nothing;
 end if;
 select * into r from survey_private.responses where id=rid for update;
 if r.token_hash<>p_token_hash then raise exception 'Unauthorized' using errcode='42501';end if;
 if r.source_version<>p_event->>'sourceVersion' or r.collection_mode<>p_mode then raise exception 'Version mismatch' using errcode='40001';end if;
 select * into old_event from survey_private.checkpoints where event_id=eid;
 if found then
  if old_event.response_id<>rid or old_event.revision<>rev or old_event.event_data<>p_event then raise exception 'Conflicting duplicate' using errcode='23505';end if;
  return jsonb_build_object('eventId',eid,'receivedAt',old_event.received_at,'revision',rev,'duplicate',true);
 end if;
 if rev<>r.last_revision+1 then raise exception 'Revision conflict' using errcode='40001';end if;
 if is_complete and not p_core_completed then raise exception 'Incomplete survey';end if;
 if (p_event->>'answerRevision')::integer<r.answer_revision then raise exception 'Answer revision conflict' using errcode='40001';end if;
 new_status:=case when is_complete then 'completed' when r.first_completed_at is not null and (p_event->>'answerRevision')::integer>r.answer_revision then 'edited_after_completion' else r.status end;
 insert into survey_private.checkpoints(event_id,response_id,revision,received_at,event_type,after_results_shown,event_data) values(eid,rid,rev,receipt_time,event_type,(p_event->>'afterResultsShown')::boolean,p_event);
 select jsonb_build_object('email',c.email,'results_updates',c.results_updates,'newsletter',c.newsletter,'planning_updates',c.planning_updates,'notice_version',c.notice_version) into old_contact from survey_private.contacts c where c.response_id=rid;
 if old_contact is distinct from p_contact then
  insert into survey_private.contacts(response_id,email,results_updates,newsletter,planning_updates,notice_version,updated_at) values(rid,p_contact->>'email',coalesce((p_contact->>'results_updates')::boolean,false),coalesce((p_contact->>'newsletter')::boolean,false),coalesce((p_contact->>'planning_updates')::boolean,false),p_contact->>'notice_version',receipt_time)
  on conflict(response_id) do update set email=excluded.email,results_updates=excluded.results_updates,newsletter=excluded.newsletter,planning_updates=excluded.planning_updates,notice_version=excluded.notice_version,updated_at=excluded.updated_at;
  insert into survey_private.contact_history(response_id,event_id,preferences,received_at)values(rid,eid,p_contact,receipt_time);
 end if;
 update survey_private.responses set last_revision=rev,answer_revision=(p_event->>'answerRevision')::integer,updated_at=receipt_time,status=new_status,latest_event=p_event,
 first_results_at=case when event_type='results_viewed' then coalesce(first_results_at,receipt_time) else first_results_at end,
 pre_results_snapshot=case when event_type='before_first_results' then coalesce(pre_results_snapshot,p_event->'snapshot') else pre_results_snapshot end,
 first_completed_at=case when is_complete then coalesce(first_completed_at,receipt_time) else first_completed_at end,
 last_completed_at=case when is_complete then receipt_time else last_completed_at end,
 first_completed_snapshot=case when is_complete then coalesce(first_completed_snapshot,p_event->'snapshot') else first_completed_snapshot end,
 latest_completed_snapshot=case when is_complete or(first_completed_at is not null and p_core_completed) then p_event->'snapshot' else latest_completed_snapshot end where id=rid;
 return jsonb_build_object('eventId',eid,'receivedAt',receipt_time,'revision',rev,'status',new_status);
end;$$;
create or replace function public.ljov_resume_response(p_response_id uuid,p_token_hash text,p_source_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r survey_private.responses;c survey_private.contacts;restored jsonb;
begin
 select * into r from survey_private.responses where id=p_response_id;
 if not found or r.token_hash<>p_token_hash or r.source_version<>p_source_version then raise exception 'Unauthorized' using errcode='42501';end if;
 select * into c from survey_private.contacts where response_id=p_response_id;
 restored:=(r.latest_event->'resumeState')||jsonb_build_object('email',coalesce(c.email,''),'newsletterOptIn',coalesce(c.newsletter,false),'planningOptIn',coalesce(c.planning_updates,false));
 return jsonb_build_object('sourceVersion',r.source_version,'createdAt',r.created_at,'updatedAt',r.updated_at,'revision',r.last_revision,'answerRevision',r.answer_revision,'status',r.status,'firstCompletedAt',r.first_completed_at,'lastCompletedAt',r.last_completed_at,'firstResultsAt',r.first_results_at,'preResultsSnapshot',r.pre_results_snapshot,'resumeState',restored,'visitedPages',r.latest_event->'visitedPages','continuedPages',r.latest_event->'continuedPages','reviewedPage3Groups',r.latest_event#>'{snapshot,inputEvidence,page3GroupsReviewed}','initialDisplayOrder',r.latest_event->'initialDisplayOrder');
end;$$;
revoke all on function public.ljov_check_rate(text) from public,anon,authenticated;
revoke all on function public.ljov_save_checkpoint(text,jsonb,jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.ljov_resume_response(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ljov_check_rate(text) to service_role;
grant execute on function public.ljov_save_checkpoint(text,jsonb,jsonb,text,boolean) to service_role;
grant execute on function public.ljov_resume_response(uuid,text,text) to service_role;
commit;
