# LearnLyte — AI Study Platform (full technical spec)

LearnLyte is the education vertical of the platform: a library of study resources
(past papers, specimen papers, marking schemes, textbooks) plus an AI study
assistant that can read a PDF, chat about it, extract every exam question from
it, let the student answer, and then mark those answers with feedback and a
score. Every AI action is metered against the shared **AI credits** system.

Current state: backend is fully live (tables, RLS, storage bucket, edge
function, credit metering, result cache). The web app under `src/` has **no**
LearnLyte screens — the feature is consumed by the mobile clients / direct API
calls. 57 subjects are seeded; 4 resources, 2 bookmarks, 6 saved chats and 9
cached AI results exist in the database today.

---

## 1. Feature map

| Feature | How it works |
| --- | --- |
| Curriculum browsing | `learnlyte_subjects` seeded with 57 subject rows across 8 curriculum levels. Client filters by `level`, then lists subjects. |
| Resource library | `learnlyte_resources` rows point at a file in the public `learnlyte-resources` storage bucket. Filterable by subject, level, resource type and year. |
| Uploads (community) | Any authenticated user uploads a file to the bucket and inserts a resource row with `uploaded_by = auth.uid()`. Only the uploader can edit/delete it. |
| Download counter | `public.increment_download_count(resource_id uuid)` (SECURITY DEFINER, SQL) bumps `download_count` — clients call it as an RPC on open/download so no direct write privilege is needed. |
| Bookmarks | `learnlyte_bookmarks` — one row per (user, resource), unique constraint prevents duplicates. Private per user. |
| AI study chat | Streaming chat grounded in the resource's extracted text/images. Markdown + LaTeX answers. |
| Saved chats | `learnlyte_ai_chats` stores the whole conversation as a `messages` jsonb array, one row per (user, resource) thread. |
| Exam question extraction | `action: "extract-questions"` parses the paper into structured JSON questions (MCQ / short answer / essay) preserving LaTeX, markdown tables, code blocks and diagram hints. |
| AI marking | `action: "mark-answers"` marks the student's answers against the paper: per-question correctness, model answer, explanation, marks, and an overall score. |
| Result cache | `learnlyte_ai_cache` — SHA-256 keyed cache of extract/mark results, checked **before** the file download and **before** any credit charge, so repeat runs on the same paper are free and instant. |
| Credit metering | Every live model call charges the signed-in user via `ai_consume_credits`; first 10 lifetime AI actions per account are free. |

---

## 2. Database

### 2.1 Enums

`public.learnlyte_level`
```
grade_seven, o_level, a_level,
cambridge_primary, cambridge_lower_secondary, cambridge_igcse,
cambridge_o_level, cambridge_as_a
```

`public.learnlyte_resource_type`
```
textbook, past_paper, specimen_paper, marking_scheme
```

### 2.2 `public.learnlyte_subjects`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text NOT NULL | e.g. "Mathematics" |
| `slug` | text NOT NULL | URL key, e.g. `mathematics` |
| `level` | learnlyte_level NOT NULL | curriculum level |
| `icon` | text | default `'book-outline'` (Ionicons name used by mobile) |
| `created_at` | timestamptz NOT NULL | `now()` |

- UNIQUE `(slug, level)` — the same subject slug can exist once per level.
- RLS: `learnlyte_subjects_read` — SELECT to `authenticated`, `USING (true)`.
  Read-only catalog; seeded/maintained server-side.
- Seeded contents (57 rows):
  - **grade_seven**: English, Mathematics, Science, Shona, Social Studies, Religious Education
  - **o_level**: English Language, Mathematics, Biology, Chemistry, Physics, Geography, History, Accounting, Economics, Computer Science
  - **a_level**: Mathematics, Biology, Chemistry, Physics, Geography, History, Accounting, Economics, Computer Science, English Literature
  - **cambridge_primary**: English, Mathematics, Science, Global Perspectives
  - **cambridge_lower_secondary**: English, Mathematics, Science, Geography, History
  - **cambridge_igcse**: English, Mathematics, Biology, Chemistry, Physics, Economics, Business Studies, Computer Science
  - **cambridge_o_level**: English Language, Mathematics, Biology, Chemistry, Physics, Accounting, Economics
  - **cambridge_as_a**: Mathematics, Biology, Chemistry, Physics, Economics, Business, Computer Science

### 2.3 `public.learnlyte_resources`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `title` | text NOT NULL | display name of the paper/book |
| `subject_id` | uuid NOT NULL | FK → `learnlyte_subjects(id)` ON DELETE CASCADE |
| `level` | learnlyte_level NOT NULL | denormalised for direct level filtering |
| `resource_type` | learnlyte_resource_type NOT NULL | textbook / past_paper / specimen_paper / marking_scheme |
| `year` | integer NULL | exam year (papers only) |
| `description` | text NULL | free text |
| `file_url` | text NOT NULL | public URL in the `learnlyte-resources` bucket (what the AI function downloads) |
| `file_type` | text NOT NULL | default `'pdf'`; also `image/*`, `text/*` |
| `file_size` | integer NOT NULL | bytes, default 0 |
| `uploaded_by` | uuid NULL | FK → `auth.users(id)` ON DELETE SET NULL |
| `uploader_name` | text NULL | display credit that survives account deletion |
| `download_count` | integer NOT NULL | default 0, bumped by RPC |
| `created_at` | timestamptz NOT NULL | `now()` |

RLS (all to `authenticated`):
- `learnlyte_resources_read` — SELECT `USING (true)` (library is shared).
- `learnlyte_resources_insert` — INSERT `WITH CHECK (uploaded_by = auth.uid())`.
- `learnlyte_resources_update` — UPDATE own rows only.
- `learnlyte_resources_delete` — DELETE own rows only.

### 2.4 `public.learnlyte_bookmarks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | owner (`auth.uid()`) |
| `resource_id` | uuid NOT NULL | FK → `learnlyte_resources(id)` ON DELETE CASCADE |
| `created_at` | timestamptz NOT NULL | `now()` |

- UNIQUE `(user_id, resource_id)` — idempotent "save" via upsert.
- RLS: `learnlyte_bookmarks_read` (SELECT own), `learnlyte_bookmarks_insert`
  (INSERT `user_id = auth.uid()`), `learnlyte_bookmarks_delete` (DELETE own).
  No UPDATE policy — bookmarks are add/remove only.

### 2.5 `public.learnlyte_ai_chats`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | owner |
| `resource_id` | uuid NOT NULL | FK → `learnlyte_resources(id)` ON DELETE CASCADE |
| `messages` | jsonb NOT NULL | default `'[]'`; array of `{ role, content }` in OpenAI chat shape |
| `created_at` | timestamptz NOT NULL | `now()` |

- The client owns the transcript: it appends the user turn and the streamed
  assistant reply, then UPDATEs `messages` for the thread row.
- RLS — two overlapping generations of policies exist (both scope to the owner,
  so behaviour is identical; the newer set is `authenticated`-scoped):
  - `learnlyte_ai_chats_read` / `_insert` / `_update` → role `authenticated`.
  - `learnlyte_chats_select_own` / `_insert_own` / `_update_own` /
    `_delete_own` → role `public`, `auth.uid() = user_id`. DELETE is only
    available through this older set.

### 2.6 `public.learnlyte_ai_cache`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `cache_key` | text NOT NULL UNIQUE | `extract:<sha256>` or `mark:<sha256>` |
| `kind` | text NOT NULL | `extract-questions` \| `mark-answers` (indexed: `learnlyte_ai_cache_kind_idx`) |
| `result` | jsonb NOT NULL | the exact JSON payload returned to the client |
| `hits` | integer NOT NULL | default 0, best-effort bump on each cache hit |
| `last_used_at` | timestamptz NOT NULL | `now()`, refreshed on write |
| `created_at` | timestamptz NOT NULL | `now()` |

- `GRANT ALL … TO service_role` only; RLS on with a single
  `service role manages ai cache` FOR ALL policy. Clients can never read it —
  the edge function accesses it over PostgREST with the service-role key.

### 2.7 Storage

Bucket `learnlyte-resources` — **public**. Policies (in `storage.objects`) are
scoped by `bucket_id = 'learnlyte-resources'`:
`learnlyte_storage_read` (SELECT), `learnlyte_storage_write` (INSERT),
`learnlyte_storage_delete` (DELETE). Public read is required because the edge
function fetches `file_url` with a plain unauthenticated `fetch`.

### 2.8 Database functions

```sql
public.increment_download_count(resource_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER
-- UPDATE learnlyte_resources SET download_count = download_count + 1 WHERE id = resource_id;
```

No triggers exist on any LearnLyte table.

---

## 3. Edge function `learnlyte-ai`

File: `supabase/functions/learnlyte-ai/index.ts` (507 lines). Public CORS
(`*`), JWT taken from the `Authorization` header for credit metering.

### 3.1 Request body

```ts
{
  messages?: { role: "user" | "assistant"; content: string }[], // chat mode
  fileUrl?: string,          // resource file_url — downloaded and parsed
  resourceTitle?: string,
  resourceType?: string,
  resourceLevel?: string,
  action?: "extract-questions" | "mark-answers",   // omit for chat
  questions?: unknown,       // mark-answers: the extracted questions array
  answers?: unknown          // mark-answers: student's answers keyed by number
}
```

### 3.2 Pipeline (exact order)

1. `OPTIONS` → CORS preflight 204.
2. Parse body; require `LOVABLE_API_KEY` (server secret) or throw.
3. **Cache key** built before any I/O, from a *stable* (key-sorted) JSON
   serialisation hashed with SHA-256:
   - extract: `extract:sha256({ fileUrl, resourceTitle, resourceType, resourceLevel })`
   - mark: `mark:sha256({ fileUrl, resourceTitle, questions, answers })`
   - chat: no cache (streaming, conversational).
4. **Cache lookup** via PostgREST `?cache_key=eq.…&select=result,hits`. On hit:
   return the stored JSON with header `X-Cache: HIT`, bump `hits` fire-and-forget,
   **charge nothing**. On miss log `cache MISS` and continue (`X-Cache: MISS`).
5. **Charge credits** — `chargeAiCredits(req, feature, { reference: fileUrl })`
   from `supabase/functions/_shared/ai-credits.ts`, where feature is
   `extract_questions`, `mark_answers`, or `learnlyte_chat`. Any failure short-
   circuits with that helper's status/body (401 `auth_required`,
   402 `insufficient_ai_credits`, 500 `credit_check_failed`).
6. **Build context** — a header block with `Resource / Type / Level`, then file
   content if `fileUrl` was supplied:
   - PDF (content-type contains `pdf` or URL ends `.pdf`): `npm:unpdf@0.12.1`
     `getDocumentProxy` + `extractText({ mergePages: false })`; first **40
     pages**, whitespace-collapsed, joined as `--- Page N ---` blocks, capped at
     **50 000 chars**. Empty extraction returns an explicit
     "scanned/image-only document" note so the model doesn't hallucinate.
   - image/*: converted to a base64 `data:` URL and passed as a vision
     `image_url` part (chunked base64 encoding to avoid stack overflow).
   - text/* or json: decoded, capped at 50 000 chars.
   - anything else / fetch failure: a descriptive placeholder string.
7. **Model call** — Lovable AI Gateway
   `https://ai.gateway.lovable.dev/v1/chat/completions`, model
   `google/gemini-3-flash-preview`, `Authorization: Bearer LOVABLE_API_KEY`.
   - `extract-questions`: `stream: false`, `response_format: json_object`,
     `max_tokens: 16000`, `EXTRACT_PROMPT` system prompt (+ vision parts).
   - `mark-answers`: same settings with `MARK_PROMPT`; the user turn embeds
     `JSON.stringify(questions)` and `JSON.stringify(answers)`.
   - chat (default): `SYSTEM_PROMPT` + resource context, `stream: true`; the
     raw SSE body is piped straight back as `text/event-stream`. When images are
     present, up to **5** of them are attached to the last user message.
8. **Parse & cache** — JSON parsed directly, falling back to a `\{[\s\S]*\}`
   regex slice for models that wrap output in prose. Results are only cached
   when they look valid (`questions` non-empty array / `results` array).
9. **Errors** — 429 "Rate limit reached…", 402 "AI credits exhausted…",
   otherwise logged and returned as 500 with a short message.

### 3.3 Prompts

- `SYSTEM_PROMPT` — "LearnLyte AI, a study assistant": summarise resources,
  generate practice questions/quizzes, explain concepts, study tips, markdown
  formatting, LaTeX (`$x^2+y^2=r^2$`), fenced code blocks, markdown tables;
  answers must be grounded in the supplied resource context.
- `EXTRACT_PROMPT` — exam paper analyser. Returns strictly
  `{ questions: [...] }` where each item is
  `{ number, type: "mcq"|"short_answer"|"essay", question, options?: {A,B,C,D,…}, maxMarks?, imageHint? }`.
  Rules: preserve LaTeX / markdown tables / code blocks, describe diagrams and
  graphs inside the question text, number sequentially while noting sections
  ("Section A, Question 1: …"), split sub-parts (a)(b)(c) into separate
  questions carrying the parent context, and return `{"questions": []}` when
  nothing is extractable.
- `MARK_PROMPT` — exam marker. Returns
  `{ results: [{ number, type, studentAnswer, correctAnswer, correct, marks?, maxMarks?, explanation }], score, totalMarks, completedQuestions, totalQuestions }`.
  Rules: only mark answered questions; verify mathematical working and accept
  equivalent forms with partial credit for method; lenient on diagram
  descriptions; check code logic and accept equivalent algorithms unless a
  language is specified; verify table data reading; generous partial credit on
  essays; MCQ compared by letter with `maxMarks = 1` default; `correctAnswer`
  must be a full model answer and `explanation` must teach *why*.

---

## 4. AI credit metering (shared with the rest of the platform)

`supabase/functions/_shared/ai-credits.ts`
- `getCaller(req)` — anon client with the caller's `Authorization` header →
  `auth.getUser()`.
- `chargeAiCredits(req, feature, { reference, quantity })` — service-role RPC
  `ai_consume_credits`. Returns `{ ok, charged, balance, source, trialRemaining }`
  or a ready-to-send error body.
- `refundAiCredits(userId, feature, credits, reference)` — restores balance and
  writes a `refund` ledger row when a downstream model call fails.

`public.ai_consume_credits(_user_id, _feature, _reference, _quantity)`
(SECURITY DEFINER, revoked from `anon`/`authenticated`):
1. `ai_credits_account(_user_id)` — auto-creates the account row and, when
   `plan_renews_at <= now()`, adds the plan's `monthly_credits`, pushes
   `plan_renews_at` a month out, and logs a `plan_renewal` ledger row.
2. Looks up cost = `ai_feature_costs.credits × max(quantity, 1)`; unknown
   feature raises.
3. **Free trial**: while `trial_used < 10`, increments `trial_used`, logs a
   `free_trial` ledger row with `delta = 0`, returns `source: "trial"`.
4. Else if `balance < cost` → `{ ok: false, error: "insufficient_ai_credits", required, balance, feature }`.
5. Else deduct, add to `lifetime_credits_spent`, log a `spend` ledger row,
   return `source: "balance"`.

Supporting tables: `ai_plans`, `ai_credit_packs`, `ai_feature_costs`
(public read catalogs), `ai_credit_accounts` (own row readable),
`ai_credit_ledger` (own rows readable). Purchases run through
`ai_buy_credit_pack` / `ai_subscribe_plan`, which debit the wallet via
`apply_wallet_transaction(..., 'personal')`.

### 4.1 Live pricing

Plans — `ai_plans`

| code | name | USD/mo | credits/mo | blurb |
| --- | --- | --- | --- | --- |
| `free` | Starter | 0 | 0 | 10 free AI actions to try everything, then top up. |
| `plus` | Plus | 9.99 | 600 | For everyday sellers using Tapson and AI ads. |
| `pro` | Pro | 29.99 | 2 200 | For power sellers running ads and bulk imports. |
| `business` | Business | 79.99 | 6 500 | For teams and high-volume AI workloads. |

Packs — `ai_credit_packs` (never expire)

| code | name | credits | USD | bonus |
| --- | --- | --- | --- | --- |
| `pack_250` | Small | 250 | 5 | — |
| `pack_600` | Medium | 600 | 10 | +20% bonus |
| `pack_1600` | Large | 1 600 | 25 | +28% bonus |
| `pack_4000` | Bulk | 4 000 | 55 | +45% bonus |

Feature costs — `ai_feature_costs`

| feature | label | credits | notes |
| --- | --- | --- | --- |
| `learnlyte_chat` | Study assistant reply | 2 | PDF-aware chat turn |
| `extract_questions` | Extract exam questions | 15 | Full paper parse |
| `mark_answers` | Mark answers | 15 | Full paper marking |
| `tapson_chat` | Tapson AI reply | 1 | Shopping assistant message |
| `semantic_search` | Smart search | 1 | Embedding + vector search |
| `image_search` | Search by photo | 2 | Vision keyword extraction |
| `generate_ad` | AI product ad | 20 | Rewrites copy + reel flag |

Because extract + mark are the two expensive calls (15 credits each), the
`learnlyte_ai_cache` hit path is what keeps a class of students re-opening the
same past paper from costing 15 credits per person: the first student pays, the
rest get a cached, uncharged `X-Cache: HIT`.

---

## 5. End-to-end flows

### 5.1 Browse → open a resource
1. Read `learnlyte_subjects` filtered by `level`.
2. Read `learnlyte_resources` filtered by `subject_id` / `level` /
   `resource_type` / `year`.
3. Open `file_url` (public bucket) and call
   `rpc('increment_download_count', { resource_id })`.
4. Optional upsert into `learnlyte_bookmarks`.

### 5.2 Study chat
1. POST `learnlyte-ai` with the user's JWT, `messages`, `fileUrl` and the
   resource metadata.
2. Function charges 2 credits (or a free trial slot), extracts the PDF text,
   streams Gemini's markdown/LaTeX reply as SSE.
3. Client renders the stream and persists the updated transcript into
   `learnlyte_ai_chats.messages` for that (user, resource) row.

### 5.3 Practice a past paper
1. POST `{ action: "extract-questions", fileUrl, resourceTitle, resourceType, resourceLevel }`.
   → cache hit (free) or 15 credits + structured `{ questions: [...] }`.
2. Client renders each question by `type` (MCQ options, short answer box, essay
   box), showing `imageHint` next to the paper's diagrams and rendering LaTeX,
   markdown tables and code blocks.
3. Student answers; client collects `answers` keyed by question `number`.
4. POST `{ action: "mark-answers", fileUrl, resourceTitle, questions, answers }`.
   → cache hit (free) or 15 credits + `{ results, score, totalMarks, completedQuestions, totalQuestions }`.
5. Client shows the score, per-question correctness, model answers and
   explanations.

---

## 6. Error contract for clients

| Status | Body `code` / message | Meaning |
| --- | --- | --- |
| 401 | `auth_required` | No/invalid JWT — the caller must be signed in (send the user access token, not the publishable key; see `src/lib/aiAuth.ts`). |
| 402 | `insufficient_ai_credits` (+ `required`, `balance`, `feature`) | Out of credits — send the user to the AI credits screen. |
| 402 | "AI credits exhausted…" | Gateway-level credit exhaustion (workspace side). |
| 429 | "Rate limit reached…" | Gateway rate limit — retry with backoff. |
| 500 | `credit_check_failed` | `ai_consume_credits` RPC failed. |
| 500 | "Failed to extract questions" / "Failed to mark answers" / "Failed to parse marking results" / "AI gateway error" | Model or parsing failure. |

Response headers: `X-Cache: HIT|MISS` on the JSON (non-streaming) actions.

---

## 7. Known gaps / next steps

- **No web UI.** Nothing in `src/` references LearnLyte; the vertical is not in
  `App.tsx` routes, `public/sitemap.xml` or `public/llms.txt`.
- **No refund on LearnLyte failures.** `refundAiCredits` exists but
  `learnlyte-ai` does not call it, so a 15-credit extract that fails at the
  gateway is still charged.
- **Duplicate RLS policy sets** on `learnlyte_ai_chats` (two generations, same
  effect) — worth consolidating.
- **No `(user_id, resource_id)` unique constraint** on `learnlyte_ai_chats`, so
  duplicate threads for the same resource are possible.
- **Scanned papers** are not OCR'd when delivered as PDFs — only image uploads
  reach the vision path.
- **40-page / 50 000-char caps** silently truncate very long textbooks.
- **Cache never evicts**; `hits` / `last_used_at` are tracked but unused.
