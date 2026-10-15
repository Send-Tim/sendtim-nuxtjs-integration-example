import { createError, getHeader, getRequestURL, setResponseStatus, type H3Event } from "h3";

const API_BASE = "https://sendtim.com/api/v1";

type SendtimOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

export async function sendtim(event: H3Event, path: string, options: SendtimOptions = {}) {
  const config = useRuntimeConfig(event);
  if (!config.sendtimApiKey) {
    throw createError({ statusCode: 500, statusMessage: "Server is missing NUXT_SENDTIM_API_KEY." });
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      headers: {
        Authorization: `Bearer ${config.sendtimApiKey}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setResponseStatus(event, response.status);
    return data;
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Sendtim could not be reached." });
  }
}

export function requireSameOrigin(event: H3Event) {
  const origin = getHeader(event, "origin");
  if (!origin) return;
  const expectedOrigin = useRuntimeConfig(event).appOrigin || getRequestURL(event).origin;
  if (origin !== expectedOrigin) {
    throw createError({ statusCode: 403, statusMessage: "Origin not allowed." });
  }
}
