// 제품 사진 특징 분석: POST /functions/v1/analyze-image  { image: "data:image/jpeg;base64,..." }
// → { color, shape, material, category, context, mood, target, points }
// OpenRouter 무료 비전 모델 사용. 키는 Supabase 시크릿 OPEN_API_KEY.
import { corsHeaders, json } from "../_shared/cors.ts";

const MODEL = "nvidia/nemotron-3.5-super-vl:free";
const KEYS = ["color", "shape", "material", "category", "context", "mood", "target", "points"] as const;
const MAX_IMAGE_CHARS = 7_000_000; // base64 기준 약 5MB

const PROMPT = `당신은 제품 사진을 분석하는 마케팅 보조입니다.
사진을 보고 아래 키를 가진 JSON 객체 하나만 한국어로 출력하세요. 코드 블록이나 다른 설명은 쓰지 마세요.
- color: 색상 (보이는 그대로)
- shape: 형태
- material: 소재 (추정이면 "추정" 표시)
- category: 제품 종류
- context: 사용 맥락 및 배경 (1~2문장)
- mood: 분위기 및 감성 (1~2문장)
- target: 예상 타겟 고객 (1~2문장)
- points: 핵심 소구점 (1~2문장)`;

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "허용되지 않은 메서드입니다." }, 405);

  const key = Deno.env.get("OPEN_API_KEY");
  if (!key) return json({ error: "서버에 OPEN_API_KEY가 설정되지 않았습니다." }, 500);

  let image = "";
  try {
    ({ image } = await req.json());
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return json({ error: "JPG, PNG, WEBP 사진만 분석할 수 있습니다." }, 400);
  }
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "사진이 너무 큽니다. 5MB 이하로 올려 주세요." }, 413);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image } }],
        }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("OpenRouter 오류:", res.status, data?.error);
      const msg = res.status === 429
        ? "AI 서비스 요청이 많습니다. 잠시 뒤 다시 시도해 주세요."
        : "AI 서비스 호출에 실패했습니다.";
      return json({ error: msg }, 502);
    }

    const parsed = extractJson(String(data.choices?.[0]?.message?.content ?? ""));
    if (!parsed) return json({ error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요." }, 502);

    const result: Record<string, string> = {};
    for (const k of KEYS) {
      const v = parsed[k];
      result[k] = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
    }
    return json(result);
  } catch (err) {
    console.error("analyze-image 실패:", err);
    return json({ error: "사진 분석 중 오류가 발생했습니다." }, 502);
  }
});
