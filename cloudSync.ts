import { supabase } from "./supabase";
import type { Product, Category, Brand } from "../data/catalog";
import type { LoyaltyUser } from "../hooks/useLoyalty";
import type { Plumber } from "../hooks/usePlumbers";
import type { MediaItem } from "../hooks/useMediaLibrary";
import type { Order } from "../data/orders";
import { getSupabaseCredentials } from "./supabase";

const STORE_TABLE = "vodyanoy_store";
const PRODUCTS_KEY = "products";
const CATEGORIES_KEY = "categories";
const LOYALTY_KEY = "loyalty_users";
const PLUMBERS_KEY = "plumbers";
const MEDIA_KEY = "media_library";
const ORDERS_KEY = "orders";
const BRANDS_KEY = "brands";

type HealthResult = { ok: boolean; message: string; keys?: string[] };

let lastError = "";

function rememberError(message: string) {
  lastError = message;
  console.error("Supabase:", message);
}

/** REST fallback для Safari/сетей, где supabase-js отвечает Load failed. */
async function restReadRow<T>(key: string): Promise<T | null> {
  const cfg = getSupabaseCredentials();
  const url = `${cfg.url}/rest/v1/${STORE_TABLE}?key=eq.${encodeURIComponent(key)}&select=value`;
  const response = await fetch(url, {
    method: "GET",
    headers: { apikey: cfg.key, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`REST ${response.status}: ${await response.text()}`);
  const rows = (await response.json()) as { value: T }[];
  return rows[0]?.value ?? null;
}

async function restSaveRow(key: string, value: unknown): Promise<void> {
  const cfg = getSupabaseCredentials();
  const response = await fetch(`${cfg.url}/rest/v1/${STORE_TABLE}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) throw new Error(`REST ${response.status}: ${await response.text()}`);
}

/** Запись строки в таблицу (простой upsert) с REST-фолбэком. */
async function saveRow(key: string, value: unknown): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(STORE_TABLE)
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    lastError = "";
    return true;
  } catch {
    try {
      await restSaveRow(key, value);
      lastError = "";
      return true;
    } catch (restError) {
      rememberError(
        `[${key}] ${restError instanceof Error ? restError.message : String(restError)}`
      );
      return false;
    }
  }
}

/** Чтение с повторами: null = строки нет, undefined = API недоступен. */
async function readRow<T>(key: string): Promise<T | null | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from(STORE_TABLE)
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!error) {
        lastError = "";
        return data?.value ? (data.value as T) : null;
      }
      rememberError(`[${key}] ${error.message}`);
      try {
        const direct = await restReadRow<T>(key);
        lastError = "";
        return direct;
      } catch (restError) {
        rememberError(
          `[${key}] ${restError instanceof Error ? restError.message : String(restError)}`
        );
      }
    } catch (error) {
      try {
        const direct = await restReadRow<T>(key);
        lastError = "";
        return direct;
      } catch (restError) {
        rememberError(
          `[${key}] ${restError instanceof Error ? restError.message : String(restError)}`
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
  }
  return undefined;
}

export const cloudSync = {
  async getProducts(): Promise<Product[] | null | undefined> {
    return readRow<Product[]>(PRODUCTS_KEY);
  },
  async saveProducts(products: Product[]): Promise<boolean> {
    return saveRow(PRODUCTS_KEY, products);
  },
  async getCategories(): Promise<Category[] | null | undefined> {
    return readRow<Category[]>(CATEGORIES_KEY);
  },
  async saveCategories(categories: Category[]): Promise<boolean> {
    return saveRow(CATEGORIES_KEY, categories);
  },
  async getBrands(): Promise<Brand[] | null | undefined> {
    return readRow<Brand[]>(BRANDS_KEY);
  },
  async saveBrands(brands: Brand[]): Promise<boolean> {
    return saveRow(BRANDS_KEY, brands);
  },
  async getLoyaltyUsers(): Promise<LoyaltyUser[] | null | undefined> {
    return readRow<LoyaltyUser[]>(LOYALTY_KEY);
  },
  async saveLoyaltyUsers(users: LoyaltyUser[]): Promise<boolean> {
    return saveRow(LOYALTY_KEY, users);
  },
  async getPlumbers(): Promise<Plumber[] | null | undefined> {
    return readRow<Plumber[]>(PLUMBERS_KEY);
  },
  async savePlumbers(plumbers: Plumber[]): Promise<boolean> {
    return saveRow(PLUMBERS_KEY, plumbers);
  },
  async getMedia(): Promise<MediaItem[] | null | undefined> {
    return readRow<MediaItem[]>(MEDIA_KEY);
  },
  async saveMedia(items: MediaItem[]): Promise<boolean> {
    return saveRow(MEDIA_KEY, items);
  },
  async getOrders(): Promise<Order[] | null | undefined> {
    return readRow<Order[]>(ORDERS_KEY);
  },
  async saveOrders(orders: Order[]): Promise<boolean> {
    return saveRow(ORDERS_KEY, orders);
  },
  getLastError() {
    return lastError;
  },

  /** Проверяет, что таблица доступна и показывает существующие ключи. */
  async healthCheck(): Promise<HealthResult> {
    try {
      const { data, error } = await supabase.from(STORE_TABLE).select("key").order("key");
      if (error) {
        rememberError(error.message);
        return { ok: false, message: error.message };
      }
      const keys = (data ?? []).map((row) => String(row.key));
      lastError = "";
      return {
        ok: true,
        keys,
        message: keys.length
          ? `Подключено. В облаке: ${keys.join(", ")}`
          : "Таблица доступна, но пока пустая",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rememberError(message);
      return { ok: false, message };
    }
  },

  /** Самотест: пишет строку, читает обратно, удаляет. Возвращает точную причину. */
  async selfTest(): Promise<{ ok: boolean; message: string }> {
    const testKey = "__selftest__";
    const stamp = Date.now();

    const explain = (raw: string): string => {
      const m = raw.toLowerCase();
      if (m.includes("invalid api key") || m.includes("apikey"))
        return "Неверный API-ключ. Вставьте свежий Publishable key (целиком) из Supabase → Settings → API Keys.";
      if (m.includes("jwt") || m.includes("legacy"))
        return "Ключ не подходит (legacy/JWT). Нужен новый Publishable key формата sb_publishable_...";
      if (m.includes("does not exist") || m.includes("relation") || m.includes("42p01") || m.includes("schema cache"))
        return "Таблица vodyanoy_store не найдена. Выполните SQL-настройку в Supabase.";
      if (m.includes("row-level") || m.includes("row level") || m.includes("policy") || m.includes("permission") || m.includes("denied"))
        return "Запись запрещена (RLS). Выполните SQL: disable row level security + grant.";
      if (m.includes("failed to fetch") || m.includes("networkerror"))
        return "Нет соединения с Supabase. Проверьте URL проекта и интернет.";
      return raw;
    };

    try {
      const { data: wrote, error: wErr } = await supabase
        .from(STORE_TABLE)
        .upsert({ key: testKey, value: { stamp } }, { onConflict: "key" })
        .select("key");
      if (wErr) return { ok: false, message: explain(wErr.message) };
      if (!wrote || wrote.length === 0)
        return {
          ok: false,
          message: "Запись прошла, но строка не вернулась (RLS на SELECT). Выполните SQL-настройку доступа.",
        };

      const { data: read, error: rErr } = await supabase
        .from(STORE_TABLE)
        .select("value")
        .eq("key", testKey)
        .maybeSingle();
      if (rErr) return { ok: false, message: explain(rErr.message) };
      const readStamp = (read?.value as { stamp?: number } | null)?.stamp;
      if (readStamp !== stamp)
        return { ok: false, message: "Данные записались, но не читаются обратно (проверьте SELECT)." };

      await supabase.from(STORE_TABLE).delete().eq("key", testKey);
      return { ok: true, message: "Запись и чтение работают ✅" };
    } catch (e) {
      return { ok: false, message: explain(e instanceof Error ? e.message : String(e)) };
    }
  },
};
