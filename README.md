# Vietnamese Family Life-Admin Chatbot

Production-light MVP backend for a Vietnamese family life-admin chatbot that can be connected to the WhatsApp Business Cloud API.

Important: the official WhatsApp Business/Cloud API is meant for a WhatsApp Business number chatting with individual users. It is not the same as adding a bot to a normal family WhatsApp group chat.

## What It Does

- Verifies WhatsApp webhooks at `GET /webhook/whatsapp`.
- Receives WhatsApp webhook events at `POST /webhook/whatsapp`.
- Replies only when a message includes `@Bot` or starts with `bot`.
- Uses OpenAI's Responses API for normal replies.
- Defaults to Vietnamese with a warm, respectful, patient tone.
- Escalates risky topics to Henry instead of making final decisions.
- Redacts sensitive data before storing logs.
- Keeps the last 100 bot events in memory.
- Limits replies to 30 per day and one reply per incoming message.

## Safety Rules

The bot does not make final decisions for medical, legal, financial, banking, insurance, tax, immigration, property, contract, OTP, password, ID, or passport issues.

For risky topics it replies:

> Việc này quan trọng. Bố mẹ nên gửi Henry kiểm tra trước khi làm.

## Endpoints

- `GET /health` - simple health check.
- `GET /webhook/whatsapp` - verifies the Meta webhook challenge.
- `POST /webhook/whatsapp` - receives WhatsApp Cloud API webhook payloads.
- `GET /admin/logs` - shows recent in-memory bot events.

Protect `/admin/logs` behind authentication or network restrictions before exposing this service publicly.

## Setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create local environment settings:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in:

   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` such as `gpt-5.5`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_API_VERSION`
   - `PORT`

5. Run locally:

   ```bash
   npm run dev
   ```

6. Check health:

   ```bash
   curl http://localhost:3000/health
   ```

## WhatsApp Webhook Notes

Set your Meta webhook callback URL to:

```text
https://your-domain.example/webhook/whatsapp
```

Use the same value for Meta's verify token and your `WHATSAPP_VERIFY_TOKEN` environment variable.

The webhook parser accepts WhatsApp Cloud API text-message shapes such as:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "metadata": {
              "phone_number_id": "your-phone-number-id"
            },
            "messages": [
              {
                "from": "447700900123",
                "id": "wamid.example",
                "type": "text",
                "text": {
                  "body": "bot dịch giúp mẹ câu này"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

If `WHATSAPP_APP_SECRET` is set, webhook requests must include a valid SHA-256 HMAC signature in `x-hub-signature-256`.

## Production-Light Deployment

1. Build the project:

   ```bash
   npm run build
   ```

2. Start the compiled server:

   ```bash
   npm start
   ```

3. On a host such as Render, Fly.io, Railway, or a small VPS:

   - Set all environment variables in the host dashboard.
   - Use `npm run build` as the build command.
   - Use `npm start` as the start command.
   - Point Meta's WhatsApp webhook to the deployed `/webhook/whatsapp` URL.
   - Add access control for `/admin/logs`.

## Tests

Run:

```bash
npm test
```

The tests cover trigger detection, sensitive data redaction, risky topic detection, ignored non-trigger messages, and OpenAI Responses API request formatting.
