# Report SMS and tracking setup

## SMS confirmation

After a report is saved, the server sends one confirmation SMS to the submitted Indian mobile number. The message should say that the named person reported an issue on Gunupur Matters, include the report ID and the submission date/time in IST, and state that the report is Pending Review.

- `MSG91_AUTH_KEY`
- `MSG91_FLOW_TEMPLATE_ID`
- `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`)

Configure these as server-side environment variables in Vercel and redeploy. The MSG91 Flow template must be approved and map `VAR1` to the reporter name, `VAR2` to the report ID, and `VAR3` to the submission date/time. For example: `Dear {#var#}, you reported an issue on Gunupur Matters on {#var#}. Report ID: {#var#}. Status: Pending Review. We will update you after review. - Gunupur Matters`. Ensure the text and variables match the approved MSG91/DLT template. Never put provider or Supabase secret keys in browser code.

The report is saved even if SMS delivery fails; the submission page will say when the SMS was not sent. Check the Vercel Function logs for the reason. Confirm the MSG91 Flow template ID, recipient variable names, account balance, and applicable DLT/template approval before testing a real mobile number.

## Tracking and duplicate reports

Tracking works like before, with one addition: the reporter enters the report ID and name used when submitting. The browser calls one Supabase function, which returns report details only when both match. No PHP tracking endpoint or server key is needed for tracking.

The existing database trigger blocks duplicate submissions and returns the existing report ID. Run `reports.sql` and `duplicate-report-review-flow.sql` in the Supabase SQL Editor if they have not already been applied.

## Community activity feed

Run `events.sql` in the Supabase SQL Editor once to create the public activity feed, comments, photo bucket, and admin-only publishing policies. Admins can then publish a photo and caption from `adupload.html`; published updates appear on `events.html`.

## Deploy

Run `secure-report-tracking.sql` after the report SQL files, then deploy the updated site. Its insert trigger forces every new report to start as **Pending Review** regardless of the value sent by the browser; the status stays there until an admin changes it. The admin action defaults to **Review**. Configure the SMS server settings above separately. Vercel serves PHP files as static text rather than running them, so report SMS is sent by the `/api/send-report-sms` serverless function.
