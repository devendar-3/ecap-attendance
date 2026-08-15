const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export async function askGateway(content: ContentBlock[], model = "google/gemini-3.5-flash"): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("AI gateway error", res.status, detail);
    if (res.status === 429) throw new Error("Too many requests right now — try again in a moment");
    if (res.status === 402) throw new Error("AI credits are exhausted for this project");
    throw new Error("The reader could not process that file");
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Pull the first JSON object/array out of a model response. */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "```").split("```").join("\n");
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("Nothing could be read from that file");
  const opener = cleaned[start];
  const closer = opener === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new Error("Nothing could be read from that file");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
