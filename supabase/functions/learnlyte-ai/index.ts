import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LearnLyte AI, a study assistant for students using the LearnLyte educational platform.

You help students understand, summarize, and study educational resources like past papers, textbooks, notes, and worksheets.

HOW TO HELP:
- Summarize resources concisely
- Generate practice questions and quizzes
- Explain key concepts and topics
- Provide study tips and strategies
- Break down complex topics into simple terms
- Use markdown formatting (bold, lists, headers) for readability

Be concise, friendly, and educational. Always ground your answers in the resource content provided in the context.`;

const EXTRACT_PROMPT = `You are LearnLyte AI, an exam paper analyzer. Your task is to extract ALL questions from the provided exam paper content.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "questions": [
    {
      "number": 1,
      "type": "mcq",
      "question": "The full question text",
      "options": { "A": "option text", "B": "option text", "C": "option text", "D": "option text" }
    },
    {
      "number": 2,
      "type": "short_answer",
      "question": "The full question text",
      "maxMarks": 2
    },
    {
      "number": 3,
      "type": "essay",
      "question": "The full question text",
      "maxMarks": 10
    }
  ]
}

Rules:
- type is "mcq" for multiple choice, "short_answer" for short answers, "essay" for long answers
- For MCQ, include all options as a map with keys A, B, C, D, E etc.
- For non-MCQ, include maxMarks if visible in the paper
- Extract questions in order as they appear
- If the paper has sections, still number questions sequentially
- If no questions can be extracted, return {"questions": []}`;

const MARK_PROMPT = `You are LearnLyte AI, an exam marker. Your task is to mark student answers against the exam paper.

You will receive the paper content, the list of questions, and the student's answers.
Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "results": [
    {
      "number": 1,
      "type": "mcq",
      "studentAnswer": "A",
      "correctAnswer": "B",
      "correct": false,
      "explanation": "Brief explanation of why B is correct"
    },
    {
      "number": 2,
      "type": "short_answer",
      "studentAnswer": "student's answer text",
      "correctAnswer": "model answer",
      "correct": true,
      "marks": 2,
      "maxMarks": 2,
      "explanation": "Brief feedback"
    }
  ],
  "score": 15,
  "totalMarks": 20,
  "completedQuestions": 18,
  "totalQuestions": 20
}

Rules:
- For MCQ: compare the letter. "correct" is boolean.
- For short_answer/essay: award marks out of maxMarks. "correct" is true if marks >= maxMarks * 0.5.
- Only include questions the student answered (has a non-empty studentAnswer).
- "completedQuestions" = number of questions the student answered.
- "totalQuestions" = total questions in the paper.
- "score" = sum of marks awarded (for MCQ, each correct = 1 mark unless paper specifies otherwise).
- "totalMarks" = sum of all maxMarks (for MCQ, count = 1 each).
- Be fair but strict. Give partial credit for partially correct short answers.`;

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages = Array.isArray(text) ? text : [String(text)];
    const maxPages = Math.min(pages.length, 40);
    let fullText = "";
    for (let i = 0; i < maxPages; i++) {
      const pageText = (pages[i] || "").replace(/\s+/g, " ").trim();
      if (pageText) fullText += `--- Page ${i + 1} ---\n${pageText}\n\n`;
    }

    console.log(`PDF extracted: ${totalPages} pages, ${fullText.length} chars`);
    if (!fullText.trim()) {
      return "(No extractable text found in this PDF — it looks like a scanned/image-only document.)";
    }
    return fullText;
  } catch (e) {
    console.error("PDF extraction error:", e instanceof Error ? e.message : e);
    return "(Could not extract text from PDF)";
  }
}

async function fetchFileContent(fileUrl: string): Promise<string> {
  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) return `(Failed to download file: ${resp.status})`;

    const contentType = resp.headers.get("content-type") || "";
    const arrayBuffer = await resp.arrayBuffer();

    if (contentType.includes("pdf") || fileUrl.toLowerCase().includes(".pdf")) {
      const text = await extractPdfText(arrayBuffer);
      return text.slice(0, 50000);
    }

    if (contentType.includes("text") || contentType.includes("json")) {
      const text = new TextDecoder().decode(arrayBuffer);
      return text.slice(0, 50000);
    }

    return `(File type: ${contentType}. This appears to be an image or non-text file.)`;
  } catch (e) {
    console.error("File fetch error:", e);
    return "(Could not download the resource file)";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, fileUrl, resourceTitle, resourceType, resourceLevel, action, questions, answers } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let context = `Resource: ${resourceTitle || "Unknown"}
Type: ${resourceType || "Unknown"}
Level: ${resourceLevel || "Unknown"}
`;

    if (fileUrl) {
      const fileContent = await fetchFileContent(fileUrl);
      context += `\nFILE CONTENT:\n${fileContent}`;
    }

    // ── Extract questions action ──
    if (action === "extract-questions") {
      const extractMessages = [
        { role: "system", content: `${EXTRACT_PROMPT}\n\nRESOURCE CONTEXT:\n${context}` },
        { role: "user", content: "Extract all questions from this exam paper. Return ONLY the JSON object." },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: extractMessages,
          stream: false,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error("Extract questions error:", response.status, txt);
        return new Response(JSON.stringify({ error: "Failed to extract questions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ questions: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Mark answers action ──
    if (action === "mark-answers") {
      const markMessages = [
        { role: "system", content: `${MARK_PROMPT}\n\nRESOURCE CONTEXT:\n${context}` },
        { role: "user", content: `Questions: ${JSON.stringify(questions)}\n\nStudent Answers: ${JSON.stringify(answers)}\n\nMark the student's answers. Return ONLY the JSON result object.` },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: markMessages,
          stream: false,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error("Mark answers error:", response.status, txt);
        return new Response(JSON.stringify({ error: "Failed to mark answers" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Failed to parse marking results" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Default: streaming chat ──
    const sys = `${SYSTEM_PROMPT}\n\nRESOURCE CONTEXT:\n${context}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("learnlyte-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
