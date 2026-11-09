-- Round 3: publish provisional community averages from the first completed response.
-- Private completed-response authorization is enforced in api/community.js.
-- Applied to the dedicated Little Jamaica Supabase project; Mapping-project unaffected.
BEGIN;
ALTER TABLE survey_private.controls DROP CONSTRAINT IF EXISTS controls_minimum_responses_check;
ALTER TABLE survey_private.controls ADD CONSTRAINT controls_minimum_responses_check CHECK (minimum_responses >= 1);
UPDATE survey_private.controls SET minimum_responses=1
WHERE source_version='ljov-20261109-seven-comparators-40-35-v4'
AND collection_mode IN ('test','public');
CREATE OR REPLACE FUNCTION public.ljov_community_average(p_source text, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare n integer;minimum_n integer;tw jsonb;tr jsonb;outr jsonb;
begin
 if p_mode not in('test','public') then raise exception 'Invalid mode';end if;
 select minimum_responses into minimum_n from survey_private.controls where source_version=p_source and collection_mode=p_mode;
 minimum_n:=greatest(coalesce(minimum_n,1),1);
 select count(*) into n from survey_private.responses where source_version=p_source and collection_mode=p_mode and first_completed_at is not null and latest_completed_snapshot is not null;
 if n<minimum_n then return jsonb_build_object('available',false,'count',n,'minimum',minimum_n,'sourceVersion',p_source);end if;
 select jsonb_object_agg(code,weight) into tw from (select x->>'code' as code,avg((x->>'weight')::numeric) as weight from survey_private.responses r cross join lateral jsonb_array_elements(r.latest_completed_snapshot->'topicWeights') x where r.source_version=p_source and r.collection_mode=p_mode and r.first_completed_at is not null group by x->>'code') t;
 select jsonb_object_agg(label,rank) into tr from (select x.label,avg(x.ord) as rank from survey_private.responses r cross join lateral jsonb_array_elements_text(r.latest_completed_snapshot->'themeRanking') with ordinality x(label,ord) where r.source_version=p_source and r.collection_mode=p_mode and r.first_completed_at is not null group by x.label) t;
 select jsonb_object_agg(label,rank) into outr from (select x.label,avg(x.ord) as rank from survey_private.responses r cross join lateral jsonb_array_elements_text(r.latest_completed_snapshot->'outcomeRanking') with ordinality x(label,ord) where r.source_version=p_source and r.collection_mode=p_mode and r.first_completed_at is not null group by x.label) t;
 return jsonb_build_object('available',true,'count',n,'minimum',minimum_n,'sourceVersion',p_source,'topicWeights',tw,'themeRanks',tr,'outcomeRanks',outr,'updatedAt',now());
end;$function$;
COMMIT;
