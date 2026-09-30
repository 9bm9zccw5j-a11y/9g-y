import { useEffect, useState } from "react";
import { CalendarClock, Timer } from "lucide-react";
import { formatCutoff, formatDeliveryDate, formatTimeLeft, upcomingDeliveries } from "../utils/delivery";

/**
 * Информация о доставке под заказ: две ближайшие доставки и обратный отсчёт
 * до крайнего срока заказа. Обновляется каждые 30 секунд без перезагрузки страницы.
 *
 * Формат строк — «Ближайшая доставка 28 сентября (при заказе до 25 сентября, 09:00)»:
 * жирным выделена только дата привоза, срок заказа — спокойным начертанием в скобках.
 */
export default function PreOrderInfo() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [near, next] = upcomingDeliveries(now);
  if (!near) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-orange-100">
      {/* шапка: на узком экране переносится на две строки, ничего не сжимается */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2.5 text-white">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <CalendarClock size={16} className="shrink-0" />
          <span className="text-[12.5px] font-black">Под заказ · привоз от Triton</span>
          {/* Отсчёт до конца приёма заказов — только на десктопе: на телефоне он сбивает плашку. */}
          <span className="hidden items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[10.5px] font-black backdrop-blur lg:ml-auto lg:inline-flex">
            <Timer size={11} />
            осталось {formatTimeLeft(near.cutoff, now)}
          </span>
        </div>
      </div>

      {/* тело без лишних вложеностей и отступов: строки выровнены по одному краю */}
      <div className="bg-white px-3.5 py-3">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Ближайшая доставка{" "}
          <span className="text-[15.5px] font-black text-slate-900">{formatDeliveryDate(near.delivery)}</span>{" "}
          <span className="text-slate-500">(при заказе до {formatCutoff(near.cutoff)})</span>
        </p>

        {next && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-[12.5px] leading-relaxed text-slate-500">
            Следующая доставка{" "}
            <span className="text-[14px] font-black text-slate-800">{formatDeliveryDate(next.delivery)}</span>{" "}
            <span className="text-slate-400">(при заказе до {formatCutoff(next.cutoff)})</span>
          </p>
        )}

        <p className="mt-2 text-[11.5px] font-semibold leading-relaxed text-slate-500">
          Магазин «Водяной», Луга, пр. Кирова, д. 80 · самовывоз бесплатно
        </p>

        <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
          Успейте заказать до пятницы 09:00 — иначе товар уедет следующим рейсом.
        </p>
      </div>
    </div>
  );
}
