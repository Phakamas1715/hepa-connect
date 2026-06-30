# HEPA-Connect x Grok Build

Grok Build is xAI's official optional developer agent for reviewing, testing, and maintaining this
repository. SuperGrok and X Premium+ subscribers can sign in with their subscription account without
creating a separate API key. It is not part of the patient workflow and must not receive identifiable
health information.

## Install

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
grok --version
grok --oauth
```

After successful OAuth login, set the readiness flag only on the machine where that login is valid:

```env
GROK_CLI_PATH=/absolute/path/to/.grok/bin/grok
GROK_SUBSCRIPTION_AUTHENTICATED=true
```

API billing is separate from the subscription. `GROK_API_KEY` is optional and should be used only
when API-based automation is intentionally required.

## Project commands

```bash
pnpm grok:version
```

For a read-only review without patient data:

```bash
grok --cwd . --permission-mode plan \
  "Review the application architecture. Do not read .env, data files, patient records, or secrets."
```

## Allowed use

- Review source code, deployment configuration, and test failures.
- Suggest refactors and documentation changes.
- Run build, lint, and non-production smoke tests.
- Analyze sanitized logs that contain no HN, CID, LINE user ID, or clinical details.

## Prohibited use

- Do not send HN, CID, names, dates of birth, LINE user IDs, or laboratory results to Grok.
- Do not allow Grok to query production HOSxP, KUMHOS, Supabase, LINE, or MOPH systems.
- Do not expose `.env`, database dumps, agent-store files, or access tokens.
- Do not run autonomous deployment or patient messaging without staff approval.

## Deployment

The HEPA-Connect web application does not require Grok CLI at runtime. Install it only on an
administration/development machine. If the production server needs repository verification, use a
restricted service account, sandbox mode where supported, and a sanitized checkout without patient
data.

The Integration page checks the official CLI first. It never reads or returns OAuth credentials or
API key values to the browser.
