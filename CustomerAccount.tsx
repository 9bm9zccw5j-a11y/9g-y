import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  Camera,
  CheckCircle2,
  FileText,
  LogIn,
  LogOut,
  Package,
  Receipt,
  RotateCcw,
  Sparkles,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import {
  LOYALTY_DISCOUNT,
  LOYALTY_THRESHOLD,
  approvedSum,
  formatPhone,
  normalizePhone,
  pendingSum,
  type useLoyalty,
} from "../hooks/useLoyalty";
import { useOrders } from "../hooks/useOrders";
import { ORDER_STATUS_CLS, type Order } from "../data/orders";
import type { MediaItem } from "../hooks/useMediaLibrary";
import { imageFileToDataUrl } from "../utils/imageUpload";

type LoyaltyApi = ReturnType<typeof useLoyalty>;

const money = (n: unknown) =>
  `${typeof n === "number" && Number.isFinite(n) ? n : 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
const num = (n: unknown) =>
  `${typeof n === "number" && Number.isFinite(n) ? n : 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmtDate = (iso: string) =>
  new Date(iso || Date.now()).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function statusShort(status: Order["status"]) {
  switch (status) {
    case "created_online":
      return "Создан (онлайн)";
    case "paid_online":
      return "Оплачен (онлайн)";
    case "created_shop":
      return "Создан (в магазине)";
    case "paid_shop":
      return "Оплачен (в магазине)";
    default:
      return "Архивный";
  }
}

/** Старые заказы из Supabase могли быть сохранены до появления личного кабинета. */
function safeOrder(raw: unknown): Order | null {
  // В таблице могли остаться null/устаревшие JSON-записи от старых версий сайта.
  // Не даём одной такой записи сломать личный кабинет целиком.
  if (!raw || typeof raw !== "object") return null;
  const order = raw as Partial<Order> & Record<string, unknown>;
  const allowedStatuses = new Set<Order["status"]>([
    "created_online",
    "paid_online",
    "created_shop",
    "paid_shop",
    "archived",
  ]);
  const status = allowedStatuses.has(order.status as Order["status"])
    ? (order.status as Order["status"])
    : "created_shop";
  return {
    ...(order as Order),
    id: String(order.id || "legacy"),
    number: typeof order.number === "string" ? order.number : "VDN000-000",
    status,
    paymentMethod: order.paymentMethod === "online" ? "online" : "shop",
    customerName: typeof order.customerName === "string" ? order.customerName : "Покупатель",
    customerPhone: typeof order.customerPhone === "string" ? order.customerPhone : "",
    total: typeof order.total === "number" ? order.total : 0,
    subtotal: typeof order.subtotal === "number" ? order.subtotal : 0,
    discount: typeof order.discount === "number" ? order.discount : 0,
    createdAt: typeof order.createdAt === "string" ? order.createdAt : new Date(0).toISOString(),
    items: Array.isArray(order.items) ? order.items : [],
  };
}

type CustomerAccountProps = {
  open: boolean;
  onClose: () => void;
  routePath: string;
  onNavigate: (path: string) => void;
  loyalty: LoyaltyApi;
  /** Загружается из медиатеки: файл logo.png. */
  logoUrl: string;
  /** Готовая лицевая сторона: файл discount-card-background.png из «Медиа». */
  cardBackgroundUrl?: string;
  /** Все файлы из «Медиа» для выбора личного фона карты. */
  mediaItems: MediaItem[];
};

class AccountErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { error: boolean; message: string }
> {
  state = { error: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { error: true, message: error.message || "Неизвестная ошибка" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Личный кабинет:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#f4f8fa] p-5">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-100">
          <UserRound size={34} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-[18px] font-black text-slate-800">Не удалось открыть кабинет</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Не удалось загрузить часть данных личного кабинета.
          </p>
          <p className="mt-3 rounded-xl bg-slate-50 p-2 text-left font-mono text-[10px] text-slate-400">
            {this.state.message}
          </p>
          <button
            onClick={this.props.onClose}
            className="mt-5 w-full rounded-full bg-[#123a5c] py-3 text-[14px] font-black text-white active:scale-[0.98]"
          >
            Вернуться в магазин
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Скидочная карта физической пропорции банковской карты (1.586:1).
 * Переворот сделан CSS-ом: клик по карте показывает обратную сторону.
 */
function VodyanoyDiscountCard({
  user,
  logoUrl,
  cardBackgroundUrl,
}: {
  user: NonNullable<LoyaltyApi["currentUser"]>;
  logoUrl: string;
  cardBackgroundUrl?: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="loyalty-card-scene mx-auto w-full max-w-[560px]">
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setFlipped((value) => !value);
          }
        }}
        aria-label={flipped ? "Показать лицевую сторону скидочной карты" : "Показать обратную сторону скидочной карты"}
        aria-pressed={flipped}
        className="group block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/40"
      >
        <div className={`loyalty-card-3d drop-shadow-[0_22px_30px_rgba(11,43,69,0.28)] ${flipped ? "is-flipped" : ""}`}>
          {/* Лицевая сторона */}
          <div className="loyalty-card-face bg-[#0b2b45] text-white">
            {cardBackgroundUrl ? (
              <>
                <img src={cardBackgroundUrl} alt="Скидочная карта Водяной" className="absolute inset-0 h-full w-full object-cover" />
                <div className="discount-card-gloss" />
                <span className="absolute right-[6%] top-[8%] z-10 rounded-xl border border-[#c9ffff] bg-[linear-gradient(135deg,#e8fffc,#8ce9e4)] px-[3%] py-[1.7%] text-[clamp(14px,2.2vw,23px)] font-black tracking-[-.04em] text-[#0b4b58] shadow-[0_6px_16px_rgba(0,20,40,.24)]">
                  {Math.round(LOYALTY_DISCOUNT * 100)}%
                </span>
                {/* Мягкая нижняя подложка только под персональные данные: не меняет дизайн самой карты. */}
                <div className="absolute inset-x-0 bottom-0 h-[43%] bg-[linear-gradient(180deg,transparent,rgba(4,25,42,.64))]" />
                <div className="absolute inset-x-[7%] bottom-[7%] flex items-end justify-between text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.45)]">
                  <div>
                    <div className="text-[clamp(6px,.85vw,9px)] font-bold uppercase tracking-[0.16em] text-white/70">Владелец</div>
                    <div className="mt-1 text-[clamp(9px,1.35vw,14px)] font-extrabold uppercase tracking-[0.05em]">
                      {user.lastName || ""} {user.firstName || "Покупатель"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[clamp(6px,.85vw,9px)] font-bold uppercase tracking-[0.16em] text-white/70">Телефон</div>
                    <div className="mt-1 text-[clamp(9px,1.35vw,14px)] font-extrabold">
                      {formatPhone(user.phone || "")}
                    </div>
                  </div>
                </div>
                <div className="absolute left-[7%] bottom-[22%] font-mono text-[clamp(14px,2.6vw,27px)] font-bold tracking-[0.14em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.45)]">
                  {user.cardNumber || "VDN-••••-••••"}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0b2b45] to-teal-600 p-8 text-center">
                <img src={logoUrl} alt="Водяной" className="h-24 w-24 object-contain" />
                <span className="ml-4 text-[18px] font-black">Загрузите discount-card-background.png в Медиа</span>
              </div>
            )}
          </div>

          {/* Обратная сторона */}
          <div className="loyalty-card-face loyalty-card-back bg-[#0b2b45] text-white">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#102d46,#0f5962_60%,#0b8477)]" />
            <div className="relative z-10 flex h-full flex-col">
              {/* Магнитная полоса */}
              <div className="mt-[11%] h-[18%] w-full bg-[#031623] shadow-[inset_0_2px_rgba(255,255,255,.08)]" />

              {/* Обратная сторона без персональных данных. */}
              <div className="mx-[7%] mt-[7%] rounded-md bg-white px-[4%] py-[3%] text-[#123a5c] shadow-[0_2px_4px_rgba(0,0,0,.12)]">
                <div className="text-[clamp(6px,.8vw,9px)] font-bold uppercase tracking-[0.16em] text-slate-400">Скидочная карта «Водяной»</div>
                <div className="mt-[2%] text-[clamp(9px,1.3vw,13px)] font-semibold text-slate-600">
                  Предъявите карту при покупке или назовите номер телефона кассиру.
                </div>
              </div>

              <div className="mx-[7%] mt-[8%] flex items-end justify-between">
                <div>
                  <div className="text-[clamp(8px,1.1vw,12px)] font-semibold leading-relaxed text-white/70">
                    Скидка применяется автоматически<br />
                    при оформлении заказа в кабинете.
                  </div>
                </div>
                <img src={logoUrl} alt="Водяной" className="h-14 w-14 object-contain opacity-90 lg:h-16 lg:w-16" />
              </div>

              <div className="mt-auto flex items-center justify-between px-[7%] pb-[6%] text-[clamp(7px,.9vw,10px)] text-white/45">
                <span>vodyanoy.ru</span>
                <img src={logoUrl} alt="Водяной" className="h-8 w-8 object-contain opacity-80 lg:h-10 lg:w-10" />
              </div>
            </div>
          </div>
        </div>
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
        <RotateCcw size={12} /> Нажмите на карту, чтобы перевернуть
      </p>
    </div>
  );
}

function CustomerAccountContent({
  open,
  onClose,
  onNavigate,
  loyalty,
  logoUrl,
  cardBackgroundUrl,
  mediaItems,
}: CustomerAccountProps) {
  const { orders, loading: ordersLoading } = useOrders();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  // Форма добавления чека.
  const [adding, setAdding] = useState(false);
  const [sumInput, setSumInput] = useState("");
  const [pendingImg, setPendingImg] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const accountScrollRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = loyalty.currentUser;
  // Данные в Supabase могли быть сохранены до появления личного кабинета.
  // Нормализуем их, чтобы старые записи не ломали весь экран.
  const accountUser = user
    ? {
        ...user,
        firstName: user.firstName || "Покупатель",
        lastName: user.lastName || "",
        phone: user.phone || "",
        receipts: Array.isArray(user.receipts) ? user.receipts.filter(Boolean) : [],
      }
    : null;

  // Новый вход всегда начинает читать с первого блока.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      accountScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, accountUser?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const userOrders = useMemo(() => {
    if (!accountUser) return [];
    const normalizedPhone = normalizePhone(accountUser.phone);
    return (Array.isArray(orders) ? orders : [])
      .map(safeOrder)
      .filter((order): order is Order => order !== null)
      .filter(
        (order) =>
          order &&
          (order.loyaltyUserId === accountUser.id ||
            (typeof order.customerPhone === "string" &&
              normalizePhone(order.customerPhone) === normalizedPhone))
      )
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [orders, accountUser]);

  const paidSum = useMemo(
    () =>
      userOrders
        .filter((o) => o.status === "paid_online" || o.status === "paid_shop")
        .reduce((s, o) => s + (typeof o.total === "number" ? o.total : 0), 0),
    [userOrders]
  );

  const handleAuth = () => {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 11) {
      setError("Введите корректный номер телефона");
      return;
    }

    if (mode === "login") {
      const found = loyalty.findUserByPhone(phone);
      if (!found) {
        setError("Карта по этому номеру не найдена. Зарегистрируйтесь.");
        return;
      }
      loyalty.setSession(found.id);
      setError("");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("Введите имя и фамилию");
      return;
    }
    if (loyalty.findUserByPhone(phone)) {
      setError("Этот номер уже зарегистрирован. Войдите в кабинет.");
      return;
    }
    loyalty.register(firstName, lastName, phone, email);
    setError("");
  };

  const approved = accountUser ? approvedSum(accountUser) : 0;
  const pending = accountUser ? pendingSum(accountUser) : 0;
  const remaining = Math.max(0, LOYALTY_THRESHOLD - approved);
  const progress = Math.min(100, (approved / LOYALTY_THRESHOLD) * 100);
  const orderReceipts = accountUser ? accountUser.receipts.filter((r) => r.orderNumber) : [];
  const lastOrderReceipt = orderReceipts[orderReceipts.length - 1];

  const onReceiptFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      setPendingImg(await imageFileToDataUrl(f));
      setToast("Фото чека прикреплено");
    } catch {
      setToast("Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const submitReceipt = () => {
    const sum = Math.round(Number(sumInput.replace(/\s/g, "")));
    if (!sum || sum <= 0) return;
    loyalty.addReceipt(sum, pendingImg);
    setSumInput("");
    setPendingImg(undefined);
    setAdding(false);
    setToast(`Чек на ${num(sum)} ₽ отправлен на проверку`);
  };

  const cardBackgrounds = useMemo(
    () =>
      mediaItems
        .filter((item) => /^discount-card-background(?:[2-9]|[1-9]\d+)?\.png$/i.test(item.name.trim()))
        .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true })),
    [mediaItems]
  );
  const selectedCardBackground = accountUser
    ? cardBackgrounds.find((item) => item.name === accountUser.cardBackgroundName) ??
      cardBackgrounds.find((item) => item.dataUrl === cardBackgroundUrl) ??
      cardBackgrounds[0] ??
      null
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] bg-[#f4f8fa]"
        >
          <div className="flex h-full flex-col">
            <header className="flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_2px_16px_rgba(15,60,70,0.08)]">
              <button
                onClick={onClose}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-[17px] font-black leading-none tracking-tight text-slate-800">
                  Личный кабинет
                </h2>
                <p className="mt-1 text-[11.5px] font-medium text-slate-400">
                   {accountUser ? "Покупки и скидочная карта" : "Вход по номеру телефона"}
                </p>
              </div>
              <UserRound size={23} className="ml-auto text-teal-600" strokeWidth={2.2} />
            </header>

            {!accountUser ? (
              <main ref={accountScrollRef} className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto max-w-md">
                  <div className="rounded-3xl bg-gradient-to-br from-[#0b2b45] via-[#0f5e63] to-teal-600 p-5 text-white shadow-lg shadow-teal-900/20">
                    <BadgePercent size={24} className="text-amber-300" />
                    <h3 className="mt-3 text-[20px] font-black">Ваши покупки и скидки в одном месте</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/80">
                      В кабинете видна история заказов, статусы оплаты и скидочная карта «Водяной».
                    </p>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-1.5 shadow-sm">
                    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                      <button
                        onClick={() => {
                          setMode("login");
                          setError("");
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-black transition ${
                          mode === "login" ? "bg-white text-[#123a5c] shadow-sm" : "text-slate-400"
                        }`}
                      >
                        <LogIn size={15} /> Войти
                      </button>
                      <button
                        onClick={() => {
                          setMode("register");
                          setError("");
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-black transition ${
                          mode === "register" ? "bg-white text-[#123a5c] shadow-sm" : "text-slate-400"
                        }`}
                      >
                        <UserPlus size={15} /> Регистрация
                      </button>
                    </div>

                    <div className="space-y-3 px-3 pb-3 pt-4">
                      {mode === "register" && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="Имя"
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-teal-500 focus:bg-white"
                            />
                            <input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder="Фамилия"
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-teal-500 focus:bg-white"
                            />
                          </div>
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email (необязательно)"
                            type="email"
                            inputMode="email"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-teal-500 focus:bg-white"
                          />
                        </div>
                      )}
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+7 (___) ___-__-__"
                        inputMode="tel"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-teal-500 focus:bg-white"
                      />
                      {error && <p className="text-[12.5px] font-bold text-red-500">{error}</p>}
                      <button
                        onClick={handleAuth}
                        className="w-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 py-3.5 text-[14px] font-black text-white shadow-lg shadow-teal-600/25 active:scale-[0.98]"
                      >
                        {mode === "login" ? "Войти в кабинет" : "Создать кабинет"}
                      </button>
                    </div>
                  </div>
                </div>
              </main>
            ) : (
              <main ref={accountScrollRef} className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-8">
                <div className="mx-auto max-w-6xl">
                  <h1 className="text-[26px] font-black tracking-tight text-slate-900 lg:text-[34px]">
                    Личный кабинет
                  </h1>
                  <p className="mt-1 text-[13px] font-medium text-slate-400 lg:text-[14px]">
                    Скидочная карта, чеки и история заказов
                  </p>

                  <div className="mt-5 grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
                    {/* ===== Левая колонка: профиль, карта/накопление, чеки ===== */}
                    <div className="min-w-0 space-y-4">
                      {/* Профиль */}
                      <section className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#123a5c] to-teal-600 text-[15px] font-black text-white">
                          {accountUser.firstName[0]?.toUpperCase()}{accountUser.lastName[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-black text-slate-800">
                            {accountUser.firstName} {accountUser.lastName}
                          </h3>
                          <p className="mt-0.5 text-[12.5px] font-semibold text-slate-400">
                            {formatPhone(accountUser.phone)}
                          </p>
                        </div>
                        <button
                          onClick={() => loyalty.setSession(null)}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-bold text-slate-500 transition hover:bg-slate-200 active:scale-95"
                        >
                          <LogOut size={15} /> Выйти
                        </button>
                      </section>

                      {accountUser.status === "active" ? (
                        <>
                          <VodyanoyDiscountCard
                            user={accountUser}
                            logoUrl={logoUrl}
                            cardBackgroundUrl={selectedCardBackground?.dataUrl}
                          />
                          <button
                            onClick={() => setCardEditorOpen(true)}
                            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-teal-300 active:scale-[0.99]"
                          >
                            <div>
                              <h3 className="text-[14px] font-black text-slate-800">Оформление карты</h3>
                              <p className="mt-0.5 text-[11.5px] text-slate-400">
                                {selectedCardBackground ? "Выбрано оформление" : "Выберите фон скидочной карты"}
                              </p>
                            </div>
                            <span className="rounded-xl bg-teal-50 px-3 py-2 text-[12px] font-black text-teal-700">
                              Изменить фон
                            </span>
                          </button>
                          <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                            <p className="text-[13px] font-semibold leading-relaxed">
                              Карта активна. Скидка {Math.round(LOYALTY_DISCOUNT * 100)}% применяется автоматически при оформлении заказа.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Накопление на карту */}
                          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b2b45] via-[#134e5e] to-[#2aa79b] p-5 text-white shadow-lg shadow-teal-900/20">
                            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                            <div className="relative flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-white/85">
                              <BadgePercent size={16} className="text-amber-300" />
                              Накопление на карту
                            </div>
                            <div className="relative mt-3 flex items-baseline gap-2">
                              <span className="text-[34px] font-black leading-none">{num(approved)}</span>
                              <span className="text-[18px] font-bold text-white/60">/ {money(LOYALTY_THRESHOLD)}</span>
                            </div>
                            <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
                              <motion.div
                                animate={{ width: `${progress}%` }}
                                transition={{ type: "spring", damping: 20, stiffness: 120 }}
                                className="h-full rounded-full bg-white/90"
                              />
                            </div>
                            <p className="relative mt-3 text-[13.5px] font-medium text-white/90">
                              {remaining > 0 ? (
                                <>Осталось <b className="font-black text-white">{money(remaining)}</b> до скидки {Math.round(LOYALTY_DISCOUNT * 100)}%</>
                              ) : (
                                <b className="font-black text-white">Сумма набрана — ждём активации администратором!</b>
                              )}
                            </p>
                            {pending > 0 && (
                              <p className="relative mt-1 text-[12px] font-semibold text-amber-200">
                                На проверке: {money(pending)}
                              </p>
                            )}
                          </section>

                          {lastOrderReceipt && (
                            <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                              <p className="text-[12.5px] font-semibold leading-relaxed">
                                Заявка создана автоматически по заказу {lastOrderReceipt.orderNumber} на{" "}
                                {money(lastOrderReceipt.sum)} — скидка 5% уже применена к заказу. Администратор
                                активирует карту, и скидка станет постоянной.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Чеки */}
                      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                        <div className="flex items-center gap-2">
                          <Receipt size={18} className="text-teal-600" />
                          <h3 className="text-[17px] font-black text-slate-800">Мои чеки</h3>
                          <span className="text-[15px] font-bold text-slate-400">{accountUser.receipts.length}</span>
                          {accountUser.status !== "active" && !adding && (
                            <button
                              onClick={() => setAdding(true)}
                              className="ml-auto rounded-full bg-teal-50 px-4 py-2 text-[13px] font-black text-teal-700 transition hover:bg-teal-100 active:scale-95"
                            >
                              + Добавить чек
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {adding && accountUser.status !== "active" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 space-y-2.5 rounded-2xl bg-slate-50 p-3">
                                <input
                                  value={sumInput}
                                  onChange={(e) => setSumInput(e.target.value)}
                                  placeholder="Сумма чека, ₽"
                                  inputMode="numeric"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                />
                                <input
                                  ref={fileRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => onReceiptFile(e.target.files?.[0])}
                                />
                                {pendingImg ? (
                                  <button
                                    onClick={() => fileRef.current?.click()}
                                    className="flex w-full items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-2 text-left transition active:scale-[0.99]"
                                  >
                                    <img src={pendingImg} alt="" className="h-12 w-12 rounded-lg object-cover" />
                                    <span className="text-[13px] font-bold text-emerald-700">
                                      Фото прикреплено — нажмите, чтобы заменить
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white py-3.5 text-[14px] font-bold text-slate-500 transition hover:border-teal-300 hover:text-teal-700 active:scale-[0.99] disabled:opacity-60"
                                  >
                                    <Camera size={17} />
                                    {uploading ? "Загружаем фото…" : "Сфотографировать чек"}
                                  </button>
                                )}
                                <div className="flex gap-2.5">
                                  <button
                                    onClick={() => {
                                      setAdding(false);
                                      setSumInput("");
                                      setPendingImg(undefined);
                                    }}
                                    className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-[14px] font-bold text-slate-500 transition active:scale-[0.98]"
                                  >
                                    Отмена
                                  </button>
                                  <button
                                    onClick={submitReceipt}
                                    disabled={!Number(sumInput.replace(/\s/g, ""))}
                                    className="flex-1 rounded-full bg-teal-600 py-3 text-[14px] font-black text-white shadow-md shadow-teal-600/20 transition active:scale-[0.98] disabled:opacity-40"
                                  >
                                    Отправить
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {accountUser.receipts.length === 0 ? (
                          <p className="py-6 text-center text-[13px] font-medium leading-relaxed text-slate-400">
                            Пока нет чеков — добавьте первый, чтобы начать копить на карту.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-1.5">
                            {[...accountUser.receipts].reverse().map((receipt) => (
                              <div key={receipt.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                                {receipt.img ? (
                                  <img src={receipt.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                ) : (
                                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                                    <Receipt size={17} />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <b className="text-[13px] text-slate-700">{money(receipt.sum)}</b>
                                  <p className="text-[10.5px] text-slate-400">
                                    {receipt.date}
                                    {receipt.orderNumber && (
                                      <span className="ml-1.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-black text-teal-700">
                                        Заказ {receipt.orderNumber}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold ${
                                  receipt.status === "approved"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : receipt.status === "rejected"
                                    ? "bg-red-50 text-red-500"
                                    : "bg-amber-50 text-amber-600"
                                }`}>
                                  {receipt.status === "approved" ? "Подтверждён" : receipt.status === "rejected" ? "Отклонён" : "На проверке"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    {/* ===== Правая колонка: статистика и заказы ===== */}
                    <div className="min-w-0 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Заказов</p>
                          <p className="mt-2 text-[30px] font-black leading-none text-slate-900">{userOrders.length}</p>
                        </div>
                        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Оплачено</p>
                          <p className="mt-2 text-[30px] font-black leading-none text-slate-900">{money(paidSum)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 px-1 pt-1">
                        <Package size={19} className="text-teal-600" />
                        <h3 className="text-[20px] font-black tracking-tight text-slate-900">Мои заказы</h3>
                      </div>

                      {ordersLoading ? (
                        <div className="rounded-3xl bg-white p-10 text-center text-[13px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-100">
                          Загружаю покупки…
                        </div>
                      ) : userOrders.length === 0 ? (
                        <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-100">
                          <Sparkles size={44} strokeWidth={1.6} className="mx-auto text-teal-200" />
                          <p className="mt-4 text-[17px] font-black text-slate-700">Заказов пока нет</p>
                          <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-slate-400">
                            Оформленные на сайте заказы появятся здесь
                          </p>
                          <button
                            onClick={() => onNavigate("/catalog")}
                            className="mt-5 rounded-full bg-teal-600 px-7 py-3 text-[14px] font-black text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 active:scale-95"
                          >
                            Перейти в каталог
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {userOrders.map((order) => (
                            <button
                              key={order.id}
                              onClick={() => setOpenOrderId(openOrderId === order.id ? null : order.id)}
                              className="w-full overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-100"
                            >
                              <div className="flex items-center gap-3 p-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                                  <Package size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <b className="font-mono text-[13px] font-black text-[#123a5c]">{order.number}</b>
                                    <span className="text-[10.5px] text-slate-400">{fmtDate(order.createdAt)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11.5px] text-slate-400">
                                    {(Array.isArray(order.items) ? order.items.length : 0)} позиций · {order.paymentMethod === "online" ? "карта онлайн" : "оплата в магазине"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-[15px] font-black text-slate-800">{money(order.total)}</div>
                                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS_CLS[order.status]}`}>
                                    {statusShort(order.status)}
                                  </span>
                                </div>
                              </div>
                              <AnimatePresence>
                                {openOrderId === order.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-t border-slate-100"
                                  >
                                    <div className="space-y-2 bg-slate-50/70 p-3.5">
                                      {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                                        <div key={index} className="flex items-center gap-2 text-[12px]">
                                          <FileText size={13} className="text-slate-400" />
                                          <span className="min-w-0 flex-1 font-semibold text-slate-700">{item.name}</span>
                                          <span className="text-slate-400">
                                            {item.unit === "м" ? `${item.meters} м` : `${item.quantity} шт`}
                                          </span>
                                          <b className="text-slate-800">{money(item.sum)}</b>
                                        </div>
                                      ))}
                                      {order.adminComment && (
                                        <p className="rounded-xl bg-teal-50 px-3 py-2 text-[11.5px] text-teal-800">
                                          <b>Статус заказа:</b> {order.adminComment}
                                        </p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </main>
            )}

            <AnimatePresence>
              {accountUser && cardEditorOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setCardEditorOpen(false)}
                    className="absolute inset-0 z-[70] bg-black/45 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.97 }}
                    className="absolute inset-x-4 top-1/2 z-[80] mx-auto max-h-[82vh] max-w-2xl -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl lg:inset-x-0 lg:w-[720px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-[18px] font-black text-slate-800">Изменить фон карты</h3>
                        <p className="mt-1 text-[12.5px] text-slate-400">Выберите один из загруженных вариантов оформления.</p>
                      </div>
                      <button
                        onClick={() => setCardEditorOpen(false)}
                        className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {cardBackgrounds.length === 0 ? (
                      <p className="mt-5 rounded-xl bg-slate-50 px-3 py-3 text-[12.5px] text-slate-500">
                        В медиатеке пока нет файлов discount-card-background.png, discount-card-background2.png и далее.
                      </p>
                    ) : (
                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {cardBackgrounds.map((background, index) => {
                          const selected = selectedCardBackground?.name === background.name;
                          return (
                            <button
                              key={background.id}
                              onClick={() => {
                                loyalty.setCardBackground(background.name);
                                setCardEditorOpen(false);
                              }}
                              className={`group relative overflow-hidden rounded-2xl bg-slate-50 text-left transition active:scale-95 ${
                                selected
                                  ? "ring-2 ring-teal-500 shadow-lg shadow-teal-500/15"
                                  : "ring-1 ring-slate-100 hover:ring-teal-300 hover:shadow-md"
                              }`}
                              title={`Выбрать вариант ${index + 1}`}
                            >
                              <img
                                src={background.dataUrl}
                                alt="Фон скидочной карты"
                                className="aspect-[1.586/1] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              <div className="px-2.5 py-2 text-[11px] font-bold text-slate-600">Вариант {index + 1}</div>
                              {selected && (
                                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white shadow-md">
                                  <CheckCircle2 size={14} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-6 left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#123a5c] px-5 py-2.5 text-[13px] font-black text-white shadow-xl"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function CustomerAccount(props: CustomerAccountProps) {
  return (
    <AccountErrorBoundary key={props.open ? "account-open" : "account-closed"} onClose={props.onClose}>
      <CustomerAccountContent {...props} />
    </AccountErrorBoundary>
  );
}
