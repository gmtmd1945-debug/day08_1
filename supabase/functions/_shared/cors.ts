export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export const CAT_API_BASE = "https://api.thecatapi.com/v1";

/** The Cat API 요청 헤더. Cat_api 시크릿(대소문자 구분)을 x-api-key로 붙인다. */
export function catApiHeaders(): HeadersInit {
  const key = Deno.env.get("Cat_api");
  if (!key) console.warn("Cat_api 시크릿이 없습니다. The Cat API가 403을 반환할 수 있습니다.");
  return key ? { "x-api-key": key } : {};
}

export type CatBreed = {
  id: string;
  name: string;
  description?: string;
  temperament?: string;
  origin?: string;
  life_span?: string;
  weight?: { metric?: string };
  wikipedia_url?: string;
};

export class NotFoundError extends Error {}

export function parseBreedId(req: Request): string | null {
  const id = new URL(req.url).searchParams.get("breed_id")?.trim() ?? "";
  return /^[a-z0-9_-]{1,20}$/i.test(id) ? id : null;
}

export async function fetchBreed(id: string): Promise<CatBreed> {
  const res = await fetch(`${CAT_API_BASE}/breeds/${encodeURIComponent(id)}`, { headers: catApiHeaders() });
  if (!res.ok) throw new Error(`breeds/${id} ${res.status}`);
  const data = await res.json();
  if (!data || !data.id) throw new NotFoundError(id);
  return data;
}
