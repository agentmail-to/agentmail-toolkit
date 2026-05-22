# 05_PR_CANDIDATES.md — AgentMail Toolkit PR Candidates

## Open Issues (6) — Potential PR Topics

| # | Title | Labels | Priority | Effort |
|---|-------|--------|----------|--------|
| 24 | chore: add repo description, homepage URL, and topics for GitHub discoverability | chore | medium | low |
| 23 | docs: enhance README with framework matrix, comparison table, and quick start examples | docs | high | medium |
| 18 | Improve root README — add framework table, quick start, badges | docs | medium | low |
| 16 | Console landing page too heavy — particle effects cause lag and hurt trust | bug? | low | unknown |
| 12 | x402 ecosystem partner: Fía Signals crypto intelligence API (42 endpoints, pay-per-call) | partner | low | unknown |
| 11 | x402 ecosystem partner: Fía Signals crypto intelligence (42 pay-per-call endpoints, USDC on Solana) | partner | low | unknown |

## Open Pull Requests (2)

| # | Title | Status | Reviewable |
|---|-------|--------|------------|
| 23 | docs: enhance README with framework matrix, comparison table, and quick start examples | open | yes |
| 18 | Improve root README — add framework table, quick start, badges | open | yes |

## Code Defects Found (From Code Review)

### Bug: Python `get_attachment()` uses wrong client path
**File**: `python/src/agentmail_toolkit/functions.py`, line 39
**Issue**: Uses `client.threads.get_attachment()` but AgentMail SDK requires `client.inboxes.threads.get_attachment()`
```python
# CURRENT (buggy):
attachment = client.threads.get_attachment(
    thread_id=kwargs["thread_id"], attachment_id=kwargs["attachment_id"]
)
# SHOULD BE:
attachment = client.inboxes.threads.get_attachment(
    thread_id=kwargs["thread_id"], attachment_id=kwargs["attachment_id"]
)
```
**Severity**: High — tool will crash when called

### Missing Feature: Python lacks draft tools
**Status**: Node has 7 draft tools (create/list/get/update/send/delete_draft + schedule support), Python has 0
**Impact**: Feature parity gap between Node and Python SDKs
**Effort**: Medium — requires adding 7 new tools and updating schemas

## Improvement Opportunities

### 1. Version parity
- Node: v0.3.1, Python: v0.2.7
- Recommend aligning Python to 0.3.x with matching toolset

### 2. Test coverage
- No test files found in repository
- Could add `pytest` tests and GitHub Actions CI

### 3. CI/CD missing
- No `.github/workflows/` directory
- Could add: lint, typecheck, test, build, publish workflows

### 4. License clarification
- `license: null` — no open source license
- Should add MIT or Apache 2.0

## Prioritized Candidates for PRs

1. **Fix Python `get_attachment()` bug** — high impact, low effort, clear fix
2. **Add draft tools to Python** — feature parity with Node, medium effort
3. **Improve root README** — addresses issues #18, #23, #24
4. **Add GitHub Actions CI** — quality of life, enables safe contributions
5. **Align package versions** — v0.3.x for both python and node