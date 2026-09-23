const DUE_GRACE_MS = 3 * 60 * 60 * 1000;
const DUE_AHEAD_MS = 2 * 60 * 1000;
const SENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const blobId = (process.env.REMINDER_BLOB_ID ?? "").trim().replaceAll(" ", "");
const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
  .trim()
  .replaceAll(" ", "");
if (!blobId) {
  console.log("Brak REMINDER_BLOB_ID — pomijam.");
  process.exit(0);
}
if (!supabaseUrl || !serviceRoleKey)
  throw new Error("Brak konfiguracji Supabase w GitHub Actions.");

const headers = {
  Accept: "application/json",
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};
const response = await fetch(
  `${supabaseUrl}/rest/v1/telegram_inboxes?id=eq.${encodeURIComponent(blobId)}&select=payload`,
  {
    headers,
  },
);
if (!response.ok) {
  throw new Error(`Nie udało się odczytać skrzynki (${response.status}).`);
}
const rows = await response.json();
const inbox = rows[0]?.payload;
if (!inbox) {
  throw new Error("Nie znaleziono skrzynki przypomnień.");
}
const token = typeof inbox.botToken === "string" ? inbox.botToken.trim() : "";
const chatId = typeof inbox.chatId === "string" ? inbox.chatId.trim() : "";
const reminders = Array.isArray(inbox.reminders) ? inbox.reminders : [];
const sent = Array.isArray(inbox.sent) ? inbox.sent : [];

if (!token || !chatId) {
  console.log(
    "W skrzynce nie ma jeszcze tokenu Telegram. Połącz bota w Ustawieniach apki.",
  );
  process.exit(0);
}

const now = Date.now();
const sentKeys = new Set(
  sent
    .filter(
      (item) =>
        item && typeof item.id === "string" && typeof item.fireAt === "string",
    )
    .map((item) => `${item.id}:${item.fireAt}`),
);

const due = reminders.filter((item) => {
  if (!item || typeof item.id !== "string" || typeof item.fireAt !== "string")
    return false;
  const at = Date.parse(item.fireAt);
  return (
    Number.isFinite(at) && at <= now + DUE_AHEAD_MS && at >= now - DUE_GRACE_MS
  );
});

const newlySent = [];
for (const item of due) {
  const key = `${item.id}:${item.fireAt}`;
  if (sentKeys.has(key)) continue;
  const text = [item.title, "", item.body, item.url].filter(Boolean).join("\n");
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const sendResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const payload = await sendResponse.json().catch(() => ({ ok: false }));
  if (!sendResponse.ok || payload.ok !== true) {
    console.warn(
      `Nie wysłano przypomnienia ${item.id}: ${sendResponse.status}`,
    );
    continue;
  }
  sentKeys.add(key);
  newlySent.push({ id: item.id, fireAt: item.fireAt });
}

const cutoff = now - SENT_MAX_AGE_MS;
const nextSent = [...sent, ...newlySent].filter((item) => {
  if (!item || typeof item.fireAt !== "string") return false;
  const at = Date.parse(item.fireAt);
  return Number.isFinite(at) && at >= cutoff;
});

if (newlySent.length > 0 || nextSent.length !== sent.length) {
  const put = await fetch(
    `${supabaseUrl}/rest/v1/telegram_inboxes?id=eq.${encodeURIComponent(blobId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payload: {
          ...inbox,
          sent: nextSent,
        },
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!put.ok) {
    throw new Error(`Nie udało się zaktualizować skrzynki (${put.status}).`);
  }
}

console.log(`Wysłano ${newlySent.length} przypomnień Telegram.`);
