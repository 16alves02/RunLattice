# Slack integration setup

RunLattice currently supports one Slack operation: **Send message** to a channel in a connected workspace. Slack event triggers and channel discovery are not enabled.

## 1. Create a Slack app

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Open **OAuth & Permissions**.
3. Add this exact Redirect URL:
   `https://YOUR-RUNLATTICE-HOST/api/integrations/slack/callback`
4. Under **Bot Token Scopes**, add only:
   `chat:write`
5. Enable **Token Rotation** in OAuth & Permissions before installing the app if you want expiring 12-hour access tokens. RunLattice supports both long-lived bot tokens and rotated access/refresh tokens.
6. Save the app settings.

The app does not request channel-history, message-read, user, or private-channel discovery permissions. Invite the installed RunLattice bot to each channel where it should post. It must be invited to private channels. RunLattice does not request `chat:write.public`.

## 2. Configure environment variables

Set the following variables on the **web service**:

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_REDIRECT_URI` — must exactly match the Redirect URL configured in Slack.
- `NEXT_PUBLIC_APP_URL` — the canonical HTTPS RunLattice origin.

Set these variables on the **worker service**:

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`

For local development:
```dotenv
SLACK_REDIRECT_URI="http://localhost:3000/api/integrations/slack/callback"
```

Do not commit these values or send them in chat. Store them only in the hosting provider's environment-variable manager.

## 3. Apply the database migration

The additive migration `20261112150000_add_slack_oauth_state` creates short-lived, one-use state records and denies direct Supabase `anon` and `authenticated` access through RLS.

Apply migrations through the existing deployment/migration process after reviewing the migration.

## 4. Install and use Slack

1. Sign in to RunLattice as a workspace owner/admin with two-factor authentication enabled.
2. Open **Integrations → Slack → Connect Slack workspace**.
3. Authorize the app in Slack.
4. In Slack, invite the RunLattice bot to the channel where it should post.
5. Copy the channel ID from Slack and select **Slack · Send message** in Workflow Builder.
6. Choose the connected workspace and enter the channel ID and message.

Messages support workflow input and previous-step mappings. A timeout after Slack receives the request is treated as an unknown delivery outcome; RunLattice will not automatically send the same message again.

## Token lifecycle and disconnect

- OAuth state is random, stored as a SHA-256 hash, expires after ten minutes and can be consumed only once.
- Workspace administrator membership is checked again during the OAuth callback.
- Bot access tokens are encrypted at rest and never returned to the browser or written to application logs.
- When token rotation is enabled, the worker refreshes expiring tokens and atomically saves each new refresh token. Slack refresh tokens are single-use.
- Removing a Slack connection asks Slack to uninstall the app from that workspace, revoking all tokens. If Slack cannot confirm uninstall, RunLattice keeps the connection saved and reports the failure. In that case, remove RunLattice from the Slack workspace's app management settings first.

Official references:
- [Installing with OAuth](https://docs.slack.dev/authentication/installing-with-oauth/)
- [Using token rotation](https://docs.slack.dev/authentication/using-token-rotation/)
- [chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/)
- [apps.uninstall](https://docs.slack.dev/reference/methods/apps.uninstall/)
