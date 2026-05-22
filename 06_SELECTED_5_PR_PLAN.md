# 06_SELECTED_5_PR_PLAN.md — 5 Selected PRs for AgentMail Toolkit

## Selected PRs

### PR #1: Fix Python `get_attachment()` client path bug
**Issue**: Line 39 of `python/src/agentmail_toolkit/functions.py` uses `client.threads.get_attachment()` but should use `client.inboxes.threads.get_attachment()`
**Severity**: High — tool crashes at runtime
**Files**:
- `python/src/agentmail_toolkit/functions.py` (1 line fix)
**Changes**:
```python
# OLD (line 39):
attachment = client.threads.get_attachment(
    thread_id=kwargs["thread_id"], attachment_id=kwargs["attachment_id"]
)
# NEW:
attachment = client.inboxes.threads.get_attachment(
    inbox_id=kwargs["inbox_id"], thread_id=kwargs["thread_id"], attachment_id=kwargs["attachment_id"]
)
```
**Verification**: Build and smoke-test `python/examples/openai_.py`

---

### PR #2: Add draft tools to Python package
**Issue**: Node has 7 draft tools (create/list/get/update/send/delete_draft + scheduling); Python has 0
**Files to add/modify**:
- `python/src/agentmail_toolkit/schemas.py` — add `CreateDraftParams`, `ListDraftsParams`, `GetDraftParams`, `UpdateDraftParams`, `SendDraftParams`, `DeleteDraftParams`
- `python/src/agentmail_toolkit/functions.py` — add `create_draft`, `list_drafts`, `get_draft`, `update_draft`, `send_draft`, `delete_draft`
- `python/src/agentmail_toolkit/tools.py` — add 6 new Tool entries for drafts
- `python/pyproject.toml` — bump version to 0.3.0
**Verification**: Import and list tools; ensure 17 total tools

---

### PR #3: Improve root README with framework matrix and quick start
**Issue**: Addresses issues #18, #23, #24 — sparse root README
**Files**:
- `README.md` — rewrite with:
  - Framework compatibility matrix (OpenAI Agents SDK, Vercel AI SDK, LangChain, MCP, LiveKit, Clawdbot)
  - Badges (PyPI, npm, CI)
  - Quick start code snippets for each framework
  - Link to python/ and node/ READMEs
**Verification**: Review renders correctly on GitHub

---

### PR #4: Add GitHub Actions CI workflow
**Issue**: No CI/CD — quality risk for contributions
**Files to add**:
- `.github/workflows/ci.yml` — for node package:
  - `pnpm install` → `pnpm lint` → `pnpm build`
- `.github/workflows/python-ci.yml` — for python package:
  - `pip install build` → `python -m build` → (no tests yet, but validates build)
**Note**: Currently no test suite exists; CI at minimum validates lint + build

---

### PR #5: Align Python package version to 0.3.x
**Issue**: Python v0.2.7 vs Node v0.3.1 — version skew
**Files**:
- `python/pyproject.toml` — bump version from 0.2.7 to 0.3.0
- `python/src/agentmail_toolkit/__init__.py` — update version if hardcoded
**Changelog**: In `python/README.md` or a new `CHANGELOG.md`, document changes since 0.2.7

---

## Execution Order

1. **PR #1** (Bug fix) — Low risk, high impact, 1 line change
2. **PR #2** (Draft tools) — New feature, moderate complexity
3. **PR #5** (Version bump) — Pre-requisite for PR #2, must merge first or together
4. **PR #3** (README improvement) — Documentation, independent
5. **PR #4** (CI workflow) — Infrastructure, independent

## Notes

- **Cannot merge without license clarification** — repo has `license: null`. Recommend opening a preliminary issue asking maintainers to add a license before submitting code PRs.
- **Draft tools PR #2** requires understanding AgentMail SDK's draft API — if SDK doesn't support drafts in Python, this PR would be blocked.
- **Issues #12, #11** (x402/Fía Signals partner requests) are not actionable by this project — they are feature requests for AgentMail API itself, not the toolkit.