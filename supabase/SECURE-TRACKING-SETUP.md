# Report SMS and tracking setup

## SMS confirmation

After a report is saved, the server sends one confirmation SMS containing the reporter name and report ID. To enable it, configure these server environment variables:

- `MSG91_AUTH_KEY`
- `MSG91_FLOW_TEMPLATE_ID`
- `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`)

The MSG91 Flow template must be approved and contain `VAR1` for the reporter name and `VAR2` for the report ID. Never put provider or Supabase secret keys in browser code.

## Tracking and duplicate reports

Tracking works like before, with one addition: the reporter enters the report ID and name used when submitting. The browser calls one Supabase function, which returns report details only when both match. No PHP tracking endpoint or server key is needed for tracking.

The existing database trigger blocks duplicate submissions and returns the existing report ID. Run `reports.sql` and `duplicate-report-review-flow.sql` in the Supabase SQL Editor if they have not already been applied.

## Deploy

Run `secure-report-tracking.sql` after the report SQL files, then deploy the updated site. Configure the SMS server settings above separately; the PHP server needs cURL for SMS delivery.
