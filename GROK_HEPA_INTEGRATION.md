# HEPA-Connect x Grok CLI

Grok CLI is an optional developer agent for reviewing, testing, and maintaining this repository.
It is not part of the patient workflow and must not receive identifiable health information.

## Install

```bash
bun add -g grok-dev
grok --version
```

Set credentials only in the local or server environment:

```env
GROK_CLI_PATH=/absolute/path/to/grok
GROK_API_KEY=
GROK_BASE_URL=https://api.x.ai/v1
GROK_MODEL=
```

Never commit the API key. Rotate the key if it is pasted into chat, logs, screenshots, or Git history.

## Project commands

```bash
pnpm grok:version
pnpm grok:verify
```

For a read-only review without patient data:

```bash
grok --directory . --prompt "Review the application architecture. Do not read .env, data files, patient records, or secrets."
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

The Integration page checks the CLI version and whether `GROK_API_KEY` exists. It never returns the
key value to the browser.
