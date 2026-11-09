# Review Little Jamaica survey results in Supabase

There is **no separate survey administrator login**. Use your existing Supabase account and open the [Little Jamaica Planning Framework Survey project](https://supabase.com/dashboard/project/eumwsssqjliljbzxhsgc). Do not use Mapping-project.

From **Table Editor**, choose schema `survey_private`. Open `v_responses` for each response, optional contact information, comments and theme/outcome rankings; `v_topic_weights` for the 39 topic weights and positions; or `v_participation` for aggregate completion counts. Alternatively use the SQL Editor queries in `supabase/owner_queries.sql` and export to CSV.

**Exclusivity requires membership review:** Platform owners and sufficiently privileged Supabase collaborators may also see private responses. Review **Organization settings → Team Members**, and ensure no one else has access. Enable MFA on your existing account. Cheryll.Case@CPplanning.ca is the project contact, not a new account.

**Closing date:** January 15, 2027, end of day in Toronto. The database rejects writes from January 16 at 00:00 EST (`2027-01-16T05:00:00Z`). Private return links then become read-only. The test survey remains open; public collection stays in draft until launch approval.

Email is optional. Newsletter and Little Jamaica updates use separate unchecked permissions. No email sending is active.

The public Page 6 endpoint exposes only aggregate results after at least five completed responses. Test responses are excluded from the public average.
