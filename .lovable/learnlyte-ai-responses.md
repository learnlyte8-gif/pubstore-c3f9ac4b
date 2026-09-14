# LearnLyte AI — Responses & Learning Presentation Spec

Companion to `.lovable/learnlyte.md` (data model + infrastructure). This document
covers **only** what the AI says, in what shape it says it, and how each response
must be displayed so a student can learn from it smoothly.

Backend: `supabase/functions/learnlyte-ai/index.ts`, model
`google/gemini-3-flash-preview` via the Lovable AI gateway. Every response is
grounded in a `RESOURCE CONTEXT` block built from the resource metadata plus the
extracted file text (up to 50 000 chars, up to 40 PDF pages) and, for images,
the file itself passed to the vision model (max 5 images per chat turn).

---

## 1. The three response modes

| Mode | Request | Transport | Response shape |
| --- | --- | --- | --- |
| Study chat | `{ messages, fileUrl, resourceTitle, resourceType, resourceLevel }` | SSE stream (`text/event-stream`) | Markdown + LaTeX prose, token by token |
| Question extraction | `{ action: "extract-questions", fileUrl, resourceTitle, resourceType, resourceLevel }` | Single JSON | `{ questions: [...] }` |
| Answer marking | `{ action: "mark-answers", fileUrl, resourceTitle, questions, answers }` | Single JSON | `{ results: [...], score, totalMarks, completedQuestions, totalQuestions }` |

Both JSON modes are requested with `response_format: json_object`,
`max_tokens: 16000`, and are parsed defensively (direct `JSON.parse`, then a
`/\{[\s\S]*\}/` fallback). Extraction never errors — a failed parse returns
`{ questions: [] }`. Marking returns HTTP 500 with
`{ error: "Failed to parse marking results" }`.

Cache: `extract:` / `mark:` keys are SHA-256 of the stable-stringified inputs,
checked **before** the file download and **before** any credit charge. Responses
carry `X-Cache: HIT|MISS`; a HIT is free and instant, and clients should show the
result immediately with no "thinking" state.

---

## 2. Study chat responses

### 2.1 What the AI is instructed to do
- Summarise the resource concisely.
- Generate practice questions and quizzes on request.
- Explain key concepts and topics; break complex topics into simple terms.
- Give study tips and strategies.
- Stay grounded in the supplied resource content — never invent paper content.
- Be concise, friendly, educational.

### 2.2 Formatting contract
- **Markdown** — headers, bold, bullet and numbered lists, tables.
- **LaTeX** — `$...$` inline, `$$...$$` block for every mathematical expression.
- **Code** — fenced blocks with a language tag.
- **Tables** — markdown table syntax.

### 2.3 Streaming display rules
1. Append the user's message immediately, then insert an empty assistant bubble.
2. Parse SSE line by line: skip blank lines and `:` comments, only handle
   `data: ` lines, stop on `data: [DONE]`, read
   `choices[0].delta.content` and append. Ignore per-line parse errors —
   partial chunks arrive mid-JSON.
3. Render the growing markdown live, but **do not** render an unbalanced LaTeX or
   code fence: buffer from an opening `$$`/```` ``` ```` until its closing pair,
   showing a subtle shimmer placeholder so the student never sees raw syntax.
4. Autoscroll to bottom on each delta unless the student has scrolled up.
5. Show "LearnLyte is reading your paper…" while the first token is pending —
   PDF download plus extraction happens before the model call, so first-token
   latency on a large paper is seconds, not milliseconds.
6. Keep a copy button per assistant message and a "Regenerate" affordance.

### 2.4 Error copy (map status → student-facing text)
| Status | Message to show |
| --- | --- |
| 400 (`messages` empty) | "Type a question to start." |
| 401 `auth_required` | "Sign in to use AI study help." |
| 402 | "AI credits used up — top up to keep studying." |
| 429 | "LearnLyte is busy. Try again in a moment." |
| 500 | "Something went wrong reading this resource. Try again." |
| stream drops | Keep the partial answer visible, append "(connection lost)" and offer Retry. |

If the PDF was image-only, extraction returns
`(No extractable text found in this PDF — it looks like a scanned/image-only document.)`
Surface this once as an inline notice ("This paper is a scan — answers come from
reading the page images") rather than as an error.

---

## 3. Question extraction responses

### 3.1 Schema
```json
{
  "questions": [
    {
      "number": 1,
      "type": "mcq",
      "question": "Full text, LaTeX preserved, tables in markdown, code fenced",
      "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
      "maxMarks": 1,
      "imageHint": "Description of the diagram/graph to reference (omitted if none)"
    }
  ]
}
```
`type` ∈ `mcq` | `short_answer` | `essay`. `options` present only for `mcq`
(keys A…E+). `maxMarks` included when visible in the paper (MCQ defaults to 1).
`imageHint` only when the question references a figure.

### 3.2 Content guarantees
- Questions are in paper order and numbered sequentially.
- Section labels are folded into the question text ("Section A, Question 1: …").
- Sub-parts (a), (b), (c) become separate questions, each carrying the parent
  stem as context.
- Maths in LaTeX, data tables in markdown, code in fenced blocks, chemical
  equations in standard notation, geometric figures described with their given
  measurements.

### 3.3 Display for smooth practice
- **One question per screen** (mobile) / one card per question (web), with a
  progress bar `answered / totalQuestions` and a question-number strip for jumps.
- Render the question body as markdown + LaTeX — never raw `$` or pipe tables.
- Type-specific input:
  - `mcq` → tappable option rows, A–E labels kept visible, single select.
  - `short_answer` → 2–4 line text field, `maxMarks` shown as a hint chip.
  - `essay` → expanding textarea, `maxMarks` chip plus a soft word-count guide.
- `imageHint` renders as an italic "Refer to the figure: …" note above the input,
  paired with the resource page view so the student can look at the actual
  diagram.
- Persist answers locally on every change (draft-safe), keyed by resource id, so
  closing the app never loses work.
- `questions: []` → empty state: "We couldn't read questions from this file.
  Try a clearer copy, or ask in chat instead." with a Chat CTA. Never a raw error.
- Extraction is cached, so re-entering a paper must reuse the cached set and keep
  the student's saved answers aligned by `number`.

---

## 4. Marking responses

### 4.1 Schema
```json
{
  "results": [
    {
      "number": 2,
      "type": "short_answer",
      "studentAnswer": "…",
      "correctAnswer": "Full model answer with LaTeX/markdown",
      "correct": true,
      "marks": 2,
      "maxMarks": 2,
      "explanation": "Why this is right / what went wrong"
    }
  ],
  "score": 15,
  "totalMarks": 20,
  "completedQuestions": 18,
  "totalQuestions": 20
}
```
Only answered questions appear in `results`. `score` = marks awarded,
`totalMarks` = sum of all `maxMarks`.

### 4.2 Marking behaviour the student can rely on
- Maths: working is checked, equivalent forms accepted, **partial marks for
  correct method** even when the final answer is wrong.
- Diagram questions: lenient — describing instead of drawing is accepted.
- Code: logic and syntax checked; any equivalent algorithm accepted unless the
  paper fixes the language.
- Table questions: checks the data was read and used correctly.
- Essays: marks per key point, generous partial credit.
- MCQ: letter comparison, boolean `correct`.
- `correctAnswer` is always a **full model answer**, not a keyword.
- `explanation` always teaches the *why*, not just the verdict.

### 4.3 Result display for easy understanding
1. **Score header** — big `score / totalMarks`, percentage, and
   `completedQuestions / totalQuestions` attempted, plus a one-line verdict band
   (≥75% strong, 50–74% getting there, <50% needs review). Colour comes from
   semantic tokens, never hardcoded greens/reds.
2. **Skipped count** = `totalQuestions − completedQuestions`, shown as a neutral
   "not attempted" chip — never marked wrong.
3. **Per-question card**, collapsed to the verdict, expanding to:
   - Your answer (verbatim `studentAnswer`)
   - Model answer (`correctAnswer`, markdown + LaTeX rendered)
   - Why (`explanation`)
   - Marks pill `marks / maxMarks`; partial credit shown as such, e.g. `1 / 2`,
     with an "partial credit" label so the student sees method marks were given.
4. **Wrong-answer-first review order** as a toggle, so revision starts where the
   marks were lost; default order stays paper order.
5. **Topic follow-through** — each card gets an "Explain this more" action that
   opens study chat pre-seeded with the question and the explanation, so marking
   flows straight back into learning.
6. **Retry** — retaking clears answers but keeps the previous attempt in history
   for comparison of `score` over time.
7. Marking is cached per (paper, questions, answers) triple, so identical
   re-submissions return instantly and cost nothing.

---

## 5. Cross-mode rendering requirements

- **One markdown renderer** shared by chat, questions and marking, with
  GitHub-flavoured tables, fenced code with syntax highlighting, and a maths
  plugin handling `$…$` and `$$…$$`.
- **Font sizes for reading**: body ≥16px, generous line height (~1.6), max
  measure ~70 characters; maths blocks centred with breathing room.
- **Horizontal scroll containers** for wide tables and long equations instead of
  shrinking text.
- **Dark mode parity** — all colours from design tokens; code and maths must stay
  legible on both themes.
- **Accessibility** — headings in order, options as real radio semantics, marks
  and verdicts announced as text (not colour alone), screen-reader labels on
  every progress indicator.
- **No raw JSON, no LaTeX source, no `::marker` syntax ever reaches the screen.**
- **Credits transparency** — surface the `X-AI-Credits-Charged` /
  `X-AI-Credits-Balance` values (chat) and the free-trial counter, and show a
  "free (cached)" badge on `X-Cache: HIT` responses.

---

## 6. Client checklist (mobile porting)

1. POST to `/functions/v1/learnlyte-ai` with the Supabase JWT in
   `Authorization` — anonymous calls get 401 `auth_required`.
2. Chat: stream and render deltas; buffer unbalanced maths/code fences.
3. Extract: request once per resource, cache locally, render one question per
   screen with type-specific inputs and draft persistence.
4. Mark: send `questions` + `answers`, render the score header, then per-question
   cards with your answer / model answer / why / marks.
5. Map every non-2xx status to the student-facing copy in §2.4.
6. Save chats to `learnlyte_ai_chats` (one row per user+resource, `messages`
   jsonb) so a thread resumes exactly where it stopped.
