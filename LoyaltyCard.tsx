import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  Camera,
  CheckCircle2,
  Clock,
  LogOut,
  Receipt as ReceiptIcon,
  Sparkles,
  User,
  UserPlus,
  Phone,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  LOYALTY_THRESHOLD,
  LOYALTY_DISCOUNT,
  approvedSum,
  pendingSum,
  formatPhone,
  normalizePhone,
  type useLoyalty,
} from "../hooks/useLoyalty";
import { imageFileToDataUrl } from "../utils/imageUpload";

type LoyaltyApi = ReturnType<typeof useLoyalty>;

const fileToDataUrl = imageFileToDataUrl;
const fmt = (n: number) => n.toLocaleString("ru-RU");

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "На проверке", cls: "bg-amber-50 text-amber-600", icon: Clock },
  approved: { label: "Подтверждён", cls: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
  rejected: { label: "Отклонён", cls: "bg-red-50 text-red-500", icon: XCircle },
};

/* ============================ Auth ============================ */
function AuthScreen({ loyalty, onToast }: { loyalty: LoyaltyApi; onToast: (t: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneValid = normalizePhone(phone).length === 11;

  const submit = () => {
    setError("");
    if (!phoneValid) {
      setError("Введите корректный номер телефона");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      if (mode === "login") {
        const u = loyalty.findUserByPhone(phone);
        if (!u) {
          setBusy(false);
          setError("Номер не найден. Зарегистрируйтесь, чтобы получить карту.");
          return;
        }
        loyalty.setSession(u.id);
        onToast(`С возвращением, ${u.firstName}!`);
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setBusy(false);
        setError("Укажите имя и фамилию");
        return;
      }
      if (loyalty.findUserByPhone(phone)) {
        setBusy(false);
        setError("Этот номер уже зарегистрирован — войдите.");
        return;
      }
      loyalty.register(firstName, lastName, phone);
      onToast("Регистрация завершена!");
    }, 450);
  };

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        {(["register", "login"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-black transition ${
              mode === m ? "bg-white text-[#123a5c] shadow-md" : "text-slate-400"
            }`}
          >
            {m === "register" ? <UserPlus size={15} /> : <User size={15} />}
            {m === "register" ? "Регистрация" : "Вход"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#0e2f4a] to-teal-600 p-4 text-white shadow-lg shadow-teal-900/20">
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <Sparkles size={16} className="text-amber-300" />
          Скидочная карта −5%
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/85">
          Зарегистрируйтесь, прикрепите чеки на {fmt(LOYALTY_THRESHOLD)} ₽ — и после проверки
          администратором получите именную карту с постоянной скидкой.
        </p>
      </div>

      <div className="space-y-2.5 rounded-2xl bg-white p-4 shadow-sm">
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Имя
              </label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Фамилия
              </label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Петров" className={input} />
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Phone size={12} /> Номер телефона
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 (___) ___-__-__"
            inputMode="tel"
            className={input}
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-red-500">
            <XCircle size={14} /> {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-600 py-3.5 text-[14px] font-black text-white shadow-lg shadow-teal-600/25 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "register" ? <UserPlus size={16} /> : <User size={16} />}
          {busy ? "Секунду…" : mode === "register" ? "Зарегистрироваться" : "Войти"}
        </button>
        <p className="text-center text-[10.5px] font-medium leading-relaxed text-slate-400">
          Карта привязывается к номеру телефона — с другого устройства просто войдите по нему.
        </p>
      </div>
    </div>
  );
}

/* ============================ Pending ============================ */
function PendingScreen({ loyalty, onToast }: { loyalty: LoyaltyApi; onToast: (t: string) => void }) {
  const u = loyalty.currentUser!;
  const [adding, setAdding] = useState(false);
  const [sumInput, setSumInput] = useState("");
  const [pendingImg, setPendingImg] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const approved = approvedSum(u);
  const pending = pendingSum(u);
  const remaining = Math.max(0, LOYALTY_THRESHOLD - approved);
  const progress = Math.min(1, approved / LOYALTY_THRESHOLD);
  const orderReceipts = u.receipts.filter((r) => r.orderNumber);
  const lastOrderReceipt = orderReceipts[orderReceipts.length - 1];

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPendingImg(await fileToDataUrl(f));
      onToast("Фото чека прикреплено");
    } catch {
      onToast("Не удалось загрузить фото");
    }
  };

  const submit = () => {
    const sum = Math.round(Number(sumInput.replace(/\s/g, "")));
    if (!sum || sum <= 0) return;
    loyalty.addReceipt(sum, pendingImg);
    setSumInput("");
    setPendingImg(undefined);
    setAdding(false);
    onToast(`Чек на ${fmt(sum)} ₽ отправлен на проверку`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#123a5c] to-teal-600 text-[15px] font-black text-white">
          {u.firstName[0]?.toUpperCase()}
          {u.lastName[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black text-slate-800">
            {u.firstName} {u.lastName}
          </div>
          <div className="text-[12px] font-semibold text-slate-400">{formatPhone(u.phone)}</div>
        </div>
        <button
          onClick={() => loyalty.setSession(null)}
          className="rounded-xl bg-slate-100 p-2 text-slate-400 transition active:scale-90"
          title="Выйти"
        >
          <LogOut size={17} />
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-4 text-amber-700">
        <Clock size={18} className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] font-semibold leading-relaxed">
          Карта активируется после того, как администратор проверит чеки на сумму от{" "}
          {fmt(LOYALTY_THRESHOLD)} ₽.
        </p>
      </div>

      {lastOrderReceipt && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p className="text-[12.5px] font-semibold leading-relaxed">
            Заявка создана автоматически по заказу {lastOrderReceipt.orderNumber} на{" "}
            {fmt(lastOrderReceipt.sum)} ₽ — скидка 5% уже применена к заказу. Администратор
            активирует карту, и скидка станет постоянной.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-black uppercase tracking-wider text-slate-400">Подтверждено</span>
          <span className="text-[13px] font-black text-slate-700">
            {fmt(approved)} ₽ <span className="font-bold text-slate-400">/ {fmt(LOYALTY_THRESHOLD)} ₽</span>
          </span>
        </div>
        <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 120 }}
          />
        </div>
        {pending > 0 && <p className="mt-2 text-[12px] font-semibold text-amber-600">На проверке: {fmt(pending)} ₽</p>}
        <p className="mt-1.5 text-[12px] font-semibold text-slate-500">
          {remaining > 0 ? (
            <>
              Не хватает подтверждённых чеков на <b className="text-teal-700">{fmt(remaining)} ₽</b>
            </>
          ) : (
            <span className="font-bold text-emerald-600">Сумма набрана — ждём активации администратором!</span>
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2.5 flex items-center">
          <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-400">
            Мои чеки ({u.receipts.length})
          </h3>
          <button
            onClick={() => setAdding((v) => !v)}
            className="ml-auto rounded-full bg-teal-50 px-3 py-1.5 text-[12px] font-black text-teal-700 transition active:scale-95"
          >
            + Добавить
          </button>
        </div>

        <AnimatePresence>
          {adding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-3 space-y-2.5 rounded-xl bg-slate-50 p-3">
                <input
                  value={sumInput}
                  onChange={(e) => setSumInput(e.target.value)}
                  placeholder="Сумма чека, ₽"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                      pendingImg
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-teal-300 bg-teal-50/50 text-teal-700"
                    }`}
                  >
                    <Camera size={14} />
                    {pendingImg ? "Фото прикреплено" : "Фото чека"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <button
                    onClick={submit}
                    disabled={!Number(sumInput.replace(/\s/g, ""))}
                    className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-black text-white shadow-md shadow-teal-600/25 active:scale-95 disabled:opacity-40"
                  >
                    ОК
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {u.receipts.length === 0 && !adding ? (
          <p className="py-4 text-center text-[12.5px] font-medium text-slate-400">
            Пока нет прикреплённых чеков
          </p>
        ) : (
          <div className="space-y-1.5">
            {[...u.receipts].reverse().map((r) => {
              const b = STATUS_BADGE[r.status];
              const Icon = b.icon;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5"
                >
                  {r.img ? (
                    <img src={r.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                      <ReceiptIcon size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-700">{fmt(r.sum)} ₽</div>
                    <div className="text-[10.5px] font-medium text-slate-400">
                      {r.date}
                      {r.orderNumber && (
                        <span className="ml-1.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-black text-teal-700">
                          Заказ {r.orderNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold ${b.cls}`}>
                    <Icon size={11} /> {b.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ Active ============================ */
function ActiveCard({ loyalty }: { loyalty: LoyaltyApi }) {
  const u = loyalty.currentUser!;
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 18, stiffness: 220 }}
      className="space-y-4"
    >
      <div className="card-shine relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#0e2f4a] via-[#0f5e63] to-teal-500 p-5 text-white shadow-2xl shadow-teal-900/30">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-amber-300/15 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <BadgePercent size={20} />
            </div>
            <div>
              <div className="text-[15px] font-black leading-none tracking-tight">ВОДЯНОЙ</div>
              <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/60">
                Card Club
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-amber-400 px-2.5 py-1.5 text-center shadow-lg shadow-amber-500/30">
            <div className="text-[15px] font-black leading-none text-[#123a5c]">
              −{Math.round(LOYALTY_DISCOUNT * 100)}%
            </div>
          </div>
        </div>

        <div className="relative mt-5 h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner">
          <div className="absolute inset-x-1.5 top-1/2 h-px bg-amber-700/40" />
          <div className="absolute inset-y-1.5 left-1/2 w-px bg-amber-700/40" />
        </div>

        <div className="relative mt-4 font-mono text-[17px] font-bold tracking-[0.14em]">{u.cardNumber}</div>
        <div className="relative mt-4 flex items-end justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Владелец</div>
            <div className="mt-0.5 text-[13px] font-extrabold uppercase tracking-wide">
              {u.lastName} {u.firstName}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Телефон</div>
            <div className="mt-0.5 text-[12px] font-extrabold">{formatPhone(u.phone)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <p className="text-[13px] font-semibold leading-relaxed">
          Карта активна! Скидка 5% применяется автоматически к каждому заказу. На другом устройстве
          просто войдите по номеру телефона.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-2.5 text-[12px] font-black uppercase tracking-wider text-slate-400">
          Подтверждённые чеки · {fmt(approvedSum(u))} ₽
        </h3>
        <div className="space-y-1.5">
          {u.receipts
            .filter((r) => r.status === "approved")
            .map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                {r.img ? (
                  <img src={r.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                    <ReceiptIcon size={18} />
                  </div>
                )}
                <div className="flex-1 text-[13px] font-bold text-slate-700">
                  Чек на {fmt(r.sum)} ₽
                  <div className="text-[10.5px] font-medium text-slate-400">{r.date}</div>
                </div>
              </div>
            ))}
        </div>
        <button
          onClick={() => loyalty.setSession(null)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-[12.5px] font-bold text-slate-500 transition active:scale-[0.98]"
        >
          <LogOut size={14} /> Выйти из аккаунта
        </button>
      </div>
    </motion.div>
  );
}

/* ============================ Root ============================ */
export default function LoyaltyCard({
  open,
  onClose,
  loyalty,
}: {
  open: boolean;
  onClose: () => void;
  loyalty: LoyaltyApi;
}) {
  const [toast, setToast] = useState("");
  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  const u = loyalty.currentUser;

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
            <div className="flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_2px_16px_rgba(15,60,70,0.08)]">
              <button
                onClick={onClose}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-[17px] font-black leading-none tracking-tight text-slate-800">
                  Скидочная карта
                </h2>
                <p className="mt-1 text-[11.5px] font-medium text-slate-400">
                  {u
                    ? u.status === "active"
                      ? "Карта активна · скидка 5% на всё"
                      : "Ожидает проверки чеков"
                    : "Регистрация и вход по номеру телефона"}
                </p>
              </div>
              <BadgePercent size={24} className="ml-auto text-amber-500" strokeWidth={2.2} />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!u ? (
                <AuthScreen loyalty={loyalty} onToast={showToast} />
              ) : u.status === "active" ? (
                <ActiveCard loyalty={loyalty} />
              ) : (
                <PendingScreen loyalty={loyalty} onToast={showToast} />
              )}
            </div>
          </div>

          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#123a5c] px-5 py-2.5 text-[13px] font-black text-white shadow-xl"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
