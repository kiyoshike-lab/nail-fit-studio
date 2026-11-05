import { contactConfiguration } from "@/lib/contactConfiguration";
import { contactRateLimiter, handleContact } from "@/lib/contactServer";

export const runtime = "nodejs";
const allow = contactRateLimiter();

export async function POST(request: Request) {
  return handleContact(request, contactConfiguration(process.env), { fetch, allow });
}
