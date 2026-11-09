# Little Jamaica Planning Framework — Community Priorities Survey

**Published:** https://little-jamaica-framework-tool-community-in-public.vercel.app/

Community in Public's community-led evaluation tool, based on the user's consolidated **33-topic** assessment workbook. Participants rank seven planning themes and five community outcomes, review their **ten suggested highest** priorities, move any suggested topics into the middle, and choose **four lowest** priorities from the middle, and then compare planning documents and community averages.

## The approved weighting method

| Group | Topics | Weight of group | Weight per topic |
|---|---:|---:|---:|
| Highest | 10 | 60% | 6% |
| Middle | 19 | 37% | 37/19% (approx. 1.9474%) |
| Lowest | 4 | 3% | 0.75% |

Theme and outcome rankings generate the **suggested ten highest topics**. Participants may demote any suggested topic to the middle; the next eligible topic automatically fills the highest group. From the resulting middle list, participants select four topics for the lowest group. The final groups remain fixed at 10/19/4. Ties in the suggestions are alphabetical by topic code, not workbook row position. The nineteen topics outside the highest and lowest groups receive equal middle-group weight.

The source is `LJOVPF_Comparator_Assessment.xlsx`, using `Topics`, `Comparison by Topic` and `LJOVPF by Topic` sheets. Seven comparators are: Chinatown Tomorrow, Picture Mount Dennis, Mount Dennis Community for All, St. Clair Avenue West and Bathurst Street, Bloor Street, Yonge-St. Clair, and Port Lands. Scores are evidence-based documentary ratings from 1 to 5, not verified implementation outcomes.

## Participant experience

1. Drag and drop the seven planning themes into rank order (arrow buttons are available for keyboard and touch), and optionally share an email/contact preferences.
2. Rank five outcomes, which inform topic suggestions.
3. Review ten automatically suggested highest-priority topics, moving any down to the middle (which promotes the next eligible suggestion).
4. From the middle list, choose exactly four topics to move into the lowest group (the other 19 stay in the middle).
5. Compare the seven planning frameworks with the Little Jamaica draft.
6. Compare the participant's priorities with community averages after at least one completed response.

Each completed response receives a private return link, which allows revision until the database-enforced deadline **January 15, 2027 at 11:59 p.m. Toronto time**. The server closes new changes at midnight January 16 Toronto time. No account or email is needed to participate. Email updates are **manual only**; they are not sent automatically.

Community averages are visible only through the private link of a completed participant, from the first completed response. At very low counts, an average may reveal a person's priorities; the survey informs participants of this limitation.

## Public website embedding

Use the GoDaddy HTML embed component:

```html
<iframe
  src="https://little-jamaica-framework-tool-community-in-public.vercel.app/"
  title="Little Jamaica community priorities survey"
  width="100%"
  height="1100"
  loading="lazy"
  style="width:100%;min-height:1100px;border:0;"
></iframe>
```

Or link directly to the published URL. Vercel Content-Security-Policy permits framing by `communityinpublic.ca`, `www.communityinpublic.ca`, `crcd.to`, and `www.crcd.to`.

## Secure storage and privacy

Supabase dedicated Little Jamaica project: `eumwsssqjliljbzxhsgc` (Canada Central). The Mapping-project database is untouched.

Public and testing environments use **separate server-only tokens and response cohorts**. A new source-version ID segregates the current 33-topic methodology from all previous 39-topic survey answers. Private response records and optional contact information remain separate in the database. The public site does not have an administrative API to list individual responses.

**Direct access to individual responses:** log into the existing [Supabase dashboard](https://supabase.com/dashboard/project/eumwsssqjliljbzxhsgc) and use private views `survey_private.v_responses`, `survey_private.v_topic_weights`, `survey_private.v_participation` or the SQL Editor. Check your organization's Team Members to ensure only authorized people have access; Supabase owners and sufficiently privileged collaborators may access project data. Enable MFA.

## Maintainers

- `main`: the published site
- `data/assessment.json`: 33-topic workbook-derived rubric and scores
- `data/methodology.json`: fixed weighting rules, unique methodology ID, theme/outcome ranking parameters
- `server/survey.cjs`: authoritative validation and server-recalculated weights
- `public/js/`: participant experience; no server credentials
- `api/`: same-origin storage, resume, status and completed-only aggregate endpoints
- `supabase/functions/survey-storage/index.ts`: tightly allowlisted credential-scoped storage gateway

To validate: `npm ci --ignore-scripts && npm run check`.

### Updated weight distribution (November 9, 2026)

Before the first recorded public submission, the weights were revised from 50% / 47% / 3% to **60% / 37% / 3%**, retaining the 10 / 19 / 4 allocation. The survey source version is `ljov-20261109-33top10-bottom4-60-37-3-v2`; drafts created on a previous version start a new response rather than mixing incompatible weights. The previous source version remains separately recorded and closed to further public submissions.
