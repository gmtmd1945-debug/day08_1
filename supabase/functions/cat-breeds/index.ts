// 품종 목록 조회: GET /functions/v1/cat-breeds → [{ id, name }]
import { CAT_API_BASE, catApiHeaders, corsHeaders, json } from "../_shared/cors.ts";

type Breed = { id: string; name: string };

let cached: Breed[] | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "허용되지 않은 메서드입니다." }, 405);

  try {
    if (!cached) {
      const res = await fetch(`${CAT_API_BASE}/breeds`, { headers: catApiHeaders() });
      if (!res.ok) throw new Error(`Cat API ${res.status}`);
      const breeds: Breed[] = await res.json();
      cached = breeds
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return json(cached);
  } catch (err) {
    console.error("cat-breeds 실패:", err);
    return json({ error: "품종 목록을 불러오지 못했습니다." }, 502);
  }
});
