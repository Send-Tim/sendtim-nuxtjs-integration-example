import { createError, getHeader, readBody } from "h3";
import { checkRateLimit, clientKey } from "./_lib/rate-limit";
import { requireSameOrigin, sendtim } from "./_lib/sendtim";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROPERTY_NAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/;
const CONSENT_SOURCES = new Set(["import", "form", "api", "manual", "double_opt_in", "unknown"]);

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${field} is invalid.` });
  }
  return value.trim();
}

function parseCustomProperties(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: "customProperties must be an object." });
  }

  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, propertyValue] of Object.entries(value)) {
    const validValue = propertyValue === null || typeof propertyValue === "number" || typeof propertyValue === "boolean" ||
      (typeof propertyValue === "string" && propertyValue.length <= 1000);
    if (!PROPERTY_NAME_PATTERN.test(key) || !validValue) {
      throw createError({ statusCode: 400, statusMessage: "customProperties contains an invalid key or value." });
    }
    result[key] = propertyValue as string | number | boolean | null;
  }
  return result;
}

export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const rateLimit = checkRateLimit(clientKey(event));
  if (!rateLimit.allowed) {
    event.node.res.setHeader("Retry-After", String(rateLimit.retryAfter));
    throw createError({ statusCode: 429, statusMessage: "Too many requests." });
  }

  const contentLength = Number(getHeader(event, "content-length") ?? 0);
  if (contentLength > 10_000) throw createError({ statusCode: 413, statusMessage: "Request is too large." });

  const body = await readBody<Record<string, unknown>>(event);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "Body must be a JSON object." });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw createError({ statusCode: 400, statusMessage: "Enter a valid email address." });
  }

  const payload: Record<string, unknown> = { email };
  for (const [field, maxLength] of [["firstName", 120], ["lastName", 120], ["company", 200], ["source", 64]] as const) {
    const value = optionalString(body[field], field, maxLength);
    if (value !== undefined) payload[field] = value;
  }

  const properties = parseCustomProperties(body.customProperties);
  if (properties !== undefined) payload.customProperties = properties;

  if (body.listIds !== undefined) {
    if (!Array.isArray(body.listIds) || body.listIds.length > 50 || body.listIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
      throw createError({ statusCode: 400, statusMessage: "listIds must contain at most 50 UUIDs." });
    }
    payload.listIds = body.listIds;
  }

  if (body.consentGiven !== undefined) {
    if (typeof body.consentGiven !== "boolean") throw createError({ statusCode: 400, statusMessage: "consentGiven must be boolean." });
    payload.consentGiven = body.consentGiven;
  }
  if (body.consentSource !== undefined) {
    if (typeof body.consentSource !== "string" || !CONSENT_SOURCES.has(body.consentSource)) {
      throw createError({ statusCode: 400, statusMessage: "consentSource is invalid." });
    }
    payload.consentSource = body.consentSource;
  }

  return await sendtim(event, "/contacts", { method: "POST", body: payload });
});
