const JSONBLOB = 'https://jsonblob.com/api/jsonBlob';
const DUE_GRACE_MS = 3 * 60 * 60 * 1000;
const DUE_AHEAD_MS = 2 * 60 * 1000;
const SENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const blobId = (process.env.REMINDER_BLOB_ID ?? '').trim();
if (!blobId) {
  console.log('Brak REMINDER_BLOB_ID — pomijam. Dodaj secret w GitHubie, żeby przypomnienia szły przy zamkniętej apce.');
  process.exit(0);
}

const response = await fetch(`${JSONBLOB}/${blobId}`, {
  headers: { Accept: 'application/json' },
});
if (!response.ok) {
  throw new Error(`Nie udało się odczytać skrzynki (${response.status}).`);
}

const inbox = await response.json();
const token = typeof inbox.botToken === 'string' ? inbox.botToken.trim() : '';
const chatId = typeof inbox.chatId === 'string' ? inbox.chatId.trim() : '';
const reminders = Array.isArray(inbox.reminders) ? inbox.reminders : [];
const sent = Array.isArray(inbox.sent) ? inbox.sent : [];

if (!token || !chatId) {
  console.log('W skrzynce nie ma jeszcze tokenu Telegram. Połącz bota w Ustawieniach apki.');
  process.exit(0);
}

const now = Date.now();
const sentKeys = new Set(
  sent
    .filter((item) => item && typeof item.id === 'string' && typeof item.fireAt === 'string')
    .map((item) => `${item.id}:${item.fireAt}`)
);

const due = reminders.filter((item) => {
  if (!item || typeof item.id !== 'string' || typeof item.fireAt !== 'string') return false;
  const at = Date.parse(item.fireAt);
  return Number.isFinite(at) && at <= now + DUE_AHEAD_MS && at >= now - DUE_GRACE_MS;
});

const newlySent = [];
for (const item of due) {
  const key = `${item.id}:${item.fireAt}`;
  if (sentKeys.has(key)) continue;
  const text = [item.title, '', item.body, item.url].filter(Boolean).join('\n');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const sendResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const payload = await sendResponse.json().catch(() => ({ ok: false }));
  if (!sendResponse.ok || payload.ok !== true) {
    console.warn(`Nie wysłano przypomnienia ${item.id}: ${sendResponse.status}`);
    continue;
  }
  sentKeys.add(key);
  newlySent.push({ id: item.id, fireAt: item.fireAt });
}

const cutoff = now - SENT_MAX_AGE_MS;
const nextSent = [...sent, ...newlySent].filter((item) => {
  if (!item || typeof item.fireAt !== 'string') return false;
  const at = Date.parse(item.fireAt);
  return Number.isFinite(at) && at >= cutoff;
});

if (newlySent.length > 0 || nextSent.length !== sent.length) {
  const put = await fetch(`${JSONBLOB}/${blobId}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      v: 1,
      botToken: token,
      chatId,
      reminders,
      sent: nextSent,
    }),
  });
  if (!put.ok) {
    throw new Error(`Nie udało się zaktualizować skrzynki (${put.status}).`);
  }
}

console.log(`Wysłano ${newlySent.length} przypomnień Telegram.`);
