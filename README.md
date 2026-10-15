# Nuxt 4 + Sendtim REST API

A small Nuxt/Nitro example that keeps the Sendtim API key on the server.

## Setup

```sh
npm install
cp .env.example .env
# Edit .env, then:
npm run dev
```

Create the API key in **Sendtim → Settings → API**. Never put it in `runtimeConfig.public` or a browser variable.

## Routes

- `GET /api/health` — local liveness check; it does not call Sendtim.
- `POST /api/contacts` — validates and upserts a Sendtim contact.

The contacts payload follows the Sendtim contact schema. `email` is required. It also accepts `firstName`, `lastName`, `company`, `source`, `customProperties`, `listIds`, `consentGiven`, and `consentSource`.

```sh
curl http://localhost:3000/api/contacts \
  -X POST \
  -H 'content-type: application/json' \
  -d '{
    "email": "ana@example.com",
    "firstName": "Ana",
    "company": "Acme",
    "source": "community-form",
    "customProperties": { "plan": "pro" },
    "consentGiven": true,
    "consentSource": "form"
  }'
```

`listIds` must contain Sendtim list UUIDs. Upsert adds lists and does not remove existing ones. Consent is recorded when a contact is created and does not change consent for an existing contact. Use a test workspace before connecting a public form.

The contact route checks same-origin browser requests, limits request size, and applies a process-local limit of five requests per ten minutes per client. Use shared/provider rate limiting for multi-instance deployment. Set `NUXT_APP_ORIGIN` to the public origin behind a reverse proxy.

References: [Sendtim API docs](https://sendtim.com/docs) · [OpenAPI](https://sendtim.com/openapi.yaml)
