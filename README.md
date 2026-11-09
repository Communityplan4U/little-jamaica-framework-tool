# Little Jamaica Planning Framework Tool

Community in Public's six-step community-priorities survey. Round 2 preserves the approved methodology and adds private response persistence.

## Current status

The dedicated **Little Jamaica Planning Framework Survey** Supabase project is active, and the Vercel Round 2 preview now saves real test responses. The existing mapping database is unchanged. This is not the public launch.

GitHub development remains on `round-2`, with draft pull request #1. The production branch has not been merged or released. Use the newest Vercel preview for testing; older deployment URLs may use earlier configuration.

## Local preview

Requires Node 22 or newer; no runtime packages are needed.

```
npm ci --ignore-scripts
npm run check
npm start
```

The static local preview does not run server endpoints. Without a configured server, the UI reports that online saving is unavailable rather than claiming answers were received.

## Round 2 interface changes

- Optional, dark-text email field; blank addresses never block completion.
- Independent, unchecked newsletter and Little Jamaica planning-update permissions.
- Alphabetical starting themes; outcomes remain randomized once per response.
- No Your selections sidebar. Outcome details use See which topics are covered.
- Same-origin server endpoints for checkpoints and private return links.

## Frozen assessment

39 topics, seven comparators, five outcomes. The assessment data and model are unchanged. Group counts are 7/7/8/7/6/4 and collective shares are 40/35/11.23/8.56/3.21/2 percent (the middle shares retain full precision). Every topic receives its theme's full rank points. Outcome overlap uses the largest multiplier plus the second divided by 8 and the third divided by 16.

## Dedicated Supabase project

Project reference: `eumwsssqjliljbzxhsgc`, in Community in Public's existing organization, database region `ca-central-1`. Created under the approved free plan. No mapping-tool tables or settings were changed.

For a fresh setup:

1. Run `supabase/schema.sql`, then `supabase/activate-round2.sql`, as an administrator in the dedicated project.
2. Deploy `supabase/functions/survey-storage/index.ts` with JWT verification disabled. The gateway performs its own mandatory server-token authentication; it is not an unauthenticated database API.
3. Set server-only Vercel Preview variables `SUPABASE_URL`, `SURVEY_GATEWAY_TOKEN`, and `SURVEY_COLLECTION_MODE=test`. The gateway token must match the SHA256 digest configured in the Edge Function. Never put the token in Git or browser code.
4. Supabase's privileged database key remains inside its Edge Function runtime. The gateway allows only the three explicitly named survey RPC operations.
5. Redeploy the Vercel preview, then verify checkpoint saving, revision conflicts and private-link recovery.

The gateway currently rejects any attempt to write a public-mode response. Changing this for launch is an explicit Round 3 task.

## Storage and security

A random response ID is paired with a high-entropy capability token. Only its SHA256 hash is stored on the server. Knowing the response ID is not enough to read or change answers. A private return link places the token in the URL fragment, strips it immediately on opening, and sends it in an Authorization header.

Every Continue creates a versioned checkpoint. Duplicate requests are idempotent; conflicting and out-of-order revisions are rejected. The server recomputes topic weights from validated positions instead of trusting browser-supplied scores. First completion and pre-results snapshots remain available alongside later revisions.

Answers are stored in `survey_private.responses` and `survey_private.checkpoints`. Optional email and independent communication permissions are isolated in `contacts` and `contact_history`. All five private tables have RLS and no public/anonymous/authenticated grants. No RLS policies is intentional deny-by-default here; all persistence functions are SECURITY INVOKER and executable only by the server role.

The response ID is not proof of a unique person. Another browser can create another response. No fingerprinting is used. Return links should be kept private because possession grants access to that response.

## Consent and communication

Providing an email requests survey results and final voting-result updates. The two checkboxes separately record newsletter and broader Little Jamaica planning updates. Clearing email clears effective communication permissions. The app records these choices; it does not send email or subscribe people to a mailing platform.

## Verification

Seventeen live integration checks passed against the Vercel handlers and Supabase storage: blank-email saving, idempotent retries, pre-results preservation, completion, results viewing, later revisions, private-link restoration, independent contact permissions, contact separation, wrong/missing-token rejection, another response's isolation, stale-revision rejection, invalid-topic rejection, cross-site rejection and gateway authentication.

Database readback confirmed five checkpoints for a five-event test response, three separate contact-history versions, preserved original and revised snapshots, the approved group sizes, and weights summing to one within floating-point precision. Synthetic activation responses are removed after verification. This verification is distinct from the earlier local interface and calculation tests; a final participant usability check remains useful.

## Reporting and Round 3

Authorized administrators can use `supabase/reporting.sql` and export query results for Excel. Live community averages, an authenticated administrator dashboard, final retention/editing rules, email delivery and public launch remain Round 3 work. Never include test data in public community averages.
