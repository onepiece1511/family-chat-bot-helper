# Vietnamese Family Life-Admin Chatbot

Production-light MVP backend for a Vietnamese family life-admin chatbot that can later be connected to a Zalo group chat.

## What It Does

- Receives Zalo webhook events at `POST /webhook/zalo`.
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
- `POST /webhook/zalo` - receives Zalo webhook payloads.
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
   - `ZALO_ACCESS_TOKEN`
   - `ZALO_APP_SECRET`
   - `PORT`

5. Run locally:

   ```bash
   npm run dev
   ```

6. Check health:

   ```bash
   curl http://localhost:3000/health
   ```

## Zalo Webhook Notes

Set your Zalo webhook URL to:

```text
https://your-domain.example/webhook/zalo
```

The webhook parser accepts common text-message shapes such as:

```json
{
  "event_name": "user_send_text",
  "sender": { "id": "zalo-user-id" },
  "recipient": { "id": "chat-or-oa-id" },
  "message": {
    "msg_id": "message-id",
    "text": "@Bot dịch giúp mẹ câu này"
  }
}
```

If `ZALO_APP_SECRET` is set, webhook requests must include a valid SHA-256 HMAC signature in `x-zalo-signature`, `x-zalo-app-signature`, or `x-hub-signature-256`.

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
   - Point Zalo's webhook to the deployed `/webhook/zalo` URL.
   - Add access control for `/admin/logs`.

## Tests

Run:

```bash
npm test
```

The tests cover trigger detection, sensitive data redaction, risky topic detection, ignored non-trigger messages, and OpenAI Responses API request formatting.
