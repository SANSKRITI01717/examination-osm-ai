# handoff.md

## What Was Completed — Step 6.1 (Pinecone indexer + retriever + fallback)

Reference-grounded evaluation is now wired end to end:

1. **RAG adapters** (`backend/app/ai/rag/`): `EmbeddingProvider`/`VectorStore` interfaces (mirrors the `LLMClient`/`OCRProvider` pattern from earlier steps), an OpenAI embeddings client and a Pinecone client — **both called directly via `httpx`, no new SDKs**, plus a dependency-free text chunker and a PDF/DOCX/TXT extractor.

2. **Reference document management** (`backend/app/services/reference_service.py`, `backend/app/api/v1/reference.py`): D1 (upload → background extract/chunk/embed/upsert job), D2 (list with status/chunk_count), D3 (delete doc + its vectors, best-effort on vector-store failure), D5 (debug/preview retrieval). D4 (reindex) is SHOULD HAVE and intentionally skipped.

3. **Retrieval wired into evaluation** (`backend/app/services/evaluator_service.py`): a `reference_grounded` question now actually attempts retrieval — building the query from the question+rubric (never the student's answer), embedding it, searching Pinecone, filtering by `retrieval_min_score`. Three outcomes: chunks found → real reference-grounded evaluation with `ai_evaluations.retrieval` populated; nothing above threshold → falls back to standard with `NO_REFERENCE_FOUND`; embedding/vector-store call fails → falls back to standard with `REFERENCE_UNAVAILABLE`. **A standard-mode question never calls retrieval at all** (there's a regression test specifically for this — it deliberately does NOT mock the retrieval layer, so it would fail loudly with a real network-call error if that ever changed).

---

## Files Created / Modified

```
backend/
├── app/
│   ├── ai/
│   │   └── rag/                          ← NEW package
│   │       ├── __init__.py               ← factories
│   │       ├── base.py                   ← interfaces
│   │       ├── embeddings.py             ← OpenAI via httpx
│   │       ├── pinecone_store.py         ← Pinecone via httpx (⚠️ unverified, see below)
│   │       ├── splitter.py               ← chunking (verified by direct execution)
│   │       ├── extractor.py              ← PDF/DOCX/TXT text extraction
│   │       └── retriever.py              ← query building + retrieval + title resolution
│   ├── api/v1/
│   │   ├── reference.py                  ← NEW: D1, D2, D3, D5 routes
│   │   └── __init__.py                   ← wired reference_router in
│   ├── core/
│   │   └── config.py                     ← added OPENAI_API_KEY setting
│   ├── schemas/
│   │   └── reference.py                  ← NEW: request/response schemas
│   └── services/
│       ├── reference_service.py          ← NEW
│       └── evaluator_service.py          ← mode selection now does real retrieval
├── tests/
│   └── test_reference.py                 ← NEW: 10 integration tests
├── requirements.txt                      ← + python-docx (only new dependency)
└── .env.example                          ← + OPENAI_API_KEY

development-phases.md                     ← 6.1 ticked; next points to 7.1
session-state.md                          ← full detail on this session
handoff.md                                ← this file
```

No frontend files were touched.

---

## Important Decisions

- **Same "direct HTTP, no SDK" pattern as step 5.1's Anthropic client** — applied to both OpenAI embeddings and Pinecone. Keeps the dependency list to exactly one new package (`python-docx`, for DOCX extraction only).
- **The text splitter is a custom word-count chunker, not LangChain.** `ai-pipeline.md` §6 only requires "LangChain use is limited to the text splitter" — it doesn't mandate the actual library. This piece is the one part of 6.1 that was genuinely executed and verified in this session (see Problems/Blockers below for why the rest couldn't be).
- **Reference document upload/delete requires `exam.status == "draft"`**, same rule as question/rubric management. This wasn't explicit in `architecture.md`'s lifecycle table for reference docs specifically, but it's required anyway by the draft→evaluation transition precondition ("every reference_grounded question has ≥1 indexed reference document").
- **Retrieval query is built from question + rubric only, never the student's answer** — exactly per `ai-pipeline.md` §6 point 1, so a wrong or adversarial answer can't steer what gets retrieved.

---

## Problems / Blockers — READ THIS BEFORE TRUSTING THIS STEP

Same sandbox limitation as the 5.1 and 5.2 sessions: **no internet access, no fastapi/sqlalchemy/pytest/psycopg installed, no Postgres.** This step has one additional, more serious risk on top of that:

- ⚠️ **The Pinecone REST integration (`pinecone_store.py`) has never made a real network call, and its exact request/response contract could not be checked against live Pinecone documentation.** The header names (`X-Pinecone-API-Version`, `Api-Key`) and the control-plane `describe_index` → `host` field are written from training-data knowledge and may be stale. If wrong, the practical effect is **not a crash** — every call is wrapped so a failure raises `RagError`, which the evaluator catches and turns into a graceful `REFERENCE_UNAVAILABLE` fallback to standard mode. So the app stays safe either way, but reference-grounded evaluation may silently never actually retrieve anything until someone verifies this against a real Pinecone index with real credentials.
- ⚠️ **OpenAI embeddings likewise never made a real call.** Same fail-safe wrapping applies.
- ✅ **What WAS verified by actual execution:** the text splitter (`splitter.py`) — 7 assertions, run directly with plain `python3`, all passed. It has zero framework/network dependencies.
- ✅ **What was checked statically:** every file compiles (`py_compile`), and every cross-reference (model fields, existing service patterns, the `job_runner.submit_job` signature, `StorageService` interface) was manually verified against the actual code already in this repo.
- ⚠️ **`test_reference.py` (10 tests) was written to the same style as `test_evaluation.py`/`test_marking.py`** — both of which the previous session confirmed passing for real (62/62) — but has itself never been run.

**Before starting step 7.1, please: run `python -m pytest tests/ -v` in a real environment, and — if you have a spare few minutes — put real `OPENAI_API_KEY` and `PINECONE_API_KEY` values in `.env`, upload one small reference document through the UI or API, and check whether `reference_documents.status` actually reaches `indexed` rather than `failed`. That single manual check would resolve the biggest open risk in this codebase right now.**

---

## Exact Next Action for the Next Session

**Step 7.1 — Anomaly detectors + runner (backend).** Full detail (files, detector list, structure) is in `session-state.md`'s "Exact Next Step" section. In short: pure-function detectors for the 6 MVP anomaly types, a runner that upserts `anomalies` rows idempotently via `dedupe_key`, and the AN1/AN2/AN3 endpoints. Also worth resolving alongside it: **V2 (batch AI evaluation)** is still not built from step 5.1 — it's a natural fit to add here since both are background-job patterns.

## What Must NOT Be Repeated

- Don't redo 0.1 through 6.1 — all done.
- Don't jump to moderation (8.x), results/analytics (9.x), or anything past 7.1/V2.
- Don't add the `pinecone` or `openai` SDKs — keep the httpx-direct pattern, unless a real test run proves it's genuinely necessary.
- Don't touch frontend files.
- Don't skip running the actual test suite before building anomaly detection on top of this step's (unverified-live) evaluator changes.
- Don't assume the Pinecone integration "works" just because it compiles and the tests-as-written would pass with fakes — it has never touched a real Pinecone instance. Verify with real credentials if at all possible.
