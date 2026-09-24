# handoff.md

## What Was Completed — Step 5.1 (Evaluator + validator + LLM client)

Standard-mode AI evaluation is now implemented end to end on the backend:

1. **LLM adapter** (`backend/app/ai/llm/`):
   - `base.py`: provider-agnostic `LLMClient` interface + `LLMResult`/`LLMError`.
   - `anthropic_client.py`: calls the Anthropic Messages API directly via `httpx` (already a project dependency — no new library added).
   - `prompts.py`: the exact system/user prompt templates from `ai-pipeline.md` §7, versioned as `eval_v1`, plus a repair-prompt builder for the one-retry rule.
   - `validator.py`: validates the model's JSON against the rubric with **zero framework dependencies** — every rule from `ai-pipeline.md` §5 is enforced (valid JSON, known criterion ids, no duplicates, no missing criteria, 0–max range, 0.5-mark steps, non-empty reason/overall_reason, confidence in [0,1]), and the **backend always recomputes the total** rather than trusting any total the LLM sends (D-04). Also provides `compute_input_hash`/`is_stale` for invariant 7 (stale-suggestion detection).

2. **Evaluator service** (`backend/app/services/evaluator_service.py`):
   - `run_ai_evaluation()` — V1: loads the answer + rubric, picks the effective text (verified > OCR, invariant 6), selects mode (a `reference_grounded` question falls back to `standard` with a `REFERENCE_UNAVAILABLE` warning, since Pinecone/retrieval is Phase 6 and not built yet — this is the documented fallback, not new behaviour), builds the prompt, calls the LLM, validates the response with one repair retry, computes `confidence = min(llm_confidence, ocr_confidence)`, adds `LOW_CONFIDENCE`/`LOW_OCR_CONFIDENCE` warnings where applicable, and stores an **immutable** `ai_evaluations` row. Never touches `answers.final_marks`.
   - `list_ai_evaluations()` — V3: full history, each row's `stale` flag computed live against the answer's *current* text/rubric.

3. **Endpoints** (`backend/app/api/v1/evaluation.py`, wired into `app/api/v1/__init__.py`):
   - `POST /api/v1/answers/{id}/ai-evaluation` (V1) — admin or the assigned examiner.
   - `GET /api/v1/answers/{id}/ai-evaluations` (V3) — admin, assigned examiner, or moderator.
   - Error codes match api-spec.md §10 exactly: `NO_TEXT_TO_EVALUATE`, `RUBRIC_MISSING`, `ANSWER_LOCKED`, `AI_OUTPUT_INVALID` (422, after the repair retry), `LLM_UNAVAILABLE` (502).

4. **Small consistency fix**: `answer_service.py`'s N2 workspace payload used to hardcode `ai.latest.stale = False`. It now calls the real `is_stale()` check — the previous session's own handoff note explicitly listed "stale tracking" as part of this step, so this was completed rather than left half-done.

---

## Files Created / Modified

```
backend/
├── app/
│   ├── ai/
│   │   └── llm/                          ← NEW package
│   │       ├── __init__.py               ← get_llm_client() factory
│   │       ├── base.py                   ← LLMClient / LLMResult / LLMError
│   │       ├── anthropic_client.py       ← Anthropic Messages API via httpx
│   │       ├── prompts.py                ← eval_v1 prompt templates
│   │       └── validator.py              ← output validation + input-hash/staleness
│   ├── api/v1/
│   │   ├── evaluation.py                 ← NEW: V1, V3 routes
│   │   └── __init__.py                   ← wired evaluation_router in
│   ├── schemas/
│   │   └── evaluation.py                 ← NEW: request/response schemas
│   └── services/
│       ├── evaluator_service.py          ← NEW: run_ai_evaluation, list_ai_evaluations
│       └── answer_service.py             ← stale flag now real, not hardcoded
└── tests/
    └── test_evaluation.py                ← NEW: integration tests (FakeLLMClient)

development-phases.md                     ← 5.1 ticked; "next session" now points to 5.2
session-state.md                          ← full detail on this session
handoff.md                                ← this file
```

No frontend files were touched. No new pip dependencies were added (httpx was already in `requirements.txt`).

---

## Important Decisions

- **No new SDK for the LLM call.** Used `httpx` directly against Anthropic's REST API instead of adding the `anthropic` Python package, per the project's own anti-overengineering rule (`instruction.md` §9: don't add a library for what one HTTP call can do).
- **Gemini is a stub.** `LLM_PROVIDER=gemini` in `.env` is currently ignored — `get_llm_client()` always returns the Anthropic client. If Gemini is genuinely needed, add `GeminiClient(LLMClient)` and branch in the factory on `settings.LLM_PROVIDER`; the interface is already designed for this.
- **`reference_grounded` questions still work today**, just always in fallback (`mode_used="standard"`, warning `REFERENCE_UNAVAILABLE`), because Pinecone doesn't exist until Phase 6. This was the documented graceful-degradation path in `ai-pipeline.md`, so building it now (instead of blocking reference_grounded questions entirely) is not scope creep — it's literally what that section specifies for "Pinecone unavailable."
- **Batch evaluation (V2) was deliberately NOT built.** Session-state's own prior note scoped 5.1 to V1 + V3 only; V2 is a separate concern (background job runner integration) better done alongside or after 5.2's marking service.
- **`final_marks` is untouched by this step.** Only the (not-yet-built) marking service and moderation service are allowed to write it (invariant 5).

---

## Problems / Blockers — READ THIS BEFORE TRUSTING THIS STEP

**This sandbox had no internet access and none of the required Python packages installed** (no `fastapi`, `sqlalchemy`, `pytest`, `psycopg`, etc. — only stdlib plus `PyJWT`/`Pillow`), and no Postgres instance. This means:

- ✅ **What WAS actually verified by execution in this session:** the validator's core logic (`app/ai/llm/validator.py`) — 14 hand-written assertions covering every validation rule, executed directly with plain `python3` since that module has zero framework dependencies. All 14 passed.
- ✅ **What was verified statically:** every new/changed file passes `python3 -m py_compile` (syntax-valid), and every cross-file reference (model column names, existing service patterns, dependency signatures, schema field names) was manually checked against the actual files already in this repo — not assumed from the planning docs.
- ⚠️ **What was NOT executed:** `tests/test_evaluation.py` (the new integration test file) and the rest of the existing test suite. They could not be run here for lack of a Python environment and a database. **The very next thing to do, before starting 5.2, is: `cd backend && pip install -r requirements.txt && pytest tests/ -v` in a real environment**, and fix anything that surfaces. Given how carefully the patterns were matched, I expect this to pass close to as-is, but "expect" is not "verified" — don't skip this step.

---

## Exact Next Action for the Next Session

**Step 5.2 — Marking service + guards (backend).** Full detail (files, guard rules, error codes, test list) is written out in `session-state.md`'s "Exact Next Step" section — read that before starting.

In short: build `marking_service.py` for M1 (`accept-ai`) and M2 (`PUT .../evaluation`), with the `OCR_NOT_VERIFIED` and `AI_EVAL_STALE` guards (the `is_stale()` helper from this session already exists and should be reused, not reimplemented), range/criterion-sum validation, and this is the step where `answers.final_marks` finally gets written for the first time (by the examiner path — moderation is Phase 8).

## What Must NOT Be Repeated

- Don't redo 0.1 through 5.1 — all done.
- Don't jump to V2 (batch AI), Pinecone (6.1), anomalies (7.x), or moderation (8.x) — one step at a time.
- Don't add the `anthropic` or `google-generativeai` SDKs as dependencies — keep the `httpx`-direct pattern, or explicitly flag if a real SDK becomes necessary.
- Don't touch frontend files.
- Don't skip running the actual test suite in a real environment before building on top of this step.
