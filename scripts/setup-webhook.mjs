const token = process.env.TELEGRAM_BOT ?? process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = process.env.PUBLIC_URL;
const webhookSecret = process.env.WEBHOOK_SECRET;

if (!token) {
  console.error('Задайте TELEGRAM_BOT в .env');
  process.exit(1);
}

if (!baseUrl) {
  console.error('Задайте PUBLIC_URL, например: https://your-app.vercel.app');
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhook`;

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  }),
});

const payload = await response.json();
console.log(JSON.stringify({ webhookUrl, ...payload }, null, 2));

if (!response.ok || !payload.ok) {
  process.exit(1);
}
