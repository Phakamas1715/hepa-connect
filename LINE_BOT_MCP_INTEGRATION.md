# HEPA-Connect x LINE Bot MCP Server

This project can expose the official LINE Bot MCP Server to a local developer agent such as Grok
Build. It is a preview integration and is not part of the HEPA production web runtime.

## Safety model

- The launcher reads secrets from the ignored `.env` file.
- The default recipient is always `LINE_TEST_RECIPIENT_ID`.
- `LINE_MCP_ENABLED=true` is required before the MCP process can start.
- Do not give the agent HN, CID, names, laboratory results, or other health information.
- Broadcast and rich-menu deletion tools require explicit human approval.

## Install

```bash
npm install -g @line/line-bot-mcp-server@0.5.0
```

Required local environment:

```env
LINE_MCP_ENABLED=true
LINE_CHANNEL_ACCESS_TOKEN=
LINE_TEST_RECIPIENT_ID=
```

Register the server with Grok Build:

```bash
grok mcp add --scope user line-bot -- node /absolute/path/to/scripts/line-bot-mcp.mjs
grok mcp doctor line-bot
```

The wrapper maps the HEPA environment names to the names expected by LINE:

- `LINE_CHANNEL_ACCESS_TOKEN` becomes `CHANNEL_ACCESS_TOKEN`
- `LINE_TEST_RECIPIENT_ID` becomes `DESTINATION_USER_ID`

Keep the production webhook and `/api/send-nudge` as the main application path. MCP is for controlled
operator-assisted actions and testing only.
