/**
 * Календарь поставок под заказ у поставщика Triton.
 *
 * Правило: заказ, оформленный до пятницы 09:00 текущей недели, поставщик привозит
 * в понедельник следующей недели (ближайший понедельник после пятницы отсечки).
 * Все даты считаются от текущего времени устройства и обновляются в реальном времени.
 */

export interface PreOrderDates {
  /** Крайний срок заказа — пятница 09:00. */
  cutoff: Date;
  /** День привоза в магазин — понедельник после пятницы отсечки. */
  delivery: Date;
}

/** Пятница 09:00 недели со сдвигом weekOffset (0 — текущая неделя). */
function cutoffForWeek(now: Date, weekOffset: number): Date {
  const day = now.getDay(); // 0 — воскресенье
  const toFriday = (5 - day + 7) % 7; // 0, если сегодня пятница
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + toFriday + weekOffset * 7, 9, 0, 0, 0);
}

/** Ближайший понедельник после пятницы отсечки (+3 дня). */
function mondayAfter(friday: Date): Date {
  return new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 3, 0, 0, 0, 0);
}

/** Две ближайшие поставки, по которым ещё можно успеть заказать. */
export function upcomingDeliveries(now: Date = new Date()): PreOrderDates[] {
  const res: PreOrderDates[] = [];
  for (let w = 0; w < 8 && res.length < 2; w++) {
    const cutoff = cutoffForWeek(now, w);
    if (cutoff.getTime() > now.getTime()) {
      res.push({ cutoff, delivery: mondayAfter(cutoff) });
    }
  }
  return res;
}

/** «25 сентября» */
export function formatDeliveryDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** «25 сентября, 09:00» */
export function formatCutoff(d: Date): string {
  return `${formatDeliveryDate(d)}, 09:00`;
}

/** «пятница» */
export function formatWeekday(d: Date): string {
  return d.toLocaleDateString("ru-RU", { weekday: "long" });
}

/** «пт, 25 сентября» — короткая строка для компактных плашек. */
export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

/** «2 дн. 5 ч. 12 мин.» — сколько осталось до крайнего срока ближайшего заказа. */
export function formatTimeLeft(target: Date, now: Date = new Date()): string {
  let s = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} ${plural(days, "день", "дня", "дней")}`);
  if (hours) parts.push(`${hours} ${plural(hours, "час", "часа", "часов")}`);
  // Минуты показываем, пока до отсечки меньше суток — иначе строка не сжимается в плашку.
  if (!days) parts.push(`${minutes} ${plural(minutes, "минута", "минуты", "минут")}`);
  return parts.join(" ");
}

/** Ключи брендов, товары которых заказываются под заказ с привозом в понедельник. */
export const PREORDER_BRAND_KEYS = ["triton"];

/**
 * Товар под заказ: нет в наличии, но бренд (например, Triton) возит по календарю поставок.
 * Для таких товаров показываем календарь поставок и разрешаем оформить заказ.
 */
export function isPreOrder(p: { inStock: boolean; brandId?: string }): boolean {
  return !p.inStock && !!p.brandId && PREORDER_BRAND_KEYS.includes(p.brandId.toLowerCase());
}
