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
- When referencing mathematical expressions, use LaTeX notation (e.g. $x^2 + y^2 = r^2$)
- When referencing code, use markdown code blocks with language tags
- When referencing tables, use markdown table syntax

Be concise, friendly, and educational. Always ground your answers in the resource content provided in the context.`;

const EXTRACT_PROMPT = `You are LearnLyte AI, an expert exam paper analyzer. Your task is to extract ALL questions from the provided exam paper.

Carefully examine the paper content for questions, including those that contain:
- Mathematical expressions and equations (preserve in LaTeX: $...$ for inline, $$...$$ for block)
- Graphs and diagrams (describe them in the question text so the student understands what to reference)
- Tables of data (include the full table in markdown table format within the question text)
- Code snippets (include in markdown code blocks within the question text)
- Chemical equations and structures (use standard notation)
- Geometric figures (describe the figure and any given measurements)

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{
  "questions": [
    {
      "number": 1,
      "type": "mcq",
      "question": "The full question text with all mathematical expressions in LaTeX, tables in markdown, code in code blocks, and descriptions of any diagrams or graphs",
      "options": { "A": "option text (with LaTeX if mathematical)", "B": "option text", "C": "option text", "D": "option text" },
      "maxMarks": 1,
      "imageHint": "Brief description of any diagram/graph the student should reference (omit if none)"
    },
    {
      "number": 2,
      "type": "short_answer",
      "question": "The full question text with all notation preserved",
      "maxMarks": 2,
      "imageHint": "Description of any figure referenced (omit if none)"
    },
    {
      "number": 3,
      "type": "essay",
      "question": "The full question text",
      "maxMarks": 10,
      "imageHint": "Description of any figure referenced (omit if none)"
    }
  ]
}

Rules:
- type is "mcq" for multiple choice, "short_answer" for short answers, "essay" for long answers
- For MCQ, include all options as a map with keys A, B, C, D, E etc. Preserve any mathematical notation in options
- For non-MCQ, include maxMarks if visible in the paper
- Extract questions in order as they appear
- If the paper has sections (A, B, C etc.), still number questions sequentially but include the section in the question text (e.g. "Section A, Question 1: ...")
- PRESERVE all mathematical expressions using LaTeX notation
- PRESERVE all tables using markdown table syntax
- PRESERVE all code using markdown code blocks with language tags
- For questions referencing diagrams/graphs/figures, include an "imageHint" field describing what the student should see
- If a question has sub-parts (a, b, c), treat each sub-part as a separate question with the parent context in the question text
- If no questions can be extracted, return {"questions": []}`;

const MARK_PROMPT = `You are LearnLyte AI, an expert exam marker. Your task is to mark student answers against the exam paper.

You have access to the original paper content and the extracted questions with the student's answers.

When marking:
- For mathematical questions: verify the student's working and final answer. Accept equivalent forms of equations. Award partial marks for correct method even if final answer is wrong.
- For questions with diagrams/graphs: the student's answer should address what the diagram shows. Be lenient if they describe rather than draw.
- For code questions: check logic, syntax, and correctness. Accept equivalent algorithms in different languages if the question doesn't specify a language.
- For table-based questions: check that the student has correctly read and used the data from the table.
- For essay/long answer questions: award marks for key points covered. Be generous with partial credit.
- For MCQ: compare the letter. "correct" is boolean.

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{
  "results": [
    {
      "number": 1,
      "type": "mcq",
      "studentAnswer": "A",
      "correctAnswer": "B",
      "correct": false,
      "explanation": "Brief explanation of why B is correct. Use LaTeX for any math: $...$"
    },
    {
      "number": 2,
      "type": "short_answer",
      "studentAnswer": "student's answer text",
      "correctAnswer": "model answer with LaTeX math $...$ and markdown if needed",
      "correct": true,
      "marks": 2,
      "maxMarks": 2,
      "explanation": "Brief feedback with any corrections. Use LaTeX for math notation."
    }
  ],
  "score": 15,
  "totalMarks": 20,
  "completedQuestions": 18,
  "totalQuestions": 20
}

Rules:
- Only include questions the student answered (has a non-empty studentAnswer).
- "completedQuestions" = number of questions the student answered.
- "totalQuestions" = total questions in the paper.
- "score" = sum of marks awarded (for MCQ, each correct = 1 mark unless paper specifies otherwise).
- "totalMarks" = sum of all maxMarks (for MCQ, count = 1 each).
- "correctAnswer" should be a full model answer, not just a keyword. Include LaTeX for math, markdown for formatting.
- "explanation" should be educational — explain WHY the answer is correct or what the student got wrong.
- Be fair but strict. Give partial credit for partially correct short answers.
- For MCQ with no maxMarks in the question, use maxMarks = 1.`;

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

type FileContent = {
  text: string;
  images: string[];
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFileContent(fileUrl: string): Promise<FileContent> {
  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) return { text: `(Failed to download file: ${resp.status})`, images: [] };

    const contentType = resp.headers.get("content-type") || "";
    const arrayBuffer = await resp.arrayBuffer();

    if (contentType.includes("pdf") || fileUrl.toLowerCase().includes(".pdf")) {
      const text = await extractPdfText(arrayBuffer);
      return { text: text.slice(0, 50000), images: [] };
    }

    if (contentType.includes("image")) {
      const dataUrl = `data:${contentType};base64,${toBase64(new Uint8Array(arrayBuffer))}`;
      return { text: "(Image file provided)", images: [dataUrl] };
    }

    if (contentType.includes("text") || contentType.includes("json")) {
      const text = new TextDecoder().decode(arrayBuffer);
      return { text: text.slice(0, 50000), images: [] };
    }

    return { text: `(File type: ${contentType}. This appears to be a non-text file.)`, images: [] };
  } catch (e) {
    console.error("File fetch error:", e);
    return { text: "(Could not download the resource file)", images: [] };
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

    let fileImages: string[] = [];
    if (fileUrl) {
      const fileContent = await fetchFileContent(fileUrl);
      context += `\nFILE CONTENT (text extraction):\n${fileContent.text}`;
      fileImages = fileContent.images;
    }

    // Helper: build messages with image content for vision models
    function buildVisionMessages(systemPrompt: string, userText: string, images: string[]) {
      const msgs: any[] = [{ role: "system", content: `${systemPrompt}\n\nRESOURCE CONTEXT:\n${context}` }];
      if (images.length > 0) {
        const content: any[] = [{ type: "text", text: userText }];
        for (const img of images) {
          content.push({ type: "image_url", image_url: { url: img } });
        }
        msgs.push({ role: "user", content });
      } else {
        msgs.push({ role: "user", content: userText });
      }
      return msgs;
    }

    // ── Extract questions action ──
    if (action === "extract-questions") {
      const extractMessages = buildVisionMessages(
        EXTRACT_PROMPT,
        "Extract all questions from this exam paper. Examine the content carefully for questions containing mathematical expressions, graphs, diagrams, tables, and code. Return ONLY the JSON object.",
        fileImages,
      );

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
          max_tokens: 16000,
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
      const userText = `Questions: ${JSON.stringify(questions)}\n\nStudent Answers: ${JSON.stringify(answers)}\n\nMark the student's answers. For each answer, check against the original paper content and the extracted questions. Return ONLY the JSON result object.`;
      const markMessages = buildVisionMessages(MARK_PROMPT, userText, fileImages);

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
          max_tokens: 16000,
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

    let chatMessages: any[];
    if (fileImages.length > 0 && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const content: any[] = [{ type: "text", text: lastMsg.content }];
      for (const img of fileImages.slice(0, 5)) {
        content.push({ type: "image_url", image_url: { url: img } });
      }
      chatMessages = [
        { role: "system", content: sys },
        ...messages.slice(0, -1),
        { role: lastMsg.role, content },
      ];
    } else {
      chatMessages = [{ role: "system", content: sys }, ...messages];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
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
