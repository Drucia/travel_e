import { Platform } from "react-native";

import type { EventRecord, Settings } from "@/lib/db/types";
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL } from "@/lib/format";
import { createId } from "@/lib/id";
import { getPublicBase } from "@/lib/pwa";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DUE_GRACE_MS = 3 * 60 * 60 * 1000;
const DUE_AHEAD_MS = 2 * 60 * 1000;
const TIMER_CAP_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export type TelegramReminderItem = {
  id: string;
  fireAt: string;
  title: string;
  body: string;
  url: string;
};

type TelegramInbox = {
  v: 1;
  botToken: string;
  chatId: string;
  reminders: TelegramReminderItem[];
  sent: { id: string; fireAt: string }[];
};

let timer: ReturnType<typeof setTimeout> | null = null;

export function parseBotToken(raw: string): string {
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/(\d{6,}:[A-Za-z0-9_-]{20,})/);
  return match ? match[1] : raw.trim();
}

export function parseChatId(raw: string): string {
  const labeled = raw.match(/(?:id|chat(?:\s*id)?)\s*[:#]?\s*(-?\d{5,})/i);
  if (labeled) return labeled[1];
  const digits = raw.trim().match(/-?\d{5,}/);
  return digits ? digits[0] : raw.trim();
}

export function telegramConfigured(
  settings: Pick<Settings, "telegramBotToken" | "telegramChatId">,
): boolean {
  return (
    isLikelyBotToken(settings.telegramBotToken) &&
    isLikelyChatId(settings.telegramChatId)
  );
}

export function isLikelyBotToken(value: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(parseBotToken(value));
}

export function isLikelyChatId(value: string): boolean {
  return /^-?\d{5,}$/.test(parseChatId(value));
}

function telegramErrorMessage(description: string): string {
  const text = description.toLowerCase();
  if (text.includes("unauthorized")) {
    return "Token jest nieprawidłowy. Skopiuj go jeszcze raz z BotFather (całość po „HTTP API”).";
  }
  if (
    text.includes("can't initiate conversation") ||
    text.includes("bot was blocked") ||
    text.includes("forbidden")
  ) {
    return "Otwórz swojego bota (nie BotFather) i naciśnij Start. Potem spróbuj ponownie.";
  }
  if (text.includes("chat not found")) {
    return "Złe chat ID. Weź liczbę Id z @userinfobot — nie ID bota z tokenu.";
  }
  return description;
}

export function eventReminderUrl(eventId: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    if (window.location.hostname.endsWith("github.io")) {
      return `https://drucia.github.io/travel_e/event/${encodeURIComponent(eventId)}`;
    }
    const base = getPublicBase();
    return `${window.location.origin}${base}/event/${encodeURIComponent(eventId)}`;
  }
  return `https://drucia.github.io/travel_e/event/${encodeURIComponent(eventId)}`;
}

export function reminderMessage(
  event: EventRecord,
  url: string,
): { title: string; body: string; text: string } {
  const title = `${EVENT_TYPE_EMOJI[event.type]} ${EVENT_TYPE_LABEL[event.type]} już za Tobą?`;
  const body = "Uzupełnij informacje o wyjeździe.";
  return { title, body, text: `${title}\n\n${body}\n${url}` };
}

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
};

async function telegramApi(
  token: string,
  method: string,
  params: Record<string, string>,
): Promise<TelegramApiResponse> {
  const query = new URLSearchParams(params).toString();
  const direct = `https://api.telegram.org/bot${token}/${method}?${query}`;
  const urls = [
    direct,
    `https://corsproxy.io/?${encodeURIComponent(direct)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`,
  ];

  let lastError = "Nie udało się połączyć z Telegramem.";
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = (await response.json()) as TelegramApiResponse & {
        contents?: string;
      };
      if (typeof payload.contents === "string") {
        return JSON.parse(payload.contents) as TelegramApiResponse;
      }
      if (typeof payload.ok === "boolean") {
        return payload;
      }
    } catch (error) {
      lastError =
        error instanceof DOMException && error.name === "AbortError"
          ? "Telegram nie odpowiedział w ciągu 8 sekund."
          : error instanceof Error
            ? error.message
            : lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(lastError);
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  const payload = await telegramApi(parseBotToken(token), "sendMessage", {
    chat_id: parseChatId(chatId),
    text,
    disable_web_page_preview: "true",
  });
  if (payload.ok) return true;
  throw new Error(
    telegramErrorMessage(payload.description ?? "Telegram odrzucił wiadomość."),
  );
}

export async function sendTelegramTest(
  token: string,
  chatId: string,
): Promise<void> {
  const normalizedToken = parseBotToken(token);
  const normalizedChatId = parseChatId(chatId);
  if (normalizedChatId === normalizedToken.split(":")[0]) {
    throw new Error(
      "W chat ID wkleiłaś ID bota z tokenu. Otwórz @userinfobot i skopiuj swoje Id.",
    );
  }
  await sendTelegramMessage(
    normalizedToken,
    normalizedChatId,
    "Ewidencja połączona. Po treningu lub meczu dostaniesz tu przypomnienie o uzupełnieniu dojazdu.",
  );
}

export async function ensureTelegramInbox(settings: Settings): Promise<string> {
  const token = settings.telegramBotToken.trim();
  const chatId = settings.telegramChatId.trim();
  if (!token || !chatId) {
    throw new Error("Uzupełnij token bota i chat ID.");
  }

  const existingId = settings.telegramBlobId.trim();
  if (existingId) {
    try {
      const inbox = await readInbox(existingId);
      inbox.botToken = token;
      inbox.chatId = chatId;
      await writeInbox(existingId, inbox);
      return existingId;
    } catch {
      // Recreate below if the blob expired.
    }
  }

  const created = await createInbox({
    v: 1,
    botToken: token,
    chatId,
    reminders: [],
    sent: [],
  });
  return created;
}

export async function syncTelegramReminders(
  settings: Settings,
  items: TelegramReminderItem[],
): Promise<void> {
  clearTelegramTimer();
  if (!telegramConfigured(settings)) {
    return;
  }

  const upcoming = settings.reminderEnabled ? items : [];
  if (settings.telegramBlobId.trim()) {
    try {
      await mergeInboxReminders(settings, upcoming);
    } catch (error) {
      console.warn("Nie udało się zapisać skrzynki przypomnień", error);
    }
  }

  if (!settings.reminderEnabled) {
    return;
  }

  await flushDueTelegramReminders(settings, upcoming);
  armTelegramTimer(settings, upcoming);
}

export function clearTelegramTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function flushDueTelegramReminders(
  settings: Settings,
  items: TelegramReminderItem[],
): Promise<void> {
  const now = Date.now();
  const due = items.filter((item) => {
    const at = Date.parse(item.fireAt);
    return (
      Number.isFinite(at) &&
      at <= now + DUE_AHEAD_MS &&
      at >= now - DUE_GRACE_MS
    );
  });
  if (due.length === 0) return;

  const sentKeys = new Set<string>();
  if (settings.telegramBlobId.trim()) {
    try {
      const inbox = await readInbox(settings.telegramBlobId.trim());
      for (const item of inbox.sent) {
        sentKeys.add(sentKey(item.id, item.fireAt));
      }
    } catch {
      // Sending still works from the device even if the inbox is down.
    }
  }

  const newlySent: { id: string; fireAt: string }[] = [];
  for (const item of due) {
    const key = sentKey(item.id, item.fireAt);
    if (sentKeys.has(key)) continue;
    const text = `${item.title}\n\n${item.body}\n${item.url}`;
    try {
      const ok = await sendTelegramMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        text,
      );
      if (ok) {
        sentKeys.add(key);
        newlySent.push({ id: item.id, fireAt: item.fireAt });
      }
    } catch (error) {
      console.warn("Nie wysłano przypomnienia Telegram", error);
    }
  }

  if (newlySent.length > 0 && settings.telegramBlobId.trim()) {
    try {
      const inbox = await readInbox(settings.telegramBlobId.trim());
      const known = new Set(
        inbox.sent.map((item) => sentKey(item.id, item.fireAt)),
      );
      inbox.sent = [
        ...inbox.sent,
        ...newlySent.filter(
          (item) => !known.has(sentKey(item.id, item.fireAt)),
        ),
      ];
      await writeInbox(settings.telegramBlobId.trim(), pruneInbox(inbox));
    } catch {
      // Local send already happened.
    }
  }
}

function armTelegramTimer(
  settings: Settings,
  items: TelegramReminderItem[],
): void {
  if (Platform.OS !== "web" && typeof window === "undefined") return;
  const now = Date.now();
  const next = items
    .map((item) => Date.parse(item.fireAt))
    .filter((at) => Number.isFinite(at) && at > now)
    .sort((a, b) => a - b)[0];
  if (!next) return;
  const delay = Math.max(1000, Math.min(next - now, TIMER_CAP_MS));
  timer = setTimeout(() => {
    void syncTelegramReminders(settings, items);
  }, delay);
}

async function mergeInboxReminders(
  settings: Settings,
  items: TelegramReminderItem[],
): Promise<void> {
  const blobId = settings.telegramBlobId.trim();
  if (!blobId) return;
  const inbox = await readInbox(blobId);
  inbox.botToken = settings.telegramBotToken.trim();
  inbox.chatId = settings.telegramChatId.trim();
  inbox.reminders = items;
  await writeInbox(blobId, pruneInbox(inbox));
}

function pruneInbox(inbox: TelegramInbox): TelegramInbox {
  const cutoff = Date.now() - SENT_MAX_AGE_MS;
  return {
    ...inbox,
    sent: inbox.sent.filter((item) => {
      const at = Date.parse(item.fireAt);
      return Number.isFinite(at) && at >= cutoff;
    }),
  };
}

function sentKey(id: string, fireAt: string): string {
  return `${id}:${fireAt}`;
}

async function createInbox(inbox: TelegramInbox): Promise<string> {
  requireSupabaseConfig();
  const id = createId();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/telegram_inboxes`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ id, payload: inbox }),
  });
  if (!response.ok) {
    throw new Error(
      `Nie udało się utworzyć skrzynki przypomnień (${response.status}).`,
    );
  }
  return id;
}

async function readInbox(blobId: string): Promise<TelegramInbox> {
  requireSupabaseConfig();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_inboxes?id=eq.${encodeURIComponent(blobId)}&select=payload`,
    {
      headers: supabaseHeaders(blobId),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Nie udało się odczytać skrzynki przypomnień (${response.status}).`,
    );
  }
  const rows = (await response.json()) as {
    payload?: Partial<TelegramInbox>;
  }[];
  const data = rows[0]?.payload;
  if (!data) {
    throw new Error("Nie znaleziono skrzynki przypomnień.");
  }
  return normalizeInbox(data);
}

async function writeInbox(blobId: string, inbox: TelegramInbox): Promise<void> {
  requireSupabaseConfig();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_inboxes?id=eq.${encodeURIComponent(blobId)}`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(blobId),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payload: inbox,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Nie udało się zapisać skrzynki przypomnień (${response.status}).`,
    );
  }
}

function requireSupabaseConfig(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Brak konfiguracji Supabase. Ustaw EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

function supabaseHeaders(blobId?: string): Record<string, string> {
  return {
    Accept: "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...(blobId ? { "x-inbox-id": blobId } : {}),
  };
}

function normalizeInbox(data: Partial<TelegramInbox>): TelegramInbox {
  return {
    v: 1,
    botToken: typeof data.botToken === "string" ? data.botToken : "",
    chatId: typeof data.chatId === "string" ? data.chatId : "",
    reminders: Array.isArray(data.reminders)
      ? data.reminders.filter(isReminderItem)
      : [],
    sent: Array.isArray(data.sent)
      ? data.sent.filter((item): item is { id: string; fireAt: string } => {
          return Boolean(
            item &&
            typeof item.id === "string" &&
            typeof item.fireAt === "string",
          );
        })
      : [],
  };
}

function isReminderItem(value: unknown): value is TelegramReminderItem {
  if (!value || typeof value !== "object") return false;
  const item = value as TelegramReminderItem;
  return (
    typeof item.id === "string" &&
    typeof item.fireAt === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.url === "string"
  );
}
