// Replace the URL initialization down to the data processing block with this:

const url = "https://aliexpress-scraper-api.omkar.cloud/aliexpress/search";

// Prepare payload as expected by Omkar Cloud's API schema
const payload = {
  query: query,
  page: page,
};

const r = await fetch(url, {
  method: "POST",
  headers: {
    "API-Key": apiKey,
    "Content-Type": "application/json",
    // Adding a User-Agent prevents cloud infrastructure blocks
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  body: JSON.stringify(payload),
});

const text = await r.text();
if (!r.ok) {
  console.error("omkar error", r.status, text.slice(0, 500));
  return json({ error: `Search failed [${r.status}]`, details: text.slice(0, 400) }, r.status);
}

let data;
try {
  data = JSON.parse(text);
} catch (parseErr) {
  console.error("Failed to parse JSON response:", text);
  return json({ error: "Invalid response formatting from scraper vendor." }, 502);
}

// Keep the rest of your mapping function intact below...
