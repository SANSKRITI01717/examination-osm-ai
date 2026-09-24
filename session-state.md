# session-state.md

## Current Session

| Field | Value |
|---|---|
| Phase / Step | Phase 5 / Step 5.2 |
| Status | ✅ COMPLETE — implemented, wired, and tested (62/62 passing in the sandbox) |
| Last completed step | 5.2 Marking service + guards (backend) |
| Agent | Claude (backend) |
| Stopped at | 5.2. Step 6.1 was **not started** (reasons below) |

## Files Created / Changed (paths relative to repo root)

| File | Action |
|---|---|
| `backend/app/services/marking_service.py` | Created — `accept_ai()` (M1), `save_or_submit()` (M2), guards, marks/criterion validation. With the future ModerationService, the only writer of `answers.final_marks` |
| `backend/app/schemas/marking.py` | Created — `AcceptAIRequest`, `SaveMarksRequest`, `CriterionMarkInput`, `EvaluationResponse` |
| `backend/app/api/v1/marking.py` | Created — `POST /answers/{id}/evaluation/accept-ai` (M1), `PUT /answers/{id}/evaluation` (M2); examiner only |
| `backend/app/api/v1/__init__.py` | Modified — wired `marking_router` (one import, one `include_router`) |
| `backend/tests/test_marking.py` | Created — 20 integration tests (FakeLLMClient; each test builds its own answer) |
| `backend/openapi.json` | Re-exported. Additive vs the uploaded ZIP: +4 paths (V1, V3, M1, M2 — the ZIP's copy predated even 5.1), +9 schemas, nothing existing changed or removed |
| `api-spec.md` | Modified — "Implementation notes (step 5.2)" under §12 for behaviour the original rules left open |
| `development-phases.md` | Modified — 5.2 ticked; next-session pointer + open items |
| `session-state.md`, `handoff.md` | Modified (this file) |

No frontend files touched. No new dependencies (`requirements.txt` byte-identical to the ZIP's). No model/migration/schema changes.

## Provenance note — read this

When this session began, the sandbox working directory already contained `marking_service.py`, `schemas/marking.py`, `api/v1/marking.py` and `tests/test_marking.py`, which are **not in the uploaded ZIP** (file timestamps were minutes after the ZIP was extracted; I did not write them). The router was not wired, so 18 of the 20 marking tests returned 404. During the session, other edits to the working tree also appeared that I did not make (a second copy of the router import/`include_router` in `__init__.py`, a regenerated `openapi.json`, an `api-spec.md` note, and rewritten tracking docs). I did not assume any of it was correct. I:

1. read all four marking files in full and checked them against `api-spec.md` §12, `database-schema.md` invariants and the 5.1 code they call;
2. removed the duplicated router wiring (verified: exactly one import and one `include_router`; 36 OpenAPI operations, no duplicate operation IDs);
3. merged two overlapping api-spec notes into one;
4. re-verified every factual claim in the rewritten tracking docs and replaced the ones I could not substantiate (this file and `handoff.md` are the result).

If the owner did not expect those files to appear, treat them as a reviewed-and-tested implementation, not as something written from scratch in one pass.

## Tests & Checks Run (real execution, this session)

Environment: Linux sandbox, Python 3.12, PostgreSQL 16.15 (already installed; the `examination_osm` DB already existed; I ran `alembic upgrade head`), `pip install -r requirements.txt` → FastAPI 0.141.1, Starlette 1.7.0, Pydantic 2.13.5, SQLAlchemy 2.0.54, pytest 9.1.1.

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` on a **pristine extract of the uploaded ZIP** (+ sandbox storage stand-in, see caveat) | ✅ **42 passed** — independently reproduces the owner's 42/42 |
| `python -m pytest tests/ -v` with the marking files present but router **not** wired | ❌ 44 passed, 18 failed (all `test_marking.py`, 404s) — this is what wiring fixed |
| `python -m pytest tests/ -v` after wiring | ✅ **62 passed, 0 failed** (42 old + 20 new) |
| Same, after removing the duplicated router lines | ✅ **62 passed, 0 failed** |
| Mutation check on `marking_service.py` (7 mutants: drop OCR guard / stale guard / criterion-sum check / range check / ownership check / `ai_modified` id requirement; let a draft write `final_marks`) | ✅ **7/7 caught**, each by the test written for it. File restored; md5 identical before and after |

**Sandbox caveat:** the ZIP is missing `backend/app/core/storage/` (see Blockers). To run anything I used a throwaway local-disk stand-in (files marked `SANDBOX STAND-IN`). It is **not part of the deliverables**. The 5.2 code never touches storage, so this does not weaken the 5.2 results. **Not run on Windows** — the owner should re-run `python -m pytest tests/ -v` locally (my run used a newer FastAPI than the owner's may have).

## Behaviour implemented (5.2)

- **M1 accept-ai**: examiner only and must be the assigned examiner (else 403); exam must be `evaluation` and answer not `moderated` (`ANSWER_LOCKED`); `ai_evaluation_id` must belong to the answer (404); `OCR_NOT_VERIFIED` if `ocr_review_required and not ocr_verified`; `AI_EVAL_STALE` via the existing `is_stale()`. Writes a submitted evaluation (`ai_accepted`, marks = AI `suggested_marks`, AI per-criterion marks stored as `criterion_marks`), then `answers.final_marks`, `final_source="examiner"`, `marking_status`.
- **M2 save/submit**: `source` ∈ {`ai_modified`,`manual`} (`ai_accepted` only via M1, so its guards can't be bypassed); `ai_modified` needs `ai_evaluation_id`; `MARKS_OUT_OF_RANGE` / `CRITERIA_SUM_MISMATCH` (Decimal arithmetic, no float drift); 0.5 steps enforced. `submit=false` saves a draft and never touches `final_marks`.
- OCR-unverified answers can still be marked via M2 (invariant 8 only blocks accept-ai) — tested.
- The N2 placeholder draft evaluation (created on first open) is reused: exactly one `evaluations` row per answer — tested.
- Running V1 alone never writes `final_marks`, and `ai_evaluations` rows are untouched by marking — tested.

## Key Decisions (new this session)

| Decision | Reason |
|---|---|
| `marking_status` after submit is `flagged` if an **open anomaly row exists**, else `marked` | api-spec §12 says exactly this and the `Anomaly` model/table already exists. The previous session-state suggested "always `marked`" because detection isn't built; querying the table is correct now (no rows → `marked`) and needs no change in Phase 7. Tested with a hand-inserted anomaly. |
| `criterion_marks` is a **list** `[{criterion_id, awarded_marks}]` | Locked `database-schema.md`. The mock frontend sends a map — flagged for 5.3. |
| `active_seconds` and `submit` are **required** | A silent default of 0 would create false TOO_FAST flags later. |
| Non-0.5-step marks → `422 VALIDATION_ERROR` | Spec says 0.5 steps but has no dedicated code; reused the existing generic code rather than invent one. |
| `submit=false` on an already-submitted evaluation → `409 ANSWER_LOCKED` (`details.reason=ALREADY_SUBMITTED`) | A draft save would change the evaluation but leave `answers.final_marks` on the old value. Re-submitting is the supported way to change marks. Not in the spec — owner may overrule. |
| Guard order: 404 → 403 → 409 locked | Don't reveal exam state to callers who can't act on the answer. |
| Admin/moderator cannot call M1/M2 (403) | Spec auth column is `E*` only. |

## Why 6.1 was NOT started

`instruction.md` §8 (one step per session) plus "when in doubt, stop earlier":
1. 6.1 needs new dependencies (`pinecone`, a LangChain text-splitter package) and an embeddings provider (`.env.example` says `openai`, with no client or key path in the repo). None can be exercised against real services from this sandbox — only against fakes. That is the half-verified second phase the task said to avoid.
2. The sandbox was not a clean, single-writer environment (see Provenance note), and a meaningful part of the session went on establishing what was actually true. A single verified phase is the better checkpoint.

## Blockers / Open Items

- 🔴 **`backend/app/core/storage/` is not in the ZIP.** `.gitignore` line 51 `storage/` also matches this Python package, so git never tracked it. A fresh clone fails at import (`ModuleNotFoundError: app.core.storage`). Not changed here (`.gitignore` isn't an owned file). Owner should anchor the ignore rules (`/storage/`, `/backend/storage/`) and commit the package.
- 🟡 **V2 (batch AI evaluation, `POST /exams/{id}/ai-evaluation/run`) is unbuilt** and not assigned to any checklist step.
- 🟡 **Frontend contract mismatch for 5.3:** `MarkingPanel.tsx` (lines 16, 92, 121) and `types.ts` (line 198) use `criterion_marks: Record<string, number>`; backend/schema use a list.
- 🟡 `LLM_PROVIDER=gemini` is still a stub (unchanged from 5.1).
- ℹ️ Answers mapped with `is_attempted=false` are pre-filled by the mapping service with `final_source="system"` (see `sheet_service.py` ~line 427–429). M1/M2 don't special-case them (an examiner could overwrite that 0). The spec is silent; left as is.

## Exact Next Step

**Step 6.1 — Pinecone indexer + retriever + fallback (backend), per `ai-pipeline.md` §6.** Before starting: (a) confirm `app/core/storage/` exists in the working tree and is committed; (b) say explicitly that `pinecone`, a LangChain splitter package and the embedding-provider client are being added to `requirements.txt`; (c) keep standard-mode evaluation independent of Pinecone (rule 2) and keep student answers out of Pinecone (rule 4). The existing `REFERENCE_UNAVAILABLE` fallback in `evaluator_service.py` is where retrieval plugs in. (5.3 is a frontend step; its backend prerequisites V1/V3/M1/M2 are done and in `openapi.json`.)

## What Must NOT Be Repeated

- Don't redo 0.1–5.2. Don't re-implement `is_stale()`, the evaluation upsert, or the guards.
- Don't touch anomalies (7.x) or moderation (8.x) — `final_marks` writes from ModerationService are Phase 8.
- Don't touch frontend files. Don't add the `anthropic`/`google-generativeai` SDKs.
- Run tests as `python -m pytest tests/ -v` (not bare `pytest`).
