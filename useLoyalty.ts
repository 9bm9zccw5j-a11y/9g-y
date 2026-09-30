import { useEffect, useState } from "react";
import { cloudSync } from "../utils/cloudSync";

export interface LoyaltyReceipt {
  id: number;
  sum: number;
  img?: string;
  status: "pending" | "approved" | "rejected";
  date: string;
  /** Номер заказа сайта, если чек создан автоматически из заказа от 25 000 ₽. */
  orderNumber?: string;
}

export interface LoyaltyUser {
  id: string;
  phone: string; // нормализованный: 7XXXXXXXXXX
  firstName: string;
  lastName: string;
  /** Email личного кабинета. У старых профилей может отсутствовать. */
  email?: string;
  receipts: LoyaltyReceipt[];
  cardNumber: string | null;
  /** Имя выбранного фона из медиатеки, например discount-card-background3.png. */
  cardBackgroundName?: string;
  status: "pending" | "active";
  createdAt: string;
}

export const LOYALTY_THRESHOLD = 25000;
export const LOYALTY_DISCOUNT = 0.05;

const LS_SESSION = "vodyanoy_loyalty_session_v1";

export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  return d;
}

export function formatPhone(d: string): string {
  if (d.length !== 11) return d;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

export function approvedSum(u: LoyaltyUser): number {
  return (Array.isArray(u.receipts) ? u.receipts : [])
    .filter((r) => r && r.status === "approved")
    .reduce((s, r) => s + (typeof r.sum === "number" ? r.sum : 0), 0);
}

export function pendingSum(u: LoyaltyUser): number {
  return (Array.isArray(u.receipts) ? u.receipts : [])
    .filter((r) => r && r.status === "pending")
    .reduce((s, r) => s + (typeof r.sum === "number" ? r.sum : 0), 0);
}

export function genCardNumber(users: LoyaltyUser[]): string {
  let n = "";
  do {
    n = `VDN-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (users.some((u) => u.cardNumber === n));
  return n;
}

export function useLoyalty() {
  const [users, setUsers] = useState<LoyaltyUser[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(LS_SESSION));
  const [syncing, setSyncing] = useState(false);

  // Загрузка аккаунтов из облака (Supabase) один раз при старте.
  useEffect(() => {
    let active = true;
    (async () => {
      const cloud = await cloudSync.getLoyaltyUsers();
      if (!active) return;
      if (cloud && Array.isArray(cloud)) setUsers(cloud);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveUsers = async (next: LoyaltyUser[]) => {
    setUsers(next);
    setSyncing(true);
    await cloudSync.saveLoyaltyUsers(next);
    setSyncing(false);
  };

  const currentUser = users.find((u) => u.id === sessionId) ?? null;

  const findUserByPhone = (phone: string) =>
    users.find((u) => u.phone === normalizePhone(phone)) ?? null;

  const register = (firstName: string, lastName: string, phone: string, email?: string) => {
    const user: LoyaltyUser = {
      id: `u${Date.now()}`,
      phone: normalizePhone(phone),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim().toLowerCase() || undefined,
      receipts: [],
      cardNumber: null,
      status: "pending",
      createdAt: new Date().toLocaleDateString("ru-RU"),
    };
    saveUsers([...users, user]);
    setSessionId(user.id);
    localStorage.setItem(LS_SESSION, user.id);
    return user;
  };

  const setSession = (id: string | null) => {
    setSessionId(id);
    if (id) localStorage.setItem(LS_SESSION, id);
    else localStorage.removeItem(LS_SESSION);
  };

  const addReceipt = (sum: number, img?: string) => {
    if (!currentUser) return;
    const next = users.map((u) =>
      u.id === currentUser.id
        ? {
            ...u,
            receipts: [
              ...u.receipts,
              {
                id: Date.now(),
                sum,
                img,
                status: "pending" as const,
                date: new Date().toLocaleDateString("ru-RU"),
              },
            ],
          }
        : u
    );
    saveUsers(next);
  };

  const setReceiptStatus = (userId: string, receiptId: number, status: LoyaltyReceipt["status"]) => {
    const next = users.map((u) =>
      u.id === userId
        ? { ...u, receipts: u.receipts.map((r) => (r.id === receiptId ? { ...r, status } : r)) }
        : u
    );
    saveUsers(next);
  };

  const activateUser = (userId: string) => {
    const next = users.map((u) =>
      u.id === userId
        ? { ...u, status: "active" as const, cardNumber: u.cardNumber ?? genCardNumber(users) }
        : u
    );
    saveUsers(next);
  };

  const setCardBackground = (backgroundName: string) => {
    if (!currentUser) return;
    const next = users.map((u) =>
      u.id === currentUser.id ? { ...u, cardBackgroundName: backgroundName } : u
    );
    saveUsers(next);
  };

  /**
   * Заявка на карту из ОПЛАЧЕННОГО заказа от 25 000 ₽. Вызывается из админки,
   * когда заказ переводят в «Оплачен (онлайн)» или «Оплачен (в магазине)».
   *
   * Оплаченный заказ сам становится подтверждением: добавляем одобренный чек
   * с номером заказа, администратору остаётся только нажать «Активировать карту».
   *
   * Важно: работает без привязки к сессии (оплату подтверждает администратор
   * со своего устройства, а не покупатель), сессию не трогает. Перед записью
   * подтягивает свежий список из облака, чтобы не создать дубль, если покупатель
   * зарегистрировался с другого устройства. Повторный вызов с тем же номером
   * заказа ничего не дублирует.
   */
  const applyPaidOrder = async (
    customerName: string,
    customerPhone: string,
    sum: number,
    orderNumber: string,
    existingUserId?: string
  ): Promise<{ userId: string; created: boolean; added: boolean }> => {
    const phone = normalizePhone(customerPhone);
    const cloud = await cloudSync.getLoyaltyUsers();
    const base = Array.isArray(cloud) ? cloud : users;

    // Заказ уже учтён — ничего не делаем (защита от двойного клика и повторной оплаты).
    const already = base.find((u) =>
      (u.receipts ?? []).some((r) => r.orderNumber === orderNumber)
    );
    if (already) return { userId: already.id, created: false, added: false };

    const receipt: LoyaltyReceipt = {
      id: Date.now(),
      sum: Math.round(sum),
      status: "approved",
      date: new Date().toLocaleDateString("ru-RU"),
      orderNumber,
    };

    // Сначала ищем привязанного к заказу пользователя, затем — по телефону.
    const found =
      (existingUserId ? base.find((u) => u.id === existingUserId) : undefined) ??
      base.find((u) => u.phone === phone);

    if (found) {
      // Карта уже активна — чек не нужен, просто возвращаем владельца.
      if (found.status === "active") {
        return { userId: found.id, created: false, added: false };
      }
      const next = base.map((u) =>
        u.id === found.id ? { ...u, receipts: [...(u.receipts ?? []), receipt] } : u
      );
      await saveUsers(next);
      return { userId: found.id, created: false, added: true };
    }

    // Новый покупатель — создаём заявку. Не входим в неё: это устройство
    // администратора, а покупатель войдёт по своему номеру телефона сам.
    const parts = customerName.trim().split(/\s+/).filter(Boolean);
    const user: LoyaltyUser = {
      id: `u${Date.now()}`,
      phone,
      firstName: parts[0] || "Покупатель",
      lastName: parts.slice(1).join(" "),
      receipts: [receipt],
      cardNumber: null,
      status: "pending",
      createdAt: new Date().toLocaleDateString("ru-RU"),
    };
    await saveUsers([...base, user]);
    return { userId: user.id, created: true, added: true };
  };

  return {
    users,
    currentUser,
    syncing,
    findUserByPhone,
    register,
    setSession,
    addReceipt,
    setReceiptStatus,
    activateUser,
    setCardBackground,
    applyPaidOrder,
  };
}
