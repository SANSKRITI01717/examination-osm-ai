# handoff.md

## What Was Completed — Step 5.2 (Marking service + guards)

The examiner can now decide marks. This is the first place `answers.final_marks` is written (invariant 5).

1. **M1 `POST /api/v1/answers/{id}/evaluation/accept-ai`** — accept the AI suggestion as-is (`source=ai_accepted`). Refused with `409 OCR_NOT_VERIFIED` when OCR needs review and isn't verified, and `409 AI_EVAL_STALE` when the answer text/rubric changed since the suggestion (reuses `is_stale()` from 5.1).
2. **M2 `PUT /api/v1/answers/{id}/evaluation`** — save a draft or submit explicit marks (`ai_modified` / `manual`). Validates `0 ≤ marks ≤ question.max_marks` (`422 MARKS_OUT_OF_RANGE`), 0.5 steps, per-criterion range, and that `criterion_marks` sums to `marks_awarded` (`422 CRITERIA_SUM_MISMATCH`). `ai_modified` requires `ai_evaluation_id`.
3. **On submit:** `evaluations` row → `submitted`; `answers.final_marks`, `final_source="examiner"`, `marking_status` = `marked` (or `flagged` if an open anomaly exists for the answer).
4. Only the **assigned examiner** may call these (admin/moderator → 403). Exam must be in `evaluation` and the answer not `moderated` (`409 ANSWER_LOCKED`).
5. `api-spec.md` §12 has an "Implementation notes" block; `backend/openapi.json` re-exported (additive vs the ZIP: V1, V3, M1, M2 + 9 schemas).

**Stopped at 5.2 on purpose — 6.1 was not started.** See "Why" below.

---

## Files Created / Modified (full paths, relative to repo root)

```
backend/app/services/marking_service.py     NEW
backend/app/schemas/marking.py              NEW
backend/app/api/v1/marking.py               NEW
backend/app/api/v1/__init__.py              MODIFIED  (wired marking_router)
backend/tests/test_marking.py               NEW       (20 tests)
backend/openapi.json                        MODIFIED  (re-exported, additive only)
api-spec.md                                 MODIFIED  (§12 implementation notes)
development-phases.md                       MODIFIED  (5.2 ticked, next-step pointer, open items)
session-state.md                            MODIFIED
handoff.md                                  MODIFIED
```

No frontend files. No new dependencies. No model/migration changes.

**Not part of the deliverable (sandbox-only, do not copy into your repo):** `backend/app/core/storage/` (a labelled stand-in — your real package would be overwritten), `backend/storage/` (test artefacts), `backend/.pytest_cache/`.

---

## Test Results (real runs, this session)

Environment: Linux, Python 3.12, PostgreSQL 16.15, FastAPI 0.141.1, `alembic upgrade head` applied.

| Run | Result |
|---|---|
| Pristine extract of your ZIP (+ storage stand-in): `python -m pytest tests/ -q` | **42 passed** |
| Marking files present, router not wired | 44 passed, **18 failed** (404s) — fixed by wiring |
| Full suite after wiring: `python -m pytest tests/ -v` | **62 passed, 0 failed** (42 old + 20 new) |
| Full suite after removing duplicated router lines | **62 passed, 0 failed** |
| Mutation check (7 mutants of the guards/validation) | **7/7 caught** by their own tests; file restored (md5 identical) |

The 20 new tests cover: accept-ai success (final_marks/final_source/marking_status in the DB, placeholder evaluation reused, AI row untouched, AI alone never writes final marks); OCR-not-verified guard; manual/modified still allowed when OCR unverified; stale guard + recovery after AI re-run; foreign/unknown `ai_evaluation_id`; manual submit; re-submission; draft doesn't write final marks and can't be re-drafted after submit; out-of-range (both ends + boundaries); 0.5 step; criterion-sum mismatch, per-criterion range, unknown and duplicate criterion; `ai_modified` without `ai_evaluation_id`; `ai_accepted` rejected via PUT; missing required fields; unassigned examiner / admin / moderator / no token; 404; exam not in evaluation; moderated answer; `flagged` preserved with an open anomaly.

You said you'd verify on Windows with `python -m pytest tests/ -v` — please do; I could not run on Windows.

---

## ⚠️ Things You Need To Know

1. **Unexpected files in the sandbox.** `marking_service.py`, `schemas/marking.py`, `api/v1/marking.py` and `tests/test_marking.py` were already in the sandbox working directory when I started, but are **not in your ZIP** and I didn't write them. Other unexplained edits appeared during the session (a duplicated router import/`include_router`, a regenerated `openapi.json`, an `api-spec.md` note, and rewritten tracking docs that made claims I hadn't verified). I read every marking file in full, checked them against the spec and invariants, removed the duplicate wiring, re-verified the claims, and mutation-tested the guards — details in `session-state.md` → Provenance note. If you didn't expect these files, please review `marking_service.py` yourself before merging; it's ~300 lines.
2. **`backend/app/core/storage/` is missing from the ZIP.** `.gitignore` line 51 (`storage/`) also matches the Python package, so git never tracked it. On a fresh clone the app fails to import (`No module named 'app.core.storage'`). It exists on your machine (your 42/42 run proves it), so nothing is broken for you locally, but the repo is incomplete. Suggested fix: change the ignore lines to `/storage/` and `/backend/storage/`, then commit `backend/app/core/storage/`. I did **not** change `.gitignore` (not an owned file) and did **not** ship my stand-in.
3. **If M1/M2 ever 404 for you**, check that `app/api/v1/__init__.py` contains exactly one `from app.api.v1.marking import router as marking_router` and one `api_v1_router.include_router(marking_router)`.
4. **V2 (batch AI evaluation) is still unbuilt** and isn't in any checklist step. Needs an owner decision on where it goes.
5. **Frontend contract mismatch (for 5.3):** `frontend/src/components/workspace/MarkingPanel.tsx` sends `criterion_marks` as `{criterion_id: marks}`. The locked schema and the backend use `[{criterion_id, awarded_marks}]`. I followed the locked schema. Gemini should regenerate types from the new `openapi.json` (or file a Contract Request if the map is preferred).
6. **Two judgment calls you may want to overrule** (both in `session-state.md` → Key Decisions): a draft save after submit returns `409 ANSWER_LOCKED`; and `flagged` is preserved by querying the `anomalies` table (which already exists) rather than always writing `marked`.

## Why 6.1 Was Not Started

`instruction.md` §8 (one step per session) plus "when in doubt, stop earlier". 6.1 needs new dependencies (`pinecone`, a LangChain text-splitter, an embedding-provider client) and can't be exercised against real Pinecone/embedding APIs from the sandbox — only against fakes. That's the half-verified second phase the task said to avoid, and the sandbox wasn't a clean single-writer environment. A clean, verified 5.2 is the better checkpoint.

## Exact Next Action

**Step 6.1 — Pinecone indexer + retriever + fallback (backend), per `ai-pipeline.md` §6.** Before starting: confirm `app/core/storage/` is committed; state explicitly which packages are being added to `requirements.txt`; keep standard mode fully independent of Pinecone; never index student answers. The `REFERENCE_UNAVAILABLE` fallback in `evaluator_service.py` is where retrieval plugs in. (Step 5.3 is a frontend step — its backend prerequisites V1/V3/M1/M2 are all done.)

## What Must NOT Be Repeated

- Don't redo 0.1–5.2. Don't reimplement `is_stale()`, the evaluation upsert, or the guards.
- Don't jump to anomalies (7.x) or moderation (8.x).
- Don't touch frontend files; don't add the `anthropic`/`google-generativeai` SDKs.
- Run tests with `python -m pytest tests/ -v`.
