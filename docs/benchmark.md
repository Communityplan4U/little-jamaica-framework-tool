# Planning benchmark dashboard

The dashboard is available at `/benchmark/` after `npm run build`.

It is an additional read-only view of the public assessments. It does not submit survey answers, call respondent APIs, read private links or require new database tables. All dashboard interactions run in the browser. No new package dependencies are required.

## Source of truth and rebuild

- Framework ratings and methodology remain in `data/assessment.json` and `data/methodology.json`. `scripts/benchmark-data.mjs` evaluates the existing `public/js/state.js` and `public/js/model.js` to preserve the exact starting priorities and default scores. Source document, ward and division metadata come from the existing public app module.
- The TOR assessment is a public-source snapshot in `data/benchmark/tor-assessment.json` and `tor-methodology.json`, retrieved from [Communityplan4U/LJOVPF-SAC_TOR](https://github.com/Communityplan4U/LJOVPF-SAC_TOR), source revision `ed4897c7120e944c9fa78ff3ec05d86d9fe84de1`. Assessment revision: `tor12-approved-20261122-120rows`. Preserve the 120 approved evidence judgments when updating this snapshot.
- `data/benchmark/councillors.json` contains the portrait directory, source and credit URLs, current and historical assignments, source links, historical ward overrides and uncertainty notes. Local assets are in `public/benchmark/assets/portraits/`.
- `data/benchmark/document-stages.json` identifies the exact assessed Framework document versions and relevant decision records. It distinguishes adoption, endorsement, a final consultant study, and an earlier framework version.
- The build emits `dist/benchmark/dashboard-data.js` and `councillors.js`. Do not hand-edit those generated files.

The dashboard reads no live survey aggregates. “Survey defaults” means the existing Framework tool's starting priorities. It is not an estimate of current respondents' average choices.

## Scores

Framework criteria retain their 1–5 ratings. Each of the 20 public topics receives its own weight, divided equally among the linked detailed criteria. The displayed chart score is the weighted comparator rating minus the weighted Little Jamaica rating. The default full-document view compares full comparator documents against Little Jamaica's working draft vision; the visible scope note explains this asymmetry. The vision-only view is also available.

TOR criterion judgments remain signed comparisons: +1, 0 or −1. The displayed total is 12 times the weighted sum. Approved category weights are G1 30%, G2 25%, G3 20%, G5 15%, G4 10%. Little Jamaica is a zero reference, not an absolute quality rating. Framework and TOR use different scales.

Equal Framework weighting means 5% for each public topic. Equal TOR weighting means 20% for each governance area. Custom weights can be adjusted and normalized. Selecting a single area renormalizes its included criteria to 100%. Category contributions sum to the displayed score before rounding. Search and document-status filters do not change scores. Little Jamaica remains pinned as the reference when matching comparators are shown.

## Representation and document limitations

“During the study” means the documented study or committee period, not necessarily the exact issue date of every TOR. Exact issue dates for the supplied LJOV and Weston TORs were not established; profile notes preserve that limitation. The current view identifies current representatives for the same wards and does not assign earlier actions to new councillors. Canada Square shows all three wards explicitly included by its TOR. The Seniors Accountability Table is citywide and has no arbitrary councillor portrait.

Yonge–St. Clair's assessed source is the December 2019 original attachment. A revised January 2020 attachment exists. The dashboard retains the original scored source and does not label it as the final endorsed revision. St. Clair–Bathurst was adopted under Community Council's delegated final authority and is labelled accordingly.

Framework machine-readable sources provide ratings and criterion definitions, not per-criterion evidence quotations or page references. The UI describes these as assessment criteria. TOR entries include approved provision summaries, rationales and source sections; summaries are not represented as verbatim quotations.

## Interactions and exports

The dashboard includes Framework/TOR tabs, search, area and document-status filters, sorting, historical/current representation, source links, criterion detail, weighting controls, a methodology dialog, shareable URL state, PNG export and CSV export. No data is written to the server.

CSV export includes the active area, exact normalized criterion weights, document URLs and a reproducible view URL. PNG export states the active area and whether weights are normalized for an area-only comparison, the selected weighting and representation mode, scope caveats, and portrait credits.

## Verification

Run `npm run build` for syntax checks, the existing survey tests and eight benchmark tests, followed by static generation. The benchmark tests verify parity for every Framework document in both scopes and all eleven approved TOR totals; equal/custom weighting, category normalization, source immutability and malformed-input handling are covered.

Browser checks performed at desktop width and a 390-pixel mobile iframe: tabs, study selection, search by councillor, current representation, area filters, equal/default weights, evidence disclosure, PNG and CSV downloads. The mobile page has no page-level horizontal overflow; chart and evidence tables scroll within their own containers. PNG exports were visually inspected; the CSV's columns and reproducible links were checked.

## Branding and portrait sources

The Community in Public logo is from [the organization's website asset](https://img1.wsimg.com/isteam/ip/4cd413b4-f4ee-4988-bacf-4d6dd233bf9a/newlogo-square-3.png). Individual portrait credit and source URLs are retained in the directory and visible in the methodology dialog. Most portraits are from the City of Toronto or City Archives; the Mike Layton image is credited to Hoovy Boovy / Wikimedia Commons, CC0 1.0.


## Councillor leaderboard (portfolio method v1)

`/benchmark/` now ranks historical study-period councillors by their weighted portfolios. The original study comparison and its source evidence remain at `/benchmark/studies.html`. No source assessment ratings are changed. Starting weights are 66% for the latest study and 34% divided equally among older studies; a single study starts at 100%. Tied latest dates share the latest allocation (all-tied portfolios start equal). Divide every starting weight by its count of associated study-period councillors, then normalize to 100% within the portfolio. A single-project portfolio retains the original score. Citywide bodies without local representation are excluded. Study-period recency ordering is explicit in `portfolio.js`; Little Jamaica and Weston TOR exact issue dates remain unconfirmed. Search does not alter rank or score. Framework and TOR remain separate, use existing assessment scoring, and retain scope and assessment weights. Exports and per-project details disclose the starting, divided and normalized weights. Awards rank each assessment area with the same portfolio method and recognize all ties. This is a documentary association, not evidence of a councillor’s individual performance or contribution.
