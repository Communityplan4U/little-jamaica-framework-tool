# Little Jamaica Planning Framework Tool

Community in Public's six-step community-priorities survey. Round 2 preserves the approved methodology and adds private response persistence.

## Local preview

Requires Node 22 or newer; no runtime packages are needed.

```
npm ci --ignore-scripts
npm run check
npm start
```

The UI works without database configuration. It reports that online saving is unavailable instead of claiming answers were received.

## Round 2 changes

- Optional, dark-text email field; blank addresses never block completion.
- Independent, unchecked newsletter and Little Jamaica planning-update permissions.
- Alphabetical starting order for themes; outcomes remain randomized once per response.
- No Your selections sidebar. Outcome details use See which topics are covered.
- Same-origin server endpoints for checkpoints and private return links.
- Server-side validation and calculation; private contact records and consent history.

## Frozen assessment

39 topics, seven comparators, five outcomes. The original data and model are unchanged. Group counts are 7/7/8/7/6/4 and collective shares are 40/35/11.23/8.56/3.21/2 percent. Every topic receives its theme's full rank points. Outcome overlap uses the largest multiplier plus the second divided by 8 and the third divided by 16.

## Dedicated Supabase project -- provisioning pending

Create a separate Little Jamaica project in the Community in Public organization, not in the existing mapping database. The connector quoted $0/month but requires explicit approval before creation.

1. Run `supabase/schema.sql` as an administrator in the dedicated project.
2. Run the privilege checks in `supabase/reporting.sql` and Supabase security advisors.
3. Configure `SUPABASE_URL` and a server-only `SUPABASE_SECRET_KEY` in the Vercel project settings, never in Git or client code.
4. Keep `SURVEY_COLLECTION_MODE=test` for this round. Preview deployments always record test responses.
5. Redeploy and test saves, retries, two-device resume, revoked access, completion and revisions against the live database.

No live database verification has been completed while creation awaits approval. Do not invite public participation yet.

## Storage and security

A random response ID is paired with a high-entropy capability token. Only its SHA256 hash is stored on the server. Knowing the response ID is not enough to read or change answers. A private return link places the token in the URL fragment, strips it immediately on opening, and sends it in an Authorization header.

Every Continue creates a versioned checkpoint. Duplicate requests are idempotent; conflicting and out-of-order revisions are rejected. The server recomputes topic weights from validated positions instead of trusting browser-supplied scores. First completion and pre-results snapshots remain available alongside later revisions.

Survey answers are stored in `survey_private.responses` and `survey_private.checkpoints`. Optional emails and independent permissions are isolated in `contacts` and `contact_history`. Private tables have RLS and no public/anonymous/authenticated grants. All persistence functions are SECURITY INVOKER and executable only by the server role.

The response ID is not proof of a unique person. A person using another browser can create another response. No fingerprinting is used. Return links should be kept private because possession grants access to that response.

## Consent and communication

Providing an email requests survey results and final voting-result updates. The two checkboxes separately record newsletter and broader Little Jamaica planning updates. Clearing email clears effective communication permissions. The app stores these choices; it does not send email or subscribe people to a third-party mailing platform.

## Reporting and Round 3

`supabase/reporting.sql` provides administrator-only queries that can be exported to CSV/Excel. Live community averages, an authenticated administrator dashboard, retention decisions, stronger abuse controls and public launch remain Round 3 work. Never include test data in public community averages.

## Source and testing

Assessment data, the model, UI, server functions and SQL are separate files. Automated tests cover the approved calculation fixtures, all 1,482 insertion moves, all 120 outcome permutations, optional email and consent validation, and isolation of contact data. Live database and deployment checks must be reported separately from local tests.
