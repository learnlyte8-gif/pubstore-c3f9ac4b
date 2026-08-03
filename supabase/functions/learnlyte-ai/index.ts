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
    const { messages, fileUrl, resourceTitle, resourceType, resourceLevel } = body;
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
