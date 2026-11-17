// 품종 상세 (빠른 응답): GET /functions/v1/cat-breed-detail?breed_id={id}&limit={n}
// 이미지 여러 장 + 영문 품종 정보 + 영문 위키 링크. 번역은 cat-breed-translate에서 따로 한다.
import {
  CAT_API_BASE,
  catApiHeaders,
  corsHeaders,
  fetchBreed,
  json,
  NotFoundError,
  parseBreedId,
} from "../_shared/cors.ts";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

type CatImage = { url: string; width?: number; height?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "허용되지 않은 메서드입니다." }, 405);

  const breedId = parseBreedId(req);
  if (!breedId) return json({ error: "breed_id가 올바르지 않습니다." }, 400);

  const limitParam = Number(new URL(req.url).searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const [breed, images] = await Promise.all([fetchBreed(breedId), fetchImages(breedId, limit)]);
    return json({
      id: breed.id,
      name: breed.name,
      description: breed.description ?? "",
      temperament: breed.temperament ?? "",
      origin: breed.origin ?? "",
      lifeSpan: breed.life_span ? `${breed.life_span}년` : "",
      weightKg: breed.weight?.metric ?? "",
      wikipediaUrl:
        breed.wikipedia_url ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(breed.name.replace(/ /g, "_"))}`,
      images: images.map(({ url, width, height }) => ({ url, width, height })),
    });
  } catch (err) {
    console.error("Cat API 실패:", err);
    return err instanceof NotFoundError
      ? json({ error: "품종을 찾을 수 없습니다." }, 404)
      : json({ error: "품종 정보를 불러오지 못했습니다." }, 502);
  }
});

async function fetchImages(id: string, limit: number): Promise<CatImage[]> {
  const url = `${CAT_API_BASE}/images/search?breed_ids=${encodeURIComponent(id)}&limit=${limit}`;
  const res = await fetch(url, { headers: catApiHeaders() });
  if (!res.ok) throw new Error(`images/search ${res.status}`);
  const data: CatImage[] = await res.json();
  return Array.isArray(data) ? data.filter((img) => img?.url) : [];
}
