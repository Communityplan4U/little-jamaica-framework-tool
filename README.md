# Little Jamaica Planning Framework Weighting Tool

Community in Public's six-page survey of planning priorities. The approved assessment methodology remains: **39 topics, seven comparator plans, five community outcomes**, and group counts **7 / 7 / 8 / 7 / 6 / 4** with collective shares **40% / 35% / 11.23% / 8.56% / 3.21% / 2%**.

## Round 3 preview

- The protected Vercel preview connects to the dedicated Little Jamaica Supabase project. Test records stay separate from future public records.
- Each Continue saves a checkpoint; optional email and two independent communication opt-ins remain in private contact records.
- Participants may reopen their saved response via its private link and revise it before survey closure.
- The **database** already enforces the closing date: **January 15, 2027**, end of day in Toronto (**January 16 at 00:00 EST / 05:00 UTC**).
- Page 6 compares individual weights with averages once the first completed response is available in the same collection mode.
- There is no separate web administrator login. View individual answers with your existing Supabase account, under the private `survey_private` schema. See [Supabase results guide](docs/SUPABASE_RESULTS_GUIDE.md) and [read-only queries](supabase/owner_queries.sql).
- Website visitors cannot access individual records via the public API; however, anyone granted sufficiently privileged Supabase project access could. Verify organization membership before launch.
- The public survey is still **in draft mode**. The preview is for review/testing only. No automated emails are sent.

## Services

GitHub: `Communityplan4U/little-jamaica-framework-tool`  
Vercel: `little-jamaica-framework-tool`  
Supabase: dedicated project `eumwsssqjliljbzxhsgc` (Canada Central).  
**Do not alter the separate Mapping-project database.**

## Development

```bash
npm ci --ignore-scripts
npm run check
npm start
```

Keep server-to-server gateway credentials in Vercel preview environment variables, not the browser or repository. The Supabase `survey-storage` Edge Function uses a restricted operation allowlist and only accepts authenticated gateway calls. The current gateway is test-only. Before the public launch, establish a distinct production gateway credential, verify backups, accessibility, consent language, and publish a reviewed production build with explicit launch approval.

The project contact for this survey is **Cheryll.Case@CPplanning.ca**; this does not create a new login.

### Community comparisons from the first completion

The response-average threshold is **1**, not 5. Page 6 requests the aggregate using the participant's completed private response link, so unauthenticated visitors cannot query it. Each comparison displays the completed-response count and notes that early figures may reflect an individual's preferences. Low sample sizes can still permit inference of individual choices; this tradeoff must be considered when promoting the survey.

**Email delivery remains manual.** Results and consent preferences may be exported from Supabase by the project owner. The application does not send emails or subscribe anyone to mailing lists.
