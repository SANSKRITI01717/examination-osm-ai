# session-state.md

## Current Session

| Field | Value |
|---|---|
| Phase / Step | Phase 6 / Step 6.1 |
| Status | ✅ COMPLETE (code + tests written; live network calls UNVERIFIED — see Blockers) |
| Last completed step | 6.1 Pinecone indexer + retriever + fallback (backend) |
| Agent | Claude (backend implementation for this step, per updated ownership in instruction.md) |

## Files Created / Changed

| File | Action |
|---|---|
| `backend/app/ai/rag/base.py` | Created — `EmbeddingProvider`/`VectorStore` interfaces, `RagError`, `VectorRecord`/`RetrievedChunk` dataclasses |
| `backend/app/ai/rag/embeddings.py` | Created — `OpenAIEmbeddingProvider` via direct `httpx` call (no `openai` SDK added) |
| `backend/app/ai/rag/pinecone_store.py` | Created — `PineconeStore` via direct `httpx` REST calls (no `pinecone` SDK added). **UNVERIFIED against a live Pinecone instance — see Blockers.** |
| `backend/app/ai/rag/splitter.py` | Created — pure-Python word-count chunker (~450 words / 60 overlap ≈ 600 tokens / 80 overlap), no LangChain dependency |
| `backend/app/ai/rag/extractor.py` | Created — text extraction: PDF via PyMuPDF (already a dep), DOCX via `python-docx` (new dep), TXT via decode |
| `backend/app/ai/rag/retriever.py` | Created — `retrieve_chunks()`: builds query from question+rubric (never the student answer), embeds, queries, filters by `retrieval_min_score`, resolves titles from Postgres |
| `backend/app/ai/rag/__init__.py` | Created — `get_embedding_provider()` / `get_vector_store()` factories |
| `backend/app/schemas/reference.py` | Created — schemas for D1/D2/D5 |
| `backend/app/services/reference_service.py` | Created — D1 (upload + background index job), D2 (list), D3 (delete doc + vectors), D5 (search/preview) |
| `backend/app/api/v1/reference.py` | Created — router for D1, D2, D3, D5 (D4/reindex is SHOULD HAVE, not built) |
| `backend/app/api/v1/__init__.py` | Updated — wired `reference_router` in |
| `backend/app/services/evaluator_service.py` | Updated — mode-selection block now actually attempts retrieval via `retrieve_chunks()` instead of always falling back; `ai_evaluations.retrieval` is now populated with real chunk data when reference-grounded mode succeeds |
| `backend/app/core/config.py` | Updated — added missing `OPENAI_API_KEY` setting |
| `backend/.env.example` | Updated — added `OPENAI_API_KEY=` |
| `backend/requirements.txt` | Updated — added `python-docx>=1.1.0` (the only new dependency) |
| `backend/tests/test_reference.py` | Created — 10 integration tests covering D1 (success + unsupported file + indexing failure), D2, D3, D5 (empty + success), and the evaluator's reference-grounded / NO_REFERENCE_FOUND / REFERENCE_UNAVAILABLE / standard-never-calls-retrieval paths |

## Tests & Checks Run

| Check | Result |
|---|---|
| `python3 -m py_compile` on all 14 new/changed backend files | ✅ PASS — all compile cleanly |
| Standalone execution of `splitter.py`'s chunking logic (7 hand-written assertions: empty input, short text, long-text multi-chunk, word-count bound, no-data-loss at boundaries, overlap between consecutive chunks) | ✅ PASS — all 7 assertions passed, executed directly in this session |
| Static cross-check of every new file against actual existing models/services/patterns in the repo (not assumed from docs) | ✅ Done |
| Grep sweep: confirmed no new file touches `answers.final_marks`, and `reference_service.py` never reads `ocr_text`/`verified_text` (student answers never reach embeddings/Pinecone, per invariant 4/11) | ✅ PASS |
| `pytest tests/test_reference.py` and full suite, against a live Postgres DB | ⚠️ **NOT RUN HERE** — same sandbox limitation as prior sessions (no internet, no fastapi/sqlalchemy/pytest/psycopg, no Postgres). Written to match the exact fixture/mocking style of `test_evaluation.py` and `test_marking.py`, both of which the *previous* session confirmed passing for real. **Run `python -m pytest tests/ -v` in a real environment before trusting this step.** |
| Real OpenAI embeddings call | ❌ **NEVER TESTED — no internet access, no API key available in this sandbox.** |
| Real Pinecone control-plane/data-plane calls | ❌ **NEVER TESTED — same reason.** The exact header names and response shape (`X-Pinecone-API-Version`, control-plane `describe_index` returning `host`) were written from training-data knowledge of Pinecone's REST API and could be stale. |

## Key Decisions

| Decision | Reason |
|---|---|
| OpenAI embeddings called directly via `httpx`, not the `openai` SDK | Same anti-overengineering rationale as the Anthropic LLM client in step 5.1 |
| Pinecone called directly via its REST API via `httpx`, not the `pinecone` SDK | Same rationale — but see the explicit unverified-warning in `pinecone_store.py`'s docstring |
| Text splitting is a custom ~30-line word-count chunker, not LangChain's `RecursiveCharacterTextSplitter` | `ai-pipeline.md` only requires "LangChain use is limited to the text splitter" — it doesn't mandate the library itself. Avoids adding a dependency, and this piece **was** verified by direct execution (unlike the network-calling pieces) |
| One new dependency: `python-docx` | Needed for DOCX text extraction; PDF reuses the already-present PyMuPDF, TXT needs nothing |
| Reference document upload/delete (D1/D3) only allowed while `exam.status == "draft"` | Not explicitly stated for reference docs in `architecture.md` §5's table; matches the exact rule already used for question/rubric management (`question_service.py`), and is required anyway since the draft→evaluation transition precondition checks reference docs are indexed before that transition can happen |
| Retrieval query text = question text + rubric criterion names/descriptions, **never** the student's answer | Exactly as specified in `ai-pipeline.md` §6 point 1 — prevents an off-topic or adversarial answer from steering retrieval |
| `RagError` from either the embedding call or the vector-store call is caught in `evaluator_service.py` and produces `REFERENCE_UNAVAILABLE`; an empty/below-threshold result produces `NO_REFERENCE_FOUND` — both fall back to standard mode, never block | Exact fallback logic from `architecture.md` §7 and `ai-pipeline.md` §6 step 4 |
| Chunk deletion on document delete (D3) is best-effort — a `RagError` during `delete_by_doc` is swallowed so the DB row still gets deleted | An orphaned vector in Pinecone is a much smaller problem than being unable to delete a reference document at all when the vector store happens to be unreachable |
| Pinecone metadata does **not** include a `title` field (matches `database-schema.md` §5's metadata list exactly: exam_id, doc_id, question_id, doc_type, chunk_index, text) | Titles are resolved via a Postgres join in `retriever.py`/`reference_service.py` instead, keeping Pinecone as pure vector storage |

## Blockers

- **No live test execution possible in this session's environment** (same as steps 5.1/5.2's sessions) — no internet, no Python packages beyond stdlib + PyJWT/Pillow, no Postgres. Code is syntax-checked and carefully cross-referenced against the real repo, and the one piece with zero network/framework dependency (the text splitter) was executed and verified directly. Everything that talks to OpenAI or Pinecone has **never made a real network call**.
- **The Pinecone REST contract is the single biggest risk in this step.** If Anthropic's/OpenAI's REST shape was even slightly wrong it would have been embarrassing but low-stakes (caught immediately by 5.1's real test run). If Pinecone's control-plane/data-plane shape is wrong, reference-grounded evaluation will *silently* always fall back to standard mode (via `REFERENCE_UNAVAILABLE`) rather than erroring loudly — which is the correct fail-safe behavior, but means a broken integration could go unnoticed unless someone specifically tests it with real credentials. **Please do this before trusting 6.1 as "working," not just "non-breaking."**
- `OPENAI_API_KEY` and `PINECONE_API_KEY` need real values in `.env` for any of this to do anything beyond fallback.

## Exact Next Step

**Step 7.1 — Anomaly detectors + runner (backend)**, per `ai-pipeline.md` §10 and `database-schema.md`'s `anomalies` table.

1. `backend/app/ai/anomaly/detectors.py`: one pure function per MVP detector (`UNCHECKED_ANSWER`, `MISSING_MARKS`, `TOO_FAST`, `QUESTION_OUTLIER`, `EXAMINER_DEVIATION`, `AI_DISAGREEMENT`), each taking already-fetched data and returning candidate anomaly dicts — keep these dependency-free (like `validator.py`/`splitter.py`) so they can be unit-tested directly, the same way this session's splitter tests were actually executed.
2. `backend/app/ai/anomaly/runner.py`: loads the exam's answers/evaluations/marks, calls each detector (skipping any below `min_sample_size`, default 10), upserts `anomalies` rows keyed by `dedupe_key` so re-runs are idempotent.
3. `backend/app/services/anomaly_service.py` + `backend/app/api/v1/anomalies.py`: AN1 (`POST /exams/{id}/anomalies/detect`), AN2 (list), AN3 (dismiss/reopen).
4. Also resolve the still-open **V2 (batch AI evaluation)** item noted above — natural to build alongside this step since both are background-job patterns (`job_runner.py` already exists from step 4.1).
5. `backend/tests/test_anomalies.py`.

## What Must NOT Be Repeated

- Do not re-implement 0.1–6.1 — done.
- Do not build moderation (8.x), full results/analytics (9.x), or anything past 7.1/V2 in the next session.
- Do not add the `pinecone` or `openai` SDKs as dependencies — keep the `httpx`-direct pattern established across 5.1 and 6.1, unless a real test run against live Pinecone shows the REST contract genuinely needs the SDK's help (unlikely, but if so, say so explicitly).
- Do not touch frontend files.
- **Before building anomaly detection on top of AI-disagreement data, run the actual test suite (`python -m pytest tests/ -v`) in a real environment and, ideally, verify the Pinecone/OpenAI calls with real credentials.** This was not possible in the session that wrote this file. If 6.1's tests fail in a real run, fix that before starting 7.1 — don't build detectors on top of an unverified evaluator change.
