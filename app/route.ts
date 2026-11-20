// "/" is the landing page: static HTML on the taste skill's kit (lib/landing.ts explains why it is not React).
import { landingHTML } from "@/lib/landing";

export const dynamic = "force-static";

export function GET() {
  return new Response(landingHTML(), { headers: { "content-type": "text/html; charset=utf-8" } });
}
