import { useEffect, useState } from "react";
import { cloudSync } from "../utils/cloudSync";
import type { Order, OrderStatus } from "../data/orders";

const STORAGE_KEY = "vodyanoy_orders_v1";

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  useEffect(() => {
    let active = true;
    (async () => {
      const cloud = await cloudSync.getOrders();
      if (!active) return;
      if (cloud === undefined) {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(cached)) setOrders(cached);
        setSyncStatus("error");
      } else if (cloud && cloud.length > 0) {
        setOrders(cloud);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        setSyncStatus("synced");
      } else {
        setOrders([]);
        setSyncStatus("synced");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Оформление, таблица «Заказы» и «Статистика» создают отдельные экземпляры хука.
  // Событие синхронизирует их сразу, без ожидания очередного запроса к Supabase.
  useEffect(() => {
    const onOrdersUpdate = (event: Event) => {
      const next = (event as CustomEvent<Order[]>).detail;
      if (Array.isArray(next)) {
        setOrders(next);
        setLoading(false);
        setSyncStatus("synced");
      }
    };
    window.addEventListener("vodyanoy-orders-updated", onOrdersUpdate);
    return () => window.removeEventListener("vodyanoy-orders-updated", onOrdersUpdate);
  }, []);

  const save = async (next: Order[]) => {
    setOrders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("vodyanoy-orders-updated", { detail: next }));
    setSyncStatus("syncing");
    const ok = await cloudSync.saveOrders(next);
    setSyncStatus(ok ? "synced" : "error");
  };

  /** VDN001-421 формат: 3 цифры + дефис + 3 цифры */
  const nextNumber = (): string => {
    const max = orders.reduce((m, o) => {
      const d = (o.number || "").replace(/\D/g, "");
      const n = Number(d);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const next = max + 1;
    const s = String(next).padStart(6, "0");
    return `VDN${s.slice(0, 3)}-${s.slice(3)}`;
  };

  const addOrder = (o: Omit<Order, "id" | "number" | "createdAt">): Order => {
    const order: Order = { ...o, id: `o${Date.now()}`, number: nextNumber(), createdAt: new Date().toISOString() };
    save([order, ...orders]);
    return order;
  };

  const setStatus = (id: string, status: OrderStatus) =>
    save(orders.map((o) =>
      o.id === id ? {
        ...o,
        status,
        paidAt: (status === "paid_online" || status === "paid_shop") ? (o.paidAt || new Date().toISOString()) : o.paidAt,
      } : o
    ));

  /**
   * Подтверждение оплаты одним сохранением: статус + дата оплаты + привязка
   * к владельцу заявки на карту. Отдельные setStatus + setLoyaltyUserId подряд
   * использовать нельзя — второй перезапишет первый из-за устаревшего стейта.
   */
  const confirmPayment = (
    id: string,
    paidStatus: "paid_online" | "paid_shop",
    loyaltyUserId?: string
  ) =>
    save(orders.map((o) =>
      o.id === id
        ? {
            ...o,
            status: paidStatus,
            paidAt: o.paidAt || new Date().toISOString(),
            ...(loyaltyUserId ? { loyaltyUserId } : {}),
          }
        : o
    ));

  const setAdminComment = (id: string, adminComment: string) =>
    save(orders.map((o) => (o.id === id ? { ...o, adminComment } : o)));

  const archiveOrder = (id: string) => setStatus(id, "archived");

  const deleteOrder = (id: string) => save(orders.filter((o) => o.id !== id));

  const refreshOrders = async () => {
    const cloud = await cloudSync.getOrders();
    if (cloud === undefined) {
      setSyncStatus("error");
      return false;
    }
    const next = cloud ?? [];
    setOrders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSyncStatus("synced");
    return next;
  };

  return {
    orders,
    loading,
    syncStatus,
    addOrder,
    setStatus,
    confirmPayment,
    setAdminComment,
    archiveOrder,
    deleteOrder,
    refreshOrders,
  };
}
