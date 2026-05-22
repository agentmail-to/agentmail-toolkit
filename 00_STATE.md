# 00_STATE.md — AgentMail Toolkit Analysis

## Repository Overview

- **Fork**: `okwn/agentmail-toolkit` (forked from `agentmail-to/agentmail-toolkit`)
- **Upstream**: `agentmail-to/agentmail-toolkit` — 71 stars, 22 forks, TypeScript, NOT archived
- **License**: No license set (null) — **⚠️ CONCERN**
- **Default branch**: main

## Repository Structure

```
agentmail-toolkit/
├── README.md                    # Root README (minimal, links to python/ node/)
├── python/                      # Python package (v0.2.7)
│   ├── pyproject.toml          # Hatch build, Python >=3.11
│   ├── README.md
│   ├── examples/
│   │   ├── openai_.py
│   │   ├── langchain_.py
│   │   └── pyproject.toml
│   └── src/agentmail_toolkit/
│       ├── __init__.py         # Generic AgentMailToolkit base
│       ├── toolkit.py          # Abstract Toolkit[T] base class
│       ├── tools.py            # 11 Tool definitions (list_inboxes, get_inbox, etc.)
│       ├── schemas.py          # Pydantic param schemas
│       ├── functions.py        # Tool implementation functions
│       ├── openai.py           # OpenAI Agents SDK adapter
│       ├── langchain.py         # LangChain adapter
│       ├── livekit.py          # LiveKit Agents adapter
│       ├── util.py             # safe_func helper
│       └── py.typed
└── node/                        # Node.js package (v0.3.1)
    ├── package.json            # pnpm, MIT license
    ├── tsconfig.json
    ├── pnpm-workspace.yaml
    ├── pnpm-lock.yaml
    ├── examples/
    │   └── package.json
    └── src/
        ├── index.ts            # Default export (generic)
        ├── tools.ts            # 18 Tool definitions (11 basic + 7 draft tools)
        ├── toolkit.ts          # BaseToolkit, ListToolkit, MapToolkit
        ├── schemas.ts          # Zod schemas
        ├── functions.ts        # Tool implementations
        ├── ai-sdk.ts          # Vercel AI SDK adapter
        ├── mcp.ts             # Model Context Protocol adapter
        ├── langchain.ts       # LangChain adapter
        ├── clawdbot.ts        # Clawdbot adapter
        └── util.ts            # safeFunc, file extraction helpers
```

## Key Findings

### 1. Node package is more complete than Python
- **Node**: 18 tools (11 basic + 7 draft tools: create/list/get/update/send/delete_draft)
- **Python**: 11 tools (missing all draft tools)
- **Version mismatch**: Node is 0.3.1, Python is 0.2.7

### 2. No CI/CD workflows found
- No `.github/workflows/` directory
- No GitHub Actions configured
- No test suite found

### 3. License issue
- Repository has `license: null` — **no open source license set**
- This is a legal concern for contributing

### 4. Open Issues (6)
| # | Title |
|---|-------|
| 24 | chore: add repo description, homepage URL, and topics for GitHub discoverability |
| 23 | docs: enhance README with framework matrix, comparison table, and quick start examples |
| 18 | Improve root README — add framework table, quick start, badges |
| 16 | Console landing page too heavy — particle effects cause lag |
| 12 | x402 ecosystem partner: Fía Signals crypto intelligence API |
| 11 | x402 ecosystem partner: Fía Signals crypto intelligence |

### 5. Open Pull Requests (2)
| # | Title | State |
|---|-------|-------|
| 23 | docs: enhance README with framework matrix... | open |
| 18 | Improve root README — add framework table, quick start, badges | open |

### 6. Upstream branches (9)
- `main` (6dbb78b — v0.3.1)
- `addDraftTools` — draft tools feature branch
- `deletionFix` — MCP undefined result fix
- `harry/fix-langchain-dts` — merged (fix-langchain-dts)
- `improve-readme*` (4 variants) — all stale/closed
- `mcp` — MCP protocol branch
- `jarvis/improve-readme` — stale

### 7. Quality Issues
- Python: `get_attachment` in `functions.py` uses incorrect client method: `client.threads.get_attachment()` but should be `client.inboxes.threads.get_attachment()`
- Both packages have error handling via `safe_func` patterns
- No test coverage
- README is very sparse

### 8. Dependencies
**Python**: agentmail>=0.4.10, openai-agents>=0.6.1, langchain>=1.1.0, livekit-agents>=1.3.5, pydantic>=2.12.5, pymupdf, python-docx, filetype

**Node**: agentmail@^0.4.10, jszip@^3.10.1, unpdf@^1.4.0, zod@^4.1.13 (peerDeps: @modelcontextprotocol/sdk, ai, langchain, clawdbot)