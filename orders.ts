/** Статусы заказа. */
export type OrderStatus =
  | "created_online"   // Создан (онлайн)
  | "paid_online"      // Оплачен (онлайн)
  | "created_shop"     // Создан (в магазине)
  | "paid_shop"        // Оплачен (в магазине)
  | "archived";        // Архивный

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created_online: "Новый (картой)",
  paid_online: "Оплачен (картой)",
  created_shop: "Новый (магазин)",
  paid_shop: "Оплачен (магазин)",
  archived: "Архивный",
};

export const ORDER_STATUS_CLS: Record<OrderStatus, string> = {
  created_online: "bg-amber-50 text-amber-700",
  paid_online: "bg-emerald-50 text-emerald-700",
  created_shop: "bg-sky-50 text-sky-700",
  paid_shop: "bg-teal-50 text-teal-700",
  archived: "bg-slate-100 text-slate-500",
};

export type PaymentMethod = "online" | "shop";

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  unit?: "шт" | "м";
  quantity?: number;
  meters?: number;
  sum: number;
}

export interface Order {
  id: string;
  /** Формат: VDN***-*** (например VDN001-421) */
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  total: number;
  discount: number;
  customerName: string;
  customerPhone: string;
  /** Комментарий администратора (редактируемый в таблице). */
  adminComment?: string;
  /** Комментарий покупателя при оформлении. */
  comment?: string;
  loyaltyUserId?: string;
  items: OrderItem[];
  createdAt: string;
  paidAt?: string;
}

/** Группа сортировки для вкладки. */
export type OrderFilter = "new" | "paid" | "archived";
