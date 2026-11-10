# Little Jamaica Planning Framework — Community Priorities Survey

**Published production URL:** https://little-jamaica-framework-tool-community-in-public.vercel.app/

## Updated six-Planning-Area survey (development branch)

The public questionnaire now uses **20 survey topics** organized into **six Planning Areas** rather than the previous seven subjects and 33 survey choices. The original 33 detailed assessment criteria remain intact for evidence-based comparison of seven Toronto planning frameworks. This change does not replace the documentary ratings; it changes how people distribute relative importance.

The 20-to-33 crosswalk is encoded in `data/assessment.json`: each public topic has a stable `T01`–`T20` ID, a plain-language title and summary, one Planning Area, and one or more criterion IDs (`HR-`, `LW-`, `CB-`, `NE-`, `CP-`, `RJ-`). Every detailed criterion maps to exactly one survey topic. The authoritative workbook is `LJOVPF_Comparator_Assessment_Planning_Areas_Updated.xlsx`.

### Final priority allocation

| Group | Survey topics | Combined weight | Weight per topic |
|---|---:|---:|---:|
| Highest priority | 6 | 60% | **10.0000%** |
| Middle priority | 12 | 37% | **3.0833%** |
| Lowest priority | 2 | 3% | **1.5000%** |
| **Total** | **20** | **100%** | |

Each survey topic receives its assigned weight exactly once. When a topic contains multiple detailed criteria, its weight is split **equally across those criteria** (e.g. two criteria each receive half the topic weight). For each comparator, the topic score is the arithmetic mean of its criteria's unchanged 1–5 documentary ratings. The total is the weighted sum over the 20 public topics, mathematically equivalent to the weighted sum of all 33 criteria using their allocated within-topic shares.

### Planning Areas

1. Housing and remaining rooted — 4 survey topics; 7 detailed criteria.
2. Local economy and community wealth — 4 topics; 5 criteria.
3. Culture, history and belonging — 3 topics; 5 criteria.
4. Everyday needs and environment — 3 topics; 5 criteria.
5. Community power and implementation — 3 topics; 6 criteria.
6. Rights, recognition and reparative justice — 3 topics; 5 criteria.

### Participant flow

1. Rank the six Planning Areas, beginning with a qualitative interpretation of the October 21, 2026 Little Jamaica survey's five original action areas.
2. Rank six community outcomes. These outcomes are distinct from the Planning Areas.
3. Review six suggested highest-priority survey topics; demote or directly add other topics.
4. Choose two lowest-priority topics from the remaining fourteen; the other twelve remain middle priority.
5. Compare the seven City planning documents (vision statements or full documents) with the draft Little Jamaica vision. The six Planning Area and six community outcome breakdowns each sum to the overall difference.
6. Compare the participant's weights with the mean of responses collected under **the same methodology version**.

**Important distinction:** the 60% Planning Area / 40% community outcome blend is used **only to rank provisional topic suggestions**. The 60% / 37% / 3% pools determine **final document comparison weights**. Public topics spanning multiple outcomes receive a criterion-proportional share of each outcome for suggestion and aggregate comparisons; detailed outcome comparison scores are calculated directly from criterion-level ratings. Human rights and distinct Indigenous rights obligations apply regardless of participant priorities.

## Data structure and compatibility

For backward compatibility with the survey storage API, the internal fields `WB.themes`, `topic.theme`, `themeRanking`, `themeRankPoints`, `themeWeights`, and `initialDisplayOrder.themes` **retain their existing names**. They now represent the six Planning Areas, not the former seven planning subjects. Do not rename schema keys as a cosmetic change.

- `data/assessment.json`: 33 separately scored `topics` (detailed criteria) with new Planning Area IDs; 20 public `surveyTopics` with stable T IDs; six `themes`/Planning Areas.
- `data/methodology.json`: `topicCount=20`, `groupCounts=[6,12,2]`, `groupShares=[60,37,3]`, six Planning Area rank points, and the new unique source-version ID.
- `public/js/model.js`: ranks public topics, distributes weights, computes aggregate comparison and criterion-level breakdowns.
- `server/survey.cjs`: validates all choices and recalculates canonical 20-topic weights and comparator-independent source score.
- `api/community.js`: calculates outcome-weighted averages from 20 public topic weights and within-topic outcome proportions.
- `public/js/app.js`: six-step participant workflow; private return links; Step 5 reassignment and saved revisions.

A new `sourceVersion` and new browser storage prefix protect completed 33-topic responses from being reinterpreted. Existing private links remain tied to their original version and must not be silently converted. **Production collection status is controlled server-side** by a source-version + collection-mode record in the dedicated Supabase project. A new version must have a verified control before accepting submissions.

### Research and framing

The October 21, 2026 *Little Jamaica Survey Findings* recorded 258 engagements and ranked five action areas: Housing 25%, Governance 22%, Employment 19%, and Culture and Space 17% each among top-action selections. Those respondents did **not** directly rank these six Planning Areas or six outcomes. Initial order is a transparent, qualitative mapping only, and every participant may rearrange it.

Seven documentary comparators: Chinatown Tomorrow; Picture Mount Dennis; Mount Dennis Community for All; St. Clair Avenue West and Bathurst Street; Bloor Street; Yonge-St. Clair; Port Lands. Written-document ratings (1–5) are evidence assessments, **not verified implementation outcomes**.

## Survey privacy and operations

Storage uses the dedicated Supabase **Little Jamaica Planning Framework Survey** project in Canada Central. The separate Mapping-project database is not part of this survey. Public and preview collection modes, source versions, and response cohorts remain segregated; the server validates all reported weights and the private return-link token. Email contact and opt-ins remain optional and separate. The survey deadline is January 15, 2027 at 11:59 p.m. Toronto time, enforced by the database, not only by the browser. Email updates are manual only.

A public website embed may use:

```html
<iframe src="https://little-jamaica-framework-tool-community-in-public.vercel.app/"
  title="Little Jamaica community priorities survey" width="100%" height="1100"
  loading="lazy" style="width:100%;min-height:1100px;border:0;"></iframe>
```

## Validation

Run `npm ci --ignore-scripts && npm run check`. This validates both browser and API JavaScript, model/source consistency, user saving, response recovery and the Vercel build.

The earlier survey's methodology was `ljov-20261109-33top10-bottom4-60-37-3-six-outcomes-additive-60t-40o-v4`. **Do not combine averages or survey choices from this old methodology with the new 20-topic instrument**; the two questionnaires ask participants to prioritize different units.
