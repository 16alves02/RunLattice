# Google OAuth setup

RunLattice supports Gmail **Send email** and Google Sheets **Read rows** and **Append rows**. Google Sheets uses the same Google OAuth connection as Gmail.

## 1. Configure Google Cloud

1. Create or select a Google Cloud project.
2. Enable both the **Gmail API** and **Google Sheets API**.
3. Configure the OAuth consent screen and add the Google accounts that will test the integration.
4. Create an OAuth client with application type **Web application**.
5. Add the exact RunLattice callback URL to **Authorized redirect URIs**:
   `https://YOUR-RUNLATTICE-HOST/api/integrations/google/callback`
6. Request the minimum scopes used by the current operations:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/spreadsheets`

The `gmail.send` scope is classified by Google as **sensitive**, so an external public app must complete Google's OAuth verification before broad production use. Because this implementation requests only a sensitive scope (not a restricted Gmail scope), Google's current guidance does not require the restricted-scope third-party security assessment. A testing consent screen is suitable only for configured test users; refresh tokens issued while an external app remains in testing can expire after seven days.

Official references:
- [Gmail API scope classifications](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google OAuth token lifetime and testing-mode behavior](https://developers.google.com/identity/protocols/oauth2)
- [Google OAuth verification requirements](https://support.google.com/cloud/answer/13463817)

## 2. Configure environment variables

Set the following variables on the **web service**:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` — must exactly match the authorized redirect URI in Google Cloud Console.
- `INTEGRATION_ENCRYPTION_KEY` — existing 32-byte base64 key used to encrypt OAuth state and tokens.
- `NEXT_PUBLIC_APP_URL` — the canonical HTTPS RunLattice origin.

Set these variables on the **worker service**:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `INTEGRATION_ENCRYPTION_KEY` — exactly the same encryption key as the web service.
- `DATABASE_URL` — same database as the web service.

Do not commit these values or send them in chat. Store them only in the hosting provider's environment-variable manager.

For local development, use:
```dotenv
GOOGLE_REDIRECT_URI="http://localhost:3000/api/integrations/google/callback"
```

## 3. Apply the database migration

The additive migration `20261112140000_add_google_oauth_state` creates short-lived, one-use OAuth state records. It also enables row-level security and denies access to Supabase `anon` and `authenticated` roles.

Apply migrations through the existing deployment/migration process after reviewing the migration. Do not manually create the table.

## 4. Connect an account

1. Sign in to RunLattice with a workspace owner/admin account and complete two-factor setup.
2. Open **Integrations → Gmail → Connect Google account**.
3. Complete Google's consent flow.
4. Return to Integrations and confirm the account appears under Workspace connections.
5. In Workflow Builder, select **Gmail · Send email**, **Google Sheets · Read rows**, or **Google Sheets · Append rows**. Choose the connected Google account and configure the operation. If the account was connected before the Sheets permission was introduced, disconnect and reconnect it to grant the additional scope.

The worker refreshes expired access tokens using the encrypted refresh token. Disconnecting a Google account first asks Google to revoke the refresh token; if revocation cannot be confirmed, RunLattice keeps the connection saved and reports the failure.

## Security boundaries

- OAuth state is random, stored as a SHA-256 hash, expires after ten minutes and can be consumed only once.
- PKCE S256 is used for the authorization-code exchange.
- The PKCE verifier, access token and refresh token are encrypted at rest.
- OAuth callbacks re-check the initiating user's current workspace administrator membership.
- Workspace integration quotas apply to new Google connections.
- Access tokens and refresh tokens are never returned to the browser or written to application logs.
- Sheets reads and appends are limited to 10,000 cells per run (with a maximum of 1,000 rows and 100 columns). Google Sheets JSON responses are capped at 2 MB.
- Sheets append uses RAW input values to prevent spreadsheet formulas from being executed. A timeout after the request begins is treated as an unknown outcome and is not automatically retried.
- Gmail sends are treated as outcome-unknown if the network times out after the request starts; RunLattice does not automatically resend that email.
