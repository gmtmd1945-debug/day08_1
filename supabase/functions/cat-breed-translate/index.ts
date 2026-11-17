// 품종 정보 한글 번역: GET /functions/v1/cat-breed-translate?breed_id={id}
// Gemini(GEMINI_API_KEY)로 name / description / temperament / origin을 번역한다.
import { corsHeaders, fetchBreed, json, NotFoundError, parseBreedId } from "../_shared/cors.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PER_MODEL_TIMEOUT_MS = 12_000;

// 앞에서부터 시도하고, 과부하(503)·시간 초과·모델 없음(404) 등으로 실패하면 다음 모델로 넘어간다.
// GEMINI_MODEL 시크릿을 지정하면 그 모델을 가장 먼저 시도한다.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

type Fields = { name: string; description: string; temperament: string; origin: string };

// 번역 결과 캐시 (함수 인스턴스가 살아 있는 동안 유지)
const cache = new Map<string, Fields & { model: string }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "허용되지 않은 메서드입니다." }, 405);

  const breedId = parseBreedId(req);
  if (!breedId) return json({ error: "breed_id가 올바르지 않습니다." }, 400);

  const hit = cache.get(breedId);
  if (hit) return json({ id: breedId, ...hit, translated: true });

  let source: Fields;
  try {
    const breed = await fetchBreed(breedId);
    source = {
      name: breed.name,
      description: breed.description ?? "",
      temperament: breed.temperament ?? "",
      origin: breed.origin ?? "",
    };
  } catch (err) {
    console.error("Cat API 실패:", err);
    return err instanceof NotFoundError
      ? json({ error: "품종을 찾을 수 없습니다." }, 404)
      : json({ error: "품종 정보를 불러오지 못했습니다." }, 502);
  }

  try {
    const ko = await translate(source);
    cache.set(breedId, ko);
    return json({ id: breedId, ...ko, translated: true });
  } catch (err) {
    console.error("번역 실패:", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ id: breedId, ...source, translated: false, translateError: message.slice(0, 500) });
  }
});

async function translate(source: Fields): Promise<Fields & { model: string }> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY 시크릿이 없습니다.");

  const preferred = Deno.env.get("GEMINI_MODEL");
  const models = preferred ? [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)] : FALLBACK_MODELS;

  const prompt = [
    "다음 JSON은 고양이 품종 정보입니다. 각 값을 자연스러운 한국어로 번역해,",
    "같은 키(name, description, temperament, origin)를 가진 JSON 객체 하나만 반환하세요.",
    "- name: 한국에서 통용되는 품종명 표기(음차). 예: Abyssinian → 아비시니안",
    "- temperament: 쉼표로 구분된 성격 목록 형태를 유지",
    "- origin: 한국어 국가/지역명",
    "- 값이 빈 문자열이면 빈 문자열 그대로 둘 것",
    "",
    JSON.stringify(source),
  ].join("\n");

  const errors: string[] = [];
  for (const model of models) {
    try {
      const parsed = await callGemini(model, key, prompt);
      const pick = (k: keyof Fields) =>
        typeof parsed[k] === "string" && parsed[k]!.trim() ? parsed[k]!.trim() : source[k];
      return {
        name: pick("name"),
        description: pick("description"),
        temperament: pick("temperament"),
        origin: pick("origin"),
        model,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${model} 실패:`, msg);
      errors.push(`${model}: ${msg.slice(0, 120)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function callGemini(model: string, key: string, prompt: string): Promise<Partial<Fields>> {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 100)}`);

  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? ""))
    .join("");
  return JSON.parse(text);
}
