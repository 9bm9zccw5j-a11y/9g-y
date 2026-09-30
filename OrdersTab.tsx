import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  Calendar,
  CheckCircle2,
  CreditCard,
  Package,
  Phone,
  Search,
  Store,
  Trash2,
  User,
  Volume2,
  X,
} from "lucide-react";
import {
  ORDER_STATUS_CLS,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderFilter,
  type OrderStatus,
} from "../data/orders";
import { useOrders } from "../hooks/useOrders";
import { useMediaLibrary, type MediaItem } from "../hooks/useMediaLibrary";
import { LOYALTY_THRESHOLD, useLoyalty } from "../hooks/useLoyalty";

const money = (n: number) => n.toLocaleString("ru-RU") + " ₽";

/** «21 авг., 13:08» — как на макете */
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const months = ["янв.", "фев.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

const isNew = (s: OrderStatus) => s === "created_online" || s === "created_shop";
const isPaid = (s: OrderStatus) => s === "paid_online" || s === "paid_shop";

const isAudioNotification = (item: MediaItem) =>
  item.kind === "audio" ||
  /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(item.name) ||
  item.dataUrl.startsWith("data:audio/");

/** Короткий лейбл для бейджа как на макете. */
const SHORT_LABELS: Record<OrderStatus, string> = {
  created_online: "Новый (картой)",
  paid_online: "Оплачен (картой)",
  created_shop: "Новый (магазин)",
  paid_shop: "Оплачен (магазин)",
  archived: "Архивный",
};

/** Цвета бейджей как на макете: зелёная обводка для новых, заливка для оплаченных. */
const BADGE_CLS: Record<OrderStatus, string> = {
  created_online: "border border-emerald-400 text-emerald-600 bg-white",
  paid_online: "bg-emerald-500 text-white",
  created_shop: "border border-sky-400 text-sky-600 bg-white",
  paid_shop: "bg-teal-500 text-white",
  archived: "bg-slate-200 text-slate-500",
};

export default function OrdersTab({ onToast }: { onToast: (m: string) => void }) {
  const { orders, loading, setAdminComment, archiveOrder, deleteOrder, refreshOrders, confirmPayment } = useOrders();
  const { items: mediaItems } = useMediaLibrary();
  const loyalty = useLoyalty();
  // Защита от двойного клика: создание заявки идёт в облако 1–2 секунды.
  const payingRef = useRef<Set<string>>(new Set());

  /**
   * Ручное подтверждение оплаты в магазине. Заявка на скидочную карту
   * отправляется только после оплаты, а не в момент создания заказа.
   *
   * Онлайн-заказы («Новый (картой)») сюда не попадают: когда подключат оплату,
   * статус будет переводить в «Оплачен (картой)» вебхук платёжной системы —
   * он вызовет ту же связку applyPaidOrder + confirmPayment. Ветка paid_online
   * ниже оставлена именно для этого будущего вебхука.
   */
  const handleConfirmPay = async (o: Order) => {
    if (payingRef.current.has(o.id)) return;
    payingRef.current.add(o.id);
    try {
      const paidStatus: "paid_online" | "paid_shop" =
        o.status === "created_online" ? "paid_online" : "paid_shop";
      const purchaseSum = o.subtotal > 0 ? o.subtotal : o.total;
      let loyaltyUserId = o.loyaltyUserId;
      let cardAdded = false;
      if (purchaseSum >= LOYALTY_THRESHOLD) {
        try {
          const application = await loyalty.applyPaidOrder(
            o.customerName,
            o.customerPhone,
            purchaseSum,
            o.number,
            o.loyaltyUserId
          );
          loyaltyUserId = application.userId;
          cardAdded = application.added;
        } catch (error) {
          console.error("Заявка на карту не создана:", error);
        }
      }
      await confirmPayment(o.id, paidStatus, loyaltyUserId);
      const paidLabel = paidStatus === "paid_online" ? "Оплачен (картой)" : "Оплачен (в магазине)";
      onToast(cardAdded ? `${o.number}: ${paidLabel} + заявка на карту` : `${o.number}: ${paidLabel}`);
    } finally {
      payingRef.current.delete(o.id);
    }
  };
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("new");
  const [dateFilter, setDateFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("vodyanoy_orders_sound") === "1"
  );
  const knownSignals = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);
  const customAudio = useRef<HTMLAudioElement | null>(null);
  const orderAudio = useMemo(() => {
    const audio = mediaItems.filter(isAudioNotification);
    // Запись с понятным именем имеет приоритет, иначе берём первую аудиозапись.
    return audio.find((item) => /заказ|order|уведом|notification|new/i.test(item.name)) ?? audio[0] ?? null;
  }, [mediaItems]);

  const notifyStatus = (o: Order) =>
    o.status === "paid_online" || o.status === "created_shop";

  const signalKey = (o: Order) => `${o.id}:${o.status}`;

  const playNotification = () => {
    // Своя запись из Медиа имеет приоритет над системной озвучкой.
    if (orderAudio) {
      const audio = customAudio.current?.src === orderAudio.dataUrl
        ? customAudio.current
        : new Audio(orderAudio.dataUrl);
      customAudio.current = audio;
      audio.preload = "auto";
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Если браузер не дал проиграть файл, сработает речевой запасной вариант ниже.
        playSpeechFallback();
      });
      return;
    }
    playSpeechFallback();
  };

  function playSpeechFallback() {
    // Короткий сигнал повышает шанс, что администратор услышит событие даже если голос недоступен.
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = audioCtx.current ?? new Ctx();
        audioCtx.current = ctx;
        void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime;
        gain.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.start(t);
        osc.stop(t + 0.6);
      }
    } catch {
      // Звук может быть запрещён политиками браузера — голосовая озвучка ниже всё равно попробует сработать.
    }

    try {
      window.speechSynthesis.cancel();
      const phrase = new SpeechSynthesisUtterance("В магазин Водяной поступил новый заказ");
      phrase.lang = "ru-RU";
      phrase.rate = 0.95;
      phrase.pitch = 1;
      window.speechSynthesis.speak(phrase);
    } catch {
      // speechSynthesis отсутствует или заблокирован.
    }
  }

  const enableSound = async () => {
    localStorage.setItem("vodyanoy_orders_sound", "1");
    setSoundEnabled(true);
    // С этого момента считаем текущие заказы уже просмотренными, чтобы не озвучивать старые.
    knownSignals.current = new Set(orders.filter(notifyStatus).map(signalKey));
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtx.current = audioCtx.current ?? new Ctx();
        await audioCtx.current.resume();
      }
    } catch {
      // Safari может разрешить только speechSynthesis — это нормально.
    }
    // Safari требует, чтобы первый play произошёл прямо внутри пользовательского клика.
    // Тихо разблокируем загруженную администратором запись для будущих уведомлений.
    if (orderAudio) {
      try {
        const audio = new Audio(orderAudio.dataUrl);
        customAudio.current = audio;
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {
        // Если файл ещё не успел загрузиться, остаётся системная голосовая озвучка.
      }
    }
    onToast("Звук новых заказов включён");
  };

  // Первичная инициализация: текущие заказы не озвучиваем.
  useEffect(() => {
    if (!loading && knownSignals.current.size === 0) {
      knownSignals.current = new Set(orders.filter(notifyStatus).map(signalKey));
    }
  }, [loading, orders]);

  // Пока вкладка открыта, проверяем Supabase. Новые paid_online / created_shop озвучиваем.
  useEffect(() => {
    if (!soundEnabled) return;
    let cancelled = false;
    const tick = async () => {
      const fresh = await refreshOrders();
      if (cancelled || !Array.isArray(fresh)) return;
      const newSignals = fresh.filter(notifyStatus).filter((o) => !knownSignals.current.has(signalKey(o)));
      fresh.filter(notifyStatus).forEach((o) => knownSignals.current.add(signalKey(o)));
      if (newSignals.length > 0) playNotification();
    };
    const id = window.setInterval(tick, 12000);
    // Первый быстрый опрос через 2 секунды после включения.
    const first = window.setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, orderAudio]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filter === "new") list = list.filter((o) => isNew(o.status));
    else if (filter === "paid") list = list.filter((o) => isPaid(o.status));
    else if (filter === "archived") list = list.filter((o) => o.status === "archived");

    const digits = query.replace(/\D/g, "");
    if (digits) list = list.filter((o) => o.number.replace(/\D/g, "").includes(digits));

    if (dateFilter) {
      list = list.filter((o) => fmtDay(o.createdAt) === fmtDay(dateFilter + "T00:00:00"));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filter, query, dateFilter]);

  const counts = useMemo(() => ({
    new: orders.filter((o) => isNew(o.status)).length,
    paid: orders.filter((o) => isPaid(o.status)).length,
    archived: orders.filter((o) => o.status === "archived").length,
  }), [orders]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-slate-400">
        <Package size={20} className="mr-2 animate-pulse" /> Загружаю заказы…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ===== Верхняя панель: фильтры + поиск + календарь ===== */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Фильтры */}
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
            {([
              ["new", "Новые", counts.new],
              ["paid", "Оплаченные", counts.paid],
              ["archived", "Архивные", counts.archived],
            ] as [OrderFilter, string, number][]).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold transition ${
                  filter === key
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-black ${
                    filter === key
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Поиск по номеру */}
          <div className="relative min-w-[200px] flex-1 lg:max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <span className="absolute left-9 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-800">
              VDN
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="000-000"
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-[4.2rem] pr-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
            />
          </div>

          {/* Календарь */}
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-teal-500"
            />
          </div>
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="rounded-lg bg-slate-100 p-2 text-slate-400 transition hover:text-slate-600 active:scale-95"
            >
              <X size={14} />
            </button>
          )}
        <button
          onClick={soundEnabled ? undefined : enableSound}
          className={`ml-auto inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-black transition active:scale-95 ${
            soundEnabled
              ? "cursor-default bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-[#123a5c] text-white shadow-md shadow-[#123a5c]/15 hover:bg-[#0b2b45]"
          }`}
          title={
            soundEnabled
              ? "Озвучка новых заказов включена"
              : "Нажмите один раз, чтобы браузер разрешил звук уведомлений"
          }
        >
          <Volume2 size={15} />
          {soundEnabled ? "Звук включён" : "Включить звук"}
        </button>
        </div>
        {soundEnabled && (
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {orderAudio
              ? `Аудиозапись уведомления: ${orderAudio.name}`
              : "Своя аудиозапись не выбрана — используется системная фраза."}
          </p>
        )}
      </div>

      {/* ===== Контент ===== */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <Package size={44} className="mb-3 opacity-25" />
            <p className="text-[14px] font-bold text-slate-500">
              {orders.length === 0 ? "Заказов пока нет" : "Ничего не найдено"}
            </p>
            <p className="mt-1 text-[12px]">
              {orders.length === 0
                ? "Как только клиент оформит заказ, он появится здесь."
                : "Попробуйте изменить фильтр или запрос."}
            </p>
          </div>
        ) : (
          <>
            {/* ===== Мобильные карточки ===== */}
            <div className="space-y-2 p-4 lg:hidden">
              {filtered.map((o) => (
                <MobileCard
                  key={o.id}
                  order={o}
                  open={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onConfirmPay={() => handleConfirmPay(o)}
                  onArchive={() => { archiveOrder(o.id); onToast(`${o.number} в архиве`); }}
                  onDelete={() => {
                    if (confirmDelete === o.id) { deleteOrder(o.id); setConfirmDelete(null); onToast(`${o.number} удалён`); }
                    else { setConfirmDelete(o.id); setTimeout(() => setConfirmDelete(null), 2500); }
                  }}
                  confirmDelete={confirmDelete === o.id}
                  onCommentChange={(v) => setAdminComment(o.id, v)}
                />
              ))}
            </div>

            {/* ===== Десктоп-таблица (как на макете) ===== */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
                    <th className="px-6 py-3.5">№ заказа</th>
                    <th className="px-6 py-3.5">Дата и время</th>
                    <th className="px-6 py-3.5">Покупатель</th>
                    <th className="px-6 py-3.5">Статус</th>
                    <th className="px-6 py-3.5 text-right">Стоимость</th>
                    <th className="px-6 py-3.5">Комментарий</th>
                    <th className="w-[80px] px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o.id}
                      order={o}
                      open={openId === o.id}
                      onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                      onConfirmPay={() => handleConfirmPay(o)}
                      onArchive={() => { archiveOrder(o.id); onToast(`${o.number} в архиве`); }}
                      onDelete={() => {
                        if (confirmDelete === o.id) { deleteOrder(o.id); setConfirmDelete(null); onToast(`${o.number} удалён`); }
                        else { setConfirmDelete(o.id); setTimeout(() => setConfirmDelete(null), 2500); }
                      }}
                      confirmDelete={confirmDelete === o.id}
                      onCommentChange={(v) => setAdminComment(o.id, v)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ======================================================================== */
/*  Десктоп: строка таблицы                                                 */
/* ======================================================================== */
function TableRow({
  order: o,
  open,
  onToggle,
  onConfirmPay,
  onArchive,
  onDelete,
  confirmDelete,
  onCommentChange,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  onConfirmPay: () => void;
  onArchive: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onCommentChange: (v: string) => void;
}) {
  const [comment, setComment] = useState(o.adminComment || "");

  return (
    <>
      <tr className="border-b border-slate-100 transition hover:bg-slate-50/50">
        {/* № Заказа */}
        <td className="px-6 py-4">
          <button
            onClick={onToggle}
            className="font-mono text-[14px] font-black text-[#0b2b45] transition hover:text-teal-700"
          >
            {o.number}
          </button>
        </td>

        {/* Дата и время */}
        <td className="px-6 py-4 text-[13px] text-slate-500">{fmtDate(o.createdAt)}</td>

        {/* Покупатель */}
        <td className="px-6 py-4">
          <div className="text-[13.5px] font-bold text-slate-800">{o.customerName}</div>
          <div className="text-[12px] text-slate-400">{o.customerPhone}</div>
        </td>

        {/* Статус */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${BADGE_CLS[o.status]}`}>
              {SHORT_LABELS[o.status]}
            </span>
            {/* Только для магазина. Онлайн-оплату позже подтвердит вебхук платёжки. */}
            {o.status === "created_shop" && (
              <button
                onClick={onConfirmPay}
                title="Подтвердить оплату в магазине"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 active:scale-90"
              >
                <CheckCircle2 size={15} strokeWidth={2.8} />
              </button>
            )}
          </div>
        </td>

        {/* Стоимость */}
        <td className="px-6 py-4 text-right">
          <span className="text-[15px] font-black text-slate-800">
            {o.total.toLocaleString("ru-RU")} ₽
          </span>
        </td>

        {/* Комментарий (редактируемый инлайн) */}
        <td className="px-6 py-4">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onCommentChange(comment)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Написать комментарий…"
            className="w-full min-w-[160px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[12.5px] text-slate-600 outline-none transition placeholder:text-slate-300 hover:border-slate-200 hover:bg-slate-50 focus:border-teal-400 focus:bg-white focus:ring-1 focus:ring-teal-400/20"
          />
        </td>

        {/* Действия */}
        <td className="px-4 py-4">
          <div className="flex items-center justify-end gap-1">
            {o.status !== "archived" && (
              <button
                onClick={onArchive}
                title="В архив"
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-amber-600 active:scale-90"
              >
                <Archive size={16} />
              </button>
            )}
            <button
              onClick={onDelete}
              title={confirmDelete ? "Точно удалить?" : "Удалить"}
              className={`rounded-lg p-1.5 transition active:scale-90 ${
                confirmDelete
                  ? "bg-red-500 text-white shadow"
                  : "text-slate-300 hover:bg-slate-100 hover:text-red-500"
              }`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>

      {/* Раскрытые детали при клике на номер */}
      <AnimatePresence>
        {open && (
          <tr>
            <td colSpan={7} className="border-b border-slate-100 bg-[#f8fafb] p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-5">
                  <OrderDetails order={o} />
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ======================================================================== */
/*  Мобильная карточка                                                      */
/* ======================================================================== */
function MobileCard({
  order: o,
  open,
  onToggle,
  onConfirmPay,
  onArchive,
  onDelete,
  confirmDelete,
  onCommentChange,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  onConfirmPay: () => void;
  onArchive: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onCommentChange: (v: string) => void;
}) {
  const [comment, setComment] = useState(o.adminComment || "");

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <b className="font-mono text-[14px] font-black text-[#0b2b45]">{o.number}</b>
            <span className="text-[11px] text-slate-400">{fmtDate(o.createdAt)}</span>
          </div>
          <div className="mt-1 text-[13px] font-bold text-slate-800">{o.customerName}</div>
          <div className="text-[11.5px] text-slate-400">{o.customerPhone}</div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-black text-slate-800">{o.total.toLocaleString("ru-RU")} ₽</div>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${BADGE_CLS[o.status]}`}>
            {SHORT_LABELS[o.status]}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="space-y-3 p-3.5">
              <OrderDetails order={o} />

              <div>
                <label className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                  Комментарий администратора
                </label>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onBlur={() => onCommentChange(comment)}
                  placeholder="Например: Передан в доставку"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="flex gap-2">
                {/* Только для магазина. Онлайн-оплату позже подтвердит вебхук платёжки. */}
                {o.status === "created_shop" && (
                  <button
                    onClick={onConfirmPay}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[12.5px] font-black text-white shadow-sm active:scale-95"
                  >
                    <CheckCircle2 size={15} /> Подтвердить оплату
                  </button>
                )}
                {o.status !== "archived" && (
                  <button
                    onClick={onArchive}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-[12.5px] font-bold text-slate-500 active:scale-95"
                  >
                    <Archive size={14} /> В архив
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className={`rounded-xl p-2.5 transition active:scale-90 ${
                    confirmDelete ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======================================================================== */
/*  Детали заказа (раскрывается при клике на номер)                         */
/* ======================================================================== */
function OrderDetails({ order: o }: { order: Order }) {
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBlock icon={<User size={14} />} label="Покупатель" value={o.customerName} />
        <InfoBlock
          icon={<Phone size={14} />}
          label="Телефон"
          value={<a href={`tel:${o.customerPhone}`} className="font-bold text-teal-700">{o.customerPhone}</a>}
        />
        <InfoBlock
          icon={o.paymentMethod === "online" ? <CreditCard size={14} /> : <Store size={14} />}
          label="Оплата"
          value={o.paymentMethod === "online" ? "Карта онлайн" : "В магазине"}
        />
        {o.paidAt && (
          <InfoBlock icon={<CheckCircle2 size={14} className="text-emerald-500" />} label="Оплачен" value={fmtDate(o.paidAt)} />
        )}
      </div>

      {o.comment && (
        <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
          <b>Покупатель:</b> {o.comment}
        </div>
      )}
      {o.adminComment && (
        <div className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-[12px] text-teal-800">
          <b>Администратор:</b> {o.adminComment}
        </div>
      )}

      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
            <tr>
              <th className="px-3.5 py-2.5">Товар</th>
              <th className="px-3.5 py-2.5 text-center">Кол-во</th>
              <th className="px-3.5 py-2.5 text-right">Цена</th>
              <th className="px-3.5 py-2.5 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3.5 py-2.5 font-semibold text-slate-800">{it.name}</td>
                <td className="px-3.5 py-2.5 text-center font-bold text-slate-600">
                  {it.unit === "м" ? `${it.meters} м` : `${it.quantity} шт`}
                </td>
                <td className="px-3.5 py-2.5 text-right text-slate-500">{money(it.price)}</td>
                <td className="px-3.5 py-2.5 text-right font-black text-slate-800">{money(it.sum)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            {o.discount > 0 && (
              <tr>
                <td colSpan={3} className="px-3.5 py-2 text-right text-[11px] font-bold text-amber-600">Скидка по карте</td>
                <td className="px-3.5 py-2 text-right font-bold text-amber-600">−{money(o.discount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-3.5 py-2.5 text-right font-bold text-slate-500">Итого</td>
              <td className="px-3.5 py-2.5 text-right text-[15px] font-black text-slate-900">{money(o.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
      <span className="text-slate-400">{icon}</span>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div className="text-[12.5px] font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}
