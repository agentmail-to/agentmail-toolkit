# 01_REPO_MAP.md — AgentMail Toolkit Repository Map

## File Structure

### Root
| File | Purpose |
|------|---------|
| `README.md` | Minimal root README linking to `python/` and `node/` |
| `.gitignore` | Ignores `node_modules`, `dist`, `build`, `*.egg-info`, `__pycache__` |

### Python (`python/`)
| File | Purpose |
|------|---------|
| `pyproject.toml` | Package config: v0.2.7, Python >=3.11, hatch build |
| `README.md` | Python-specific README with pip install + usage example |
| `uv.lock` | Lock file for uv |
| `.gitignore` | Standard Python gitignore |
| `examples/pyproject.toml` | Examples workspace |
| `examples/openai_.py` | OpenAI agent example |
| `examples/langchain_.py` | LangChain agent example |
| `src/agentmail_toolkit/__init__.py` | Exports `AgentMailToolkit`, `Tool` |
| `src/agentmail_toolkit/toolkit.py` | Abstract `Toolkit[T]` base class |
| `src/agentmail_toolkit/tools.py` | 11 `Tool` definitions + `tools` list |
| `src/agentmail_toolkit/schemas.py` | Pydantic parameter schemas |
| `src/agentmail_toolkit/functions.py` | Tool implementation functions |
| `src/agentmail_toolkit/openai.py` | OpenAI Agents SDK adapter |
| `src/agentmail_toolkit/langchain.py` | LangChain adapter |
| `src/agentmail_toolkit/livekit.py` | LiveKit Agents adapter |
| `src/agentmail_toolkit/util.py` | `safe_func`, `ToolError` |
| `src/agentmail_toolkit/py.typed` | PEP 561 typed marker |

### Node (`node/`)
| File | Purpose |
|------|---------|
| `package.json` | Package: v0.3.1, MIT license, pnpm |
| `tsconfig.json` | TypeScript config |
| `pnpm-workspace.yaml` | Workspace config |
| `pnpm-lock.yaml` | Lock file |
| `examples/package.json` | Examples workspace |
| `src/index.ts` | Default `AgentMailToolkit` (generic) |
| `src/tools.ts` | 18 `Tool` definitions (includes 7 drafts) |
| `src/toolkit.ts` | `BaseToolkit`, `ListToolkit`, `MapToolkit` |
| `src/schemas.ts` | Zod schemas for all params |
| `src/functions.ts` | Tool implementations + draft functions |
| `src/ai-sdk.ts` | Vercel AI SDK adapter (`MapToolkit`) |
| `src/mcp.ts` | MCP (Model Context Protocol) adapter |
| `src/langchain.ts` | LangChain adapter |
| `src/clawdbot.ts` | Clawdbot adapter |
| `src/util.ts` | `safeFunc`, `detectFileType`, PDF/DOCX extraction |

## Tool Map

### Python Tools (11)
```
list_inboxes       → list_inboxes()
get_inbox          → get_inbox()
create_inbox       → create_inbox()
delete_inbox       → delete_inbox()
list_threads       → list_threads()
get_thread         → get_thread()
get_attachment     → get_attachment()  ⚠️ BUG: wrong client path
send_message       → send_message()
reply_to_message   → reply_to_message()
forward_message    → forward_message()
update_message     → update_message()
```

### Node Tools (18) — superset of Python
All Python tools PLUS:
```
create_draft       → createDraft()
list_drafts        → listDrafts()
get_draft          → getDraft()
update_draft       → updateDraft()
send_draft         → sendDraft()
delete_draft       → deleteDraft()
```

## Framework Adapters

### Python
| Framework | File |
|-----------|------|
| Generic | `__init__.py` |
| OpenAI Agents SDK | `openai.py` |
| LangChain | `langchain.py` |
| LiveKit | `livekit.py` |

### Node
| Framework | File | Toolkit Type |
|-----------|------|--------------|
| Generic | `index.ts` | `ListToolkit` |
| Vercel AI SDK | `ai-sdk.ts` | `MapToolkit` |
| MCP (Model Context Protocol) | `mcp.ts` | `ListToolkit` |
| LangChain | `langchain.ts` | ? |
| Clawdbot | `clawdbot.ts` | ? |

## Schema Comparison

| Operation | Python (Pydantic) | Node (Zod) |
|-----------|-------------------|------------|
| `inboxId` | `Annotated[str, Field]` | `z.string().describe()` |
| `limit` | `int, default=10` | `z.number().optional().default(10)` |
| `before/after` | `datetime` objects | `z.string().pipe(z.coerce.date())` |
| `attachments` | `List[Attachment]` | `z.array(AttachmentSchema)` |
| `replyAll` | `bool` | `replyAll: z.boolean()` |

## Key Code Patterns

### Python: Tool definition
```python
Tool(name="list_inboxes", description="List inboxes", params_schema=ListItemsParams, func=list_inboxes)
```

### Python: Toolkit base
```python
class Toolkit(Generic[T], ABC):
    _tools: Dict[str, T] = None
    def __init__(self, client: Optional[AgentMail] = None):
        self.client = client or AgentMail()
        self._tools = {tool.name: self._build_tool(tool) for tool in tools}
    @abstractmethod
    def _build_tool(self, tool: Tool) -> T: pass
```

### Node: Tool definition
```typescript
{name: 'list_inboxes', description: 'List inboxes', paramsSchema: ListItemsParams, func: listInboxes, annotations: {readOnlyHint: true, openWorldHint: false}}
```

### Node: Toolkit types
```typescript
// ListToolkit<T> — getTools() returns T[]
// MapToolkit<T> — getTools() returns Record<string, T>
```

## Defects Identified

1. **Python `get_attachment()` bug**: Uses `client.threads.get_attachment()` but should be `client.inboxes.threads.get_attachment()`
2. **Python missing draft tools**: Node has 7 draft tools; Python has none
3. **Version skew**: Node v0.3.1 vs Python v0.2.7
4. **No license**: `license: null` in repo metadata
5. **Sparse README**: Root README is very minimal
6. **No tests**: No test files found
7. **No CI**: No GitHub Actions workflows