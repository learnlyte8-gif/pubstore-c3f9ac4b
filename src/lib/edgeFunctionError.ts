export async function getEdgeFunctionErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (!(error instanceof Error)) return fallback;

  const context = (error as Error & { context?: Response }).context;
  if (context instanceof Response) {
    try {
      const response = context.clone();
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (payload?.error) return payload.error;
      }

      const text = await response.text().catch(() => "");
      if (text) {
        try {
          const payload = JSON.parse(text) as { error?: string };
          if (payload?.error) return payload.error;
        } catch {
          return text;
        }
      }
    } catch {
      // fall back to the original error message below
    }
  }

  return error.message || fallback;
}
