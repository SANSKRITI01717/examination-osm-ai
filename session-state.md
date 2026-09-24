# session-state.md

## Current Session

| Field | Value |
|---|---|
| Phase / Step | Phase 5 / Step 5.1 |
| Status | ✅ COMPLETE |
| Last completed step | 5.1 Evaluator + validator + LLM client (backend) |
| Agent | Claude (backend implementation for this step, per updated ownership in instruction.md) |

## Files Created / Changed

| File | Action |
|---|---|
| `backend/app/ai/llm/base.py` | Created — `LLMClient` ABC, `LLMResult` dataclass, `LLMError` |
| `backend/app/ai/llm/anthropic_client.py` | Created — Anthropic Messages API client via `httpx` directly (no new dependency added) |
| `backend/app/ai/llm/prompts.py` | Created — System prompt + user prompt builder (`eval_v1`) + repair-prompt builder, per ai-pipeline.md §7 |
| `backend/app/ai/llm/validator.py` | Created — Pure-Python validation of LLM JSON output against a rubric; `compute_input_hash` / `is_stale` for invariant 7 |
| `backend/app/ai/llm/__init__.py` | Created — `get_llm_client()` factory, mirrors `app/ai/ocr/__init__.py` |
| `backend/app/schemas/evaluation.py` | Created — Pydantic schemas for V1/V3 |
| `backend/app/services/evaluator_service.py` | Created — `run_ai_evaluation()` (V1) and `list_ai_evaluations()` (V3): mode selection, prompt build, LLM call, validation with 1 repair retry, confidence/warnings computation, immutable `AIEvaluation` row |
| `backend/app/api/v1/evaluation.py` | Created — Router for V1 `POST /answers/{id}/ai-evaluation` and V3 `GET /answers/{id}/ai-evaluations` |
| `backend/app/api/v1/__init__.py` | Updated — Wired `evaluation_router` into `api_v1_router` |
| `backend/app/services/answer_service.py` | Updated — N2 workspace payload's `ai.latest.stale` now uses the real `is_stale()` check instead of a hardcoded `False` |
| `backend/tests/test_evaluation.py` | Created — Integration tests for V1/V3 using a `FakeLLMClient` (no real API key needed): no-text guard, forbidden-examiner guard, successful evaluation, stale-after-edit, invalid-output-after-repair-retry, reference_grounded fallback |

## Tests & Checks Run

| Check | Result |
|---|---|
| `python3 -m py_compile` on all 10 new/changed backend files | ✅ PASS — all compile cleanly |
| Standalone execution of `validator.py`'s core logic (14 hand-written assertions covering: valid response, unknown criterion, out-of-range marks, missing criterion, non-JSON, non-0.5-step marks, LLM-supplied total ignored in favour of backend-computed sum, duplicate criterion id, input-hash determinism and change-detection) | ✅ PASS — all 14 assertions passed, executed directly in this session |
| `pytest tests/test_evaluation.py` (the new integration test file, against a live Postgres DB) | ⚠️ **NOT RUN HERE** — this sandbox has no internet access and does not have fastapi/sqlalchemy/psycopg/pytest installed, and no Postgres instance. The test file is written to match the exact style/fixtures of the existing, previously-passing `tests/test_ocr.py`. **Run `pytest backend/tests/test_evaluation.py -v` in a real environment before trusting this step further.** |
| `pytest` full existing suite (`test_auth.py`, `test_ocr.py`, etc.) to confirm no regression | ⚠️ **NOT RUN HERE** — same environment limitation. The only file that touches pre-existing behaviour is `answer_service.py` (the `ai.latest.stale` field), which is additive (computed value replacing a hardcoded one) and does not change any other field, route, or status code. |

## Key Decisions

| Decision | Reason |
|---|---|
| Anthropic client calls the API directly via `httpx` rather than adding the `anthropic` SDK | `httpx` is already a dependency (requirements.txt); avoids adding a new library per instruction.md §9 anti-overengineering rule |
| `LLM_PROVIDER=gemini` is **not** implemented — `get_llm_client()` always returns `AnthropicClient` regardless of the env var | Time-boxed to one provider for this step; the adapter interface (`LLMClient`) already supports adding `GeminiClient` later without touching the evaluator or router |
| A `reference_grounded` question falls back to standard mode with warning `REFERENCE_UNAVAILABLE` | Pinecone/retrieval doesn't exist yet (Phase 6). This is the documented fallback behaviour in ai-pipeline.md §6 step 4, not new scope — it means reference_grounded questions are usable (in degraded form) before Phase 6 lands |
| V1 is synchronous (no batch job runner) | Matches api-spec.md V1 exactly ("synchronous, ≈5–20s"). Batch AI evaluation (V2) is explicitly deferred to step 5.2/later — not built in this step |
| `answers.final_marks` is **not** touched anywhere in this step | Invariant 5 — only `marking_service` (5.2, not yet built) and `moderation_service` (8.1) may write it |
| Updated `answer_service.py`'s hardcoded `"stale": False` to a real check | Same feature (`ai_evaluations` staleness) the previous session's own "Exact Next Step" note explicitly listed as part of 5.1 ("saving to AIEvaluation with stale tracking") |

## Blockers

- **No live test execution possible in this session's environment** — no internet access, no Python packages beyond the standard library + PyJWT/Pillow, no Postgres. All code is syntax-checked and carefully cross-referenced against the actual existing models/services/patterns already in the repo, and the pure-logic validator was executed and verified directly, but the full integration test suite has **not** been run against a real database. Treat this step as "implemented and self-consistent, pending a real test run" rather than "verified passing."
- `LLM_PROVIDER=gemini` path is a stub — only Anthropic works right now.

## Exact Next Step

**Step 5.2 — Marking service + guards (backend)**

1. `backend/app/services/marking_service.py`:
   - `accept_ai(db, answer_id, user, ai_evaluation_id, active_seconds)` → M1. Refuse if `ocr_review_required and not ocr_verified` (`OCR_NOT_VERIFIED`, 409) or if `is_stale(...)` on the referenced `ai_evaluation_id` is true (`AI_EVAL_STALE`, 409). On success: create/update `evaluations` row with `source="ai_accepted"`, `marks_awarded` = the AI evaluation's `suggested_marks`, `status="submitted"`, `submitted_at=now()`; set `answers.final_marks`, `final_source="examiner"`, `marking_status="marked"` (or keep `"flagged"` if an open anomaly already exists — anomalies aren't built yet in this repo, so for now always set `"marked"`).
   - `save_or_submit(db, answer_id, user, marks_awarded, criterion_marks, comment, source, ai_evaluation_id, active_seconds, submit)` → M2. Validate `0 ≤ marks_awarded ≤ question.max_marks` (`MARKS_OUT_OF_RANGE`, 422) and, if `criterion_marks` given, that it sums to `marks_awarded` (`CRITERIA_SUM_MISMATCH`, 422). `source="ai_modified"` requires `ai_evaluation_id`. Same `ANSWER_LOCKED`/assignment-ownership guard pattern as `ocr_service.py`/`evaluator_service.py`.
2. `backend/app/schemas/marking.py`: request/response schemas for M1/M2 per api-spec.md §12.
3. `backend/app/api/v1/marking.py`: router for `POST /answers/{id}/evaluation/accept-ai` and `PUT /answers/{id}/evaluation`. Wire into `app/api/v1/__init__.py`.
4. `backend/tests/test_marking.py`: cover accept-ai success, OCR-not-verified guard, stale-AI guard, manual marks out-of-range, criterion-sum mismatch, ai_modified without ai_evaluation_id rejected, assignment/ownership checks, and that `final_marks`/`final_source`/`marking_status` end up correct in the DB.

## What Must NOT Be Repeated

- Do not re-implement 0.1–4.2 or 5.1 — they are done.
- Do not build V2 (batch AI evaluation), Pinecone/RAG (6.1), anomaly detection (7.x), or moderation (8.x) in the 5.2 session — those are separate, later steps.
- Do not add the `anthropic` SDK or `google-generativeai` SDK as new dependencies — keep using `httpx` directly, or if a real SDK is genuinely required later, say so explicitly rather than adding it silently.
- Do not change `AIEvaluation`/`Answer` model columns — the schema is already correct and matches `database-schema.md`.
- Do not touch frontend files.
- **Before trusting 5.1 as fully verified, run `pytest backend/tests/` (the whole suite, not just the new file) against a real Postgres DB in an environment with internet access to install `requirements.txt`.** This was not possible in the session that wrote this file.
