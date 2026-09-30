import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  Search,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  ImagePlus,
  RotateCcw,
  LogOut,
  Package,
  CheckCircle2,
  XCircle,
  FolderTree,
  BadgePercent,
  CreditCard,
  UserCheck,
  Receipt as ReceiptIcon,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Wrench,
  Images,
  Copy,
  Upload,
  BarChart3,
  Volume2,
  Users,
  Mail,
  Award,
  ShieldCheck,
} from "lucide-react";

import type { Brand, Product, Subcategory } from "../data/catalog";
import type { Category } from "../hooks/useCategories";
import type { Plumber } from "../hooks/usePlumbers";
import {
  approvedSum,
  formatPhone,
  LOYALTY_THRESHOLD,
  type LoyaltyUser,
} from "../hooks/useLoyalty";
import { useMediaLibrary } from "../hooks/useMediaLibrary";
import { useOrders } from "../hooks/useOrders";
import { cloudSync } from "../utils/cloudSync";
import { imageFileToDataUrl, mediaFileToUrl } from "../utils/imageUpload";
import OrdersTab from "./OrdersTab";
import BrandsAdmin from "./BrandsAdmin";
import { ShoppingBag } from "lucide-react";

const money = (n: number) => n.toLocaleString("ru-RU");

const ADMIN_LOGIN = "admin";
const ADMIN_PASS = "123456789";
const AUTH_KEY = "vodyanoy_admin_session";

/** SQL для настройки таблицы синхронизации. RLS открыт — данные не приватные. */
const SETUP_SQL = `create table if not exists public.vodyanoy_store (
  key text primary key,
  value jsonb not null
);

grant usage on schema public to anon, authenticated;
grant all on table public.vodyanoy_store to anon, authenticated;

alter table public.vodyanoy_store enable row level security;

drop policy if exists "vodyanoy_all_access" on public.vodyanoy_store;

create policy "vodyanoy_all_access"
  on public.vodyanoy_store
  as permissive
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Публичный bucket для изображений в исходном качестве
insert into storage.buckets (id, name, public)
values ('vodyanoy-media', 'vodyanoy-media', true)
on conflict (id) do update set public = true;

drop policy if exists "vodyanoy_media_read" on storage.objects;
drop policy if exists "vodyanoy_media_insert" on storage.objects;
drop policy if exists "vodyanoy_media_update" on storage.objects;
drop policy if exists "vodyanoy_media_delete" on storage.objects;

create policy "vodyanoy_media_read"
  on storage.objects for select
  to public
  using (bucket_id = 'vodyanoy-media');

create policy "vodyanoy_media_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'vodyanoy-media');

create policy "vodyanoy_media_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'vodyanoy-media')
  with check (bucket_id = 'vodyanoy-media');

create policy "vodyanoy_media_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'vodyanoy-media');

notify pgrst, 'reload schema';`;

function productCategoryKey(p: Product): string {
  return p.category === "PPR Трубы" || p.category === "PPR Фитинги" ? "ppr" : p.category;
}

function productMatchesSubcategory(p: Product, sub: Subcategory): boolean {
  return (
    p.subcategory === sub.key ||
    (!p.subcategory && !!sub.match?.some((part) => p.name.includes(part)))
  );
}

const fileToDataUrl = imageFileToDataUrl;

const thumb = (p: Product) =>
  p.image ||
  (p.category === "Краны и Вентили"
    ? "/images/cat-valves.png"
    : p.category === "Латунные Фитинги"
    ? "/images/cat-brass.png"
    : "/images/cat-ppr.png");

/* ============================ Login ============================ */
function Login({ onAuth }: { onAuth: () => void }) {
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login.trim() === ADMIN_LOGIN && pass === ADMIN_PASS) {
      localStorage.setItem(AUTH_KEY, "1");
      onAuth();
    } else {
      setError(true);
      setShake((s) => s + 1);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-[0_8px_40px_rgba(15,60,70,0.12)]"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#123a5c] to-teal-600 shadow-lg shadow-teal-700/20">
          <Lock size={28} className="text-white" />
        </div>
        <h2 className="text-center text-[20px] font-black tracking-tight text-slate-800">
          Вход в админ-панель
        </h2>
        <p className="mt-1 text-center text-[12.5px] text-slate-400">Управление каталогом товаров</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Логин
            </label>
            <input
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setError(false);
              }}
              autoComplete="username"
              placeholder="admin"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Пароль
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError(false);
              }}
              autoComplete="current-password"
              placeholder="•••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-red-500"
              >
                <XCircle size={14} /> Неверный логин или пароль
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 py-3.5 text-[15px] font-black text-white shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
          >
            Войти
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ============================ Edit form ============================ */
function EditForm({
  initial,
  isNew,
  categories,
  brands,
  onSave,
  onClose,
}: {
  initial: Product;
  isNew: boolean;
  categories: Category[];
  brands: Brand[];
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Product>(() => ({
    ...initial,
    category:
      initial.category === "PPR Трубы" || initial.category === "PPR Фитинги"
        ? "ppr"
        : initial.category,
  }));
  const [urlInput, setUrlInput] = useState("");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const addGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    for (const f of Array.from(files)) {
      try {
        const data = await fileToDataUrl(f);
        setD((prev) => ({ ...prev, gallery: [...(prev.gallery ?? []), data] }));
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Ошибка загрузки изображения");
      }
    }
    setGalleryUploading(false);
  };

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setD((p) => ({ ...p, [k]: v }));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setImageUploading(true);
    try {
      const data = await fileToDataUrl(f);
      set("image", data);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка загрузки изображения");
    } finally {
      setImageUploading(false);
    }
  };

  const input =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500/15";
  const selectedCategory = categories.find((c) => c.key === d.category);
  const subcategories = selectedCategory?.subcategories ?? [];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="absolute inset-0 z-10 flex flex-col bg-[#f4f8fa] lg:items-center lg:justify-center lg:bg-black/40 lg:backdrop-blur-sm lg:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full flex-col bg-[#f4f8fa] lg:h-auto lg:max-h-[90vh] lg:w-full lg:max-w-3xl lg:overflow-hidden lg:rounded-[1.75rem] lg:bg-white lg:shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-[16px] font-black text-slate-800 lg:text-[17px]">
            {isNew ? "Новый товар" : "Редактирование"}
          </h3>
          <button
            onClick={() => onSave(d)}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 px-4 py-2.5 text-[13px] font-black text-white shadow-md shadow-orange-500/25 active:scale-95"
          >
            <Save size={15} /> Сохранить
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:p-6">
          {/* image */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <ImagePlus size={11} /> Изображение
            </div>
            <div className="flex items-center gap-2">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                <img src={d.image ? d.image : thumb(d)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={imageUploading}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50/80 active:scale-95 disabled:opacity-50"
                >
                  {imageUploading ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <ImagePlus size={12} />
                  )}
                  {imageUploading ? "Загрузка…" : "Файл"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                {d.image && (
                  <button
                    onClick={() => set("image", undefined)}
                    className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200 active:scale-95"
                  >
                    Убрать
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && urlInput.trim()) {
                        set("image", urlInput.trim());
                        setUrlInput("");
                      }
                    }}
                    placeholder="Ссылка…"
                    className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none focus:border-teal-400 focus:bg-white"
                  />
                  <button
                    onClick={() => {
                      if (urlInput.trim()) {
                        set("image", urlInput.trim());
                        setUrlInput("");
                      }
                    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* gallery */}
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
            <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-black text-slate-700">
              <input
                type="checkbox"
                checked={!!d.gallery?.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setD((prev) => ({
                      ...prev,
                      gallery: prev.gallery?.length ? prev.gallery : [],
                    }));
                  } else {
                    setD((prev) => ({ ...prev, gallery: undefined }));
                  }
                }}
                className="h-4 w-4 accent-teal-600"
              />
              Галерея изображений
            </label>

            {d.gallery !== undefined && (
              <div className="mt-3">
                {d.gallery.length === 0 ? (
                  <p className="mb-2 text-[11px] text-slate-400">
                    Загрузите несколько фото — в карточке товара они будут перелистываться свайпом.
                  </p>
                ) : (
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    {d.gallery.map((src, i) => (
                      <div
                        key={i}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute left-1 top-1 rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                            1-е
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setD((prev) => ({
                              ...prev,
                              gallery: (prev.gallery ?? []).filter((_, idx) => idx !== i),
                            }))
                          }
                          className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 active:scale-90"
                          title="Удалить фото"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => galleryRef.current?.click()}
                    disabled={galleryUploading}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50/80 active:scale-95 disabled:opacity-50"
                  >
                    {galleryUploading ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Plus size={12} strokeWidth={3} />
                    )}
                    {galleryUploading ? "Загрузка…" : "Добавить фото"}
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      value={galleryUrl}
                      onChange={(e) => setGalleryUrl(e.target.value)}
                      placeholder="Ссылка на фото…"
                      className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none focus:border-teal-400 focus:bg-white"
                    />
                    <button
                      onClick={() => {
                        const u = galleryUrl.trim();
                        if (!u) return;
                        setD((prev) => ({ ...prev, gallery: [...(prev.gallery ?? []), u] }));
                        setGalleryUrl("");
                      }}
                      disabled={!galleryUrl.trim()}
                      className="rounded-lg bg-teal-600 px-2 py-1 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-40"
                    >
                      OK
                    </button>
                  </div>
                </div>
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addGalleryFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">
                  Первое фото станет обложкой. Изображения сохраняются в высоком качестве; только файлы
                  крупнее 2000 px аккуратно уменьшаются.
                </p>
              </div>
            )}
          </div>

          {/* main fields */}
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Название
              </label>
              <input value={d.name} onChange={(e) => set("name", e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Бренд
              </label>
              <select
                value={d.brandId ?? ""}
                onChange={(e) => set("brandId", e.target.value || undefined)}
                className={input}
              >
                <option value="">— без бренда —</option>
                {brands.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10.5px] text-slate-400">
                Новый бренд добавляется во вкладке «Бренды».
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Цена, ₽
                </label>
                <input
                  type="number"
                  min={0}
                  value={d.price}
                  onChange={(e) => set("price", Number(e.target.value) || 0)}
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Единица
                </label>
                <select
                  value={d.unit ?? "шт"}
                  onChange={(e) => {
                    const v = e.target.value as "шт" | "м";
                    setD((prev) => ({
                      ...prev,
                      unit: v === "шт" ? undefined : v,
                      minMeters: v === "м" ? prev.minMeters || 1 : undefined,
                    }));
                  }}
                  className={input}
                >
                  <option value="шт">за штуку</option>
                  <option value="м">за метр</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Старая цена, ₽
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-400">
                  необязательно
                </span>
              </label>
              <input
                type="number"
                min={0}
                value={d.oldPrice ?? ""}
                onChange={(e) =>
                  set("oldPrice", e.target.value === "" ? undefined : Number(e.target.value) || 0)
                }
                placeholder="Оставьте пустым, если скидки нет"
                className={input}
              />
              {d.oldPrice && d.oldPrice > d.price ? (
                <p className="mt-1 text-[11px] font-bold text-rose-500">
                  Скидка −{Math.max(1, Math.round((1 - d.price / d.oldPrice) * 100))}% · в карточке будет{" "}
                  <span className="text-slate-400 line-through">
                    {d.oldPrice.toLocaleString("ru-RU")} ₽
                  </span>{" "}
                  → {d.price.toLocaleString("ru-RU")} ₽
                </p>
              ) : d.oldPrice ? (
                <p className="mt-1 text-[11px] font-bold text-amber-600">
                  Старая цена должна быть выше текущей, иначе скидка не покажется.
                </p>
              ) : null}
            </div>

            {d.unit === "м" && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Минимум метров
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.minMeters ?? 1}
                  onChange={(e) => set("minMeters", Math.max(1, Number(e.target.value) || 1))}
                  className={input}
                />
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
                  Минимальное количество метров для продажи. В корзине пользователь сможет увеличивать
                  метраж с этим шагом.
                </p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Артикул
              </label>
              <input value={d.code} onChange={(e) => set("code", e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Категория
              </label>
              <select
                value={d.category}
                onChange={(e) => setD((prev) => ({ ...prev, category: e.target.value, subcategory: undefined }))}
                className={input}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {subcategories.length > 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Подкатегория
                </label>
                <select
                  value={d.subcategory ?? ""}
                  onChange={(e) => set("subcategory", e.target.value || undefined)}
                  className={input}
                >
                  <option value="">Без подкатегории</option>
                  {subcategories.map((sub) => (
                    <option key={sub.key} value={sub.key}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Наличие
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => set("inStock", true)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition active:scale-95 ${
                    d.inStock
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <CheckCircle2 size={15} /> В наличии
                </button>
                <button
                  onClick={() => set("inStock", false)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition active:scale-95 ${
                    !d.inStock
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <XCircle size={15} /> Нет
                </button>
              </div>
            </div>
            <div>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={!!d.warranty}
                  onChange={(e) => set("warranty", e.target.checked ? true : undefined)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
                />
                <span>
                  <span className="block text-[13px] font-black text-slate-700">
                    Гарантия производителя 12 месяцев
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-400">
                    Показать строку гарантии в карточке товара. Включайте только для технически
                    сложных товаров.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] font-black text-slate-700">
              <input
                type="checkbox"
                checked={!!d.characteristics?.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    set(
                      "characteristics",
                      d.characteristics?.length ? d.characteristics : [{ name: "", value: "" }]
                    );
                  } else {
                    set("characteristics", undefined);
                  }
                }}
                className="h-4 w-4 accent-teal-600"
              />
              Добавить характеристики
            </label>

            {d.characteristics && d.characteristics.length > 0 && (
              <div className="mt-3 space-y-2">
                {d.characteristics.map((ch, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      value={ch.name}
                      onChange={(e) => {
                        const next = [...(d.characteristics ?? [])];
                        next[i] = { ...next[i], name: e.target.value };
                        set("characteristics", next);
                      }}
                      placeholder="Название"
                      className={`${input} px-3 py-2 text-[12px]`}
                    />
                    <input
                      value={ch.value}
                      onChange={(e) => {
                        const next = [...(d.characteristics ?? [])];
                        next[i] = { ...next[i], value: e.target.value };
                        set("characteristics", next);
                      }}
                      placeholder="Значение"
                      className={`${input} px-3 py-2 text-[12px]`}
                    />
                    <button
                      onClick={() => {
                        const next = (d.characteristics ?? []).filter((_, idx) => idx !== i);
                        set("characteristics", next.length ? next : undefined);
                      }}
                      className="rounded-xl bg-slate-100 px-2.5 text-slate-400 transition hover:text-red-500 active:scale-90"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    set("characteristics", [...(d.characteristics ?? []), { name: "", value: "" }])
                  }
                  className="w-full rounded-xl bg-teal-50 py-2 text-[12px] font-black text-teal-700 transition active:scale-[0.98]"
                >
                  + Добавить строку характеристики
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Описание
            </label>
            <textarea
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className={`${input} resize-none leading-relaxed`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================ Category editor ============================ */
function CategoryEditor({
  categories,
  onUpdate,
  onAdd,
  onDelete,
  onMove,
  onReset,
  onToast,
}: {
  categories: Category[];
  onUpdate: (key: string, patch: Partial<Category>) => void;
  onAdd: (category: Category) => void;
  onDelete: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onReset: () => void;
  onToast: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [openSubcategoryFor, setOpenSubcategoryFor] = useState<string | null>(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [editingSubcategory, setEditingSubcategory] = useState<{
    categoryKey: string;
    subKey: string;
    label: string;
  } | null>(null);

  const makeSubcategoryKey = (categoryKey: string, label: string, existing: Subcategory[]) => {
    const base = `${categoryKey}-sub-${
      label.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "") || "new"
    }`;
    let key = base;
    let n = 2;
    while (existing.some((sub) => sub.key === key)) {
      key = `${base}-${n}`;
      n += 1;
    }
    return key;
  };

  const updateSubcategories = (category: Category, subcategories: Subcategory[]) =>
    onUpdate(category.key, { subcategories });

  const uploadSubcategoryImage = async (
    category: Category,
    subKey: string,
    file?: File
  ) => {
    if (!file) return;
    try {
      const data = await fileToDataUrl(file);
      updateSubcategories(
        category,
        (category.subcategories ?? []).map((sub) => (sub.key === subKey ? { ...sub, img: data } : sub))
      );
      onToast("Изображение подкатегории обновлено");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    }
  };

  const save = (c: Category) => {
    const label = c.label.trim();
    if (!label) {
      onToast("Введите название категории");
      return;
    }

    if (isNew) {
      let key = label;
      let n = 2;
      while (categories.some((item) => item.key === key)) {
        key = `${label} ${n}`;
        n += 1;
      }
      onAdd({ key, label, img: c.img || "/images/cat-ppr.png" });
      onToast("Категория добавлена");
    } else {
      onUpdate(c.key, { label, img: c.img });
      onToast("Категория сохранена");
    }
    setEditing(null);
    setIsNew(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-slate-400">
        Здесь можно изменить отображаемое название и картинку категории. Внутренний ключ и привязка
        товаров при этом сохраняются.
      </p>
      <button
        onClick={() => {
          setEditing({ key: "", label: "", img: "/images/cat-ppr.png" });
          setIsNew(true);
        }}
        className="mb-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2 text-[12px] font-black text-white shadow-md shadow-teal-600/25 active:scale-95"
      >
        <Plus size={14} strokeWidth={3} /> Добавить категорию
      </button>
      <div className="space-y-2">
        {categories.map((c, i) => (
          <div key={c.key} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-2 p-2.5">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMove(c.key, -1)}
                  disabled={i === 0}
                  className="rounded-md bg-slate-100 p-0.5 text-slate-500 transition active:scale-90 disabled:opacity-30"
                  title="Выше"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  onClick={() => onMove(c.key, 1)}
                  disabled={i === categories.length - 1}
                  className="rounded-md bg-slate-100 p-0.5 text-slate-500 transition active:scale-90 disabled:opacity-30"
                  title="Ниже"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-slate-200">
                <img src={c.img} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-black text-slate-800">{c.label}</div>
                <div className="font-mono text-[10.5px] text-slate-400">{c.key}</div>
              </div>
              <button
                onClick={() => setEditing({ ...c })}
                className="rounded-xl bg-teal-50 p-2.5 text-teal-700 transition active:scale-90"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirmDelete === c.key) {
                    onDelete(c.key);
                    setConfirmDelete(null);
                    onToast("Категория удалена");
                  } else {
                    setConfirmDelete(c.key);
                    setTimeout(() => setConfirmDelete(null), 2500);
                  }
                }}
                className={`rounded-xl p-2.5 transition active:scale-90 ${
                  confirmDelete === c.key
                    ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                    : "bg-slate-100 text-slate-400"
                }`}
                title={confirmDelete === c.key ? "Точно удалить?" : "Удалить"}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="border-t border-slate-100 px-3 py-2.5">
              <button
                onClick={() => {
                  setOpenSubcategoryFor(openSubcategoryFor === c.key ? null : c.key);
                  setNewSubcategory("");
                  setEditingSubcategory(null);
                }}
                className="flex w-full items-center text-left text-[12px] font-black text-teal-700"
              >
                <span>Подкатегории ({c.subcategories?.length ?? 0})</span>
                <span className="ml-auto text-slate-400">
                  {openSubcategoryFor === c.key ? "Скрыть" : "Управлять"}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {openSubcategoryFor === c.key && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 space-y-1.5">
                      {(c.subcategories ?? []).map((sub, subIndex, allSubs) => {
                        const editingThis =
                          editingSubcategory?.categoryKey === c.key &&
                          editingSubcategory.subKey === sub.key;
                        return (
                          <div key={sub.key} className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-2">
                            <div className="flex flex-col">
                              <button
                                onClick={() => {
                                  if (subIndex === 0) return;
                                  const next = [...allSubs];
                                  [next[subIndex], next[subIndex - 1]] = [next[subIndex - 1], next[subIndex]];
                                  updateSubcategories(c, next);
                                }}
                                disabled={subIndex === 0}
                                className="text-slate-400 disabled:opacity-25"
                                title="Выше"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (subIndex === allSubs.length - 1) return;
                                  const next = [...allSubs];
                                  [next[subIndex], next[subIndex + 1]] = [next[subIndex + 1], next[subIndex]];
                                  updateSubcategories(c, next);
                                }}
                                disabled={subIndex === allSubs.length - 1}
                                className="text-slate-400 disabled:opacity-25"
                                title="Ниже"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                            <label
                              className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white text-slate-300 ring-1 ring-slate-200 transition active:scale-95"
                              title="Загрузить изображение подкатегории"
                            >
                              {sub.img ? (
                                <img src={sub.img} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <ImagePlus size={15} />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  uploadSubcategoryImage(c, sub.key, e.target.files?.[0]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {editingThis ? (
                              <input
                                value={editingSubcategory.label}
                                onChange={(e) =>
                                  setEditingSubcategory({ ...editingSubcategory, label: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const label = editingSubcategory.label.trim();
                                    if (label) {
                                      updateSubcategories(
                                        c,
                                        allSubs.map((item) => (item.key === sub.key ? { ...item, label } : item))
                                      );
                                    }
                                    setEditingSubcategory(null);
                                  }
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-teal-300 bg-white px-2 py-1 text-[12px] font-bold outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-700">
                                {sub.label}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                editingThis
                                  ? setEditingSubcategory(null)
                                  : setEditingSubcategory({
                                      categoryKey: c.key,
                                      subKey: sub.key,
                                      label: sub.label,
                                    })
                              }
                              className="rounded-lg p-1.5 text-teal-700"
                              title="Переименовать"
                            >
                              {editingThis ? <CheckCircle2 size={14} /> : <Pencil size={14} />}
                            </button>
                            {sub.img && (
                              <button
                                onClick={() =>
                                  updateSubcategories(
                                    c,
                                    allSubs.map((item) =>
                                      item.key === sub.key ? { ...item, img: undefined } : item
                                    )
                                  )
                                }
                                className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600"
                                title="Убрать изображение"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                updateSubcategories(c, allSubs.filter((item) => item.key !== sub.key))
                              }
                              className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}

                      <div className="flex gap-2 pt-1">
                        <input
                          value={newSubcategory}
                          onChange={(e) => setNewSubcategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const label = newSubcategory.trim();
                              if (!label) return;
                              const subs = c.subcategories ?? [];
                              updateSubcategories(c, [
                                ...subs,
                                { key: makeSubcategoryKey(c.key, label, subs), label },
                              ]);
                              setNewSubcategory("");
                              onToast("Подкатегория добавлена");
                            }
                          }}
                          placeholder="Название подкатегории"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold outline-none focus:border-teal-500"
                        />
                        <button
                          onClick={() => {
                            const label = newSubcategory.trim();
                            if (!label) return;
                            const subs = c.subcategories ?? [];
                            updateSubcategories(c, [
                              ...subs,
                              { key: makeSubcategoryKey(c.key, label, subs), label },
                            ]);
                            setNewSubcategory("");
                            onToast("Подкатегория добавлена");
                          }}
                          disabled={!newSubcategory.trim()}
                          className="rounded-xl bg-teal-600 px-3 text-[12px] font-black text-white disabled:opacity-40"
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 pb-2">
        <button
          onClick={() => {
            if (confirmReset) {
              onReset();
              setConfirmReset(false);
              onToast("Категории сброшены");
            } else {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 2500);
            }
          }}
          className={`mx-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold transition active:scale-95 ${
            confirmReset ? "bg-red-500 text-white shadow-md" : "bg-slate-100 text-slate-500"
          }`}
        >
          <RotateCcw size={14} />
          {confirmReset ? "Точно сбросить категории?" : "Сбросить категории к исходным"}
        </button>
      </div>

      <AnimatePresence>
        {editing && (
          <CategoryEditForm
            initial={editing}
            isNew={isNew}
            onSave={save}
            onClose={() => {
              setEditing(null);
              setIsNew(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryEditForm({
  initial,
  isNew,
  onSave,
  onClose,
}: {
  initial: Category;
  isNew: boolean;
  onSave: (c: Category) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Category>({ ...initial });
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await fileToDataUrl(f);
      setD((prev: Category) => ({ ...prev, img: data }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка загрузки изображения");
    }
  };

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="absolute inset-0 z-10 flex flex-col bg-[#f4f8fa]"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={onClose}
          className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-[16px] font-black text-slate-800">
          {isNew ? "Новая категория" : "Категория"}
        </h3>
        <button
          onClick={() => onSave(d)}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 px-4 py-2.5 text-[13px] font-black text-white shadow-md shadow-orange-500/25 active:scale-95"
        >
          <Save size={15} /> Сохранить
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <ImagePlus size={12} /> Изображение
          </div>
          <div className="flex items-center gap-2">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
              <img src={d.img} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50/80 active:scale-95"
              >
                <ImagePlus size={12} /> Файл
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlInput.trim()) {
                    setD((prev: Category) => ({ ...prev, img: urlInput.trim() }));
                    setUrlInput("");
                  }
                }}
                placeholder="Ссылка…"
                className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] outline-none focus:border-teal-400 focus:bg-white"
              />
              <button
                onClick={() => {
                  if (urlInput.trim()) {
                    setD((prev: Category) => ({ ...prev, img: urlInput.trim() }));
                    setUrlInput("");
                  }
                }}
                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
              >
                OK
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Название категории
          </label>
          <input
            value={d.label}
            onChange={(e) => setD((prev: Category) => ({ ...prev, label: e.target.value }))}
            className={input}
          />
          <p className="mt-2 text-[11px] text-slate-400">
            {isNew ? (
              "Внутренний ключ будет создан из названия при сохранении."
            ) : (
              <>
                Внутренний ключ:{" "}
                <span className="font-mono font-bold text-slate-500">{d.key}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================ Plumbers admin ============================ */
function PlumbersAdmin({
  plumbers,
  onAdd,
  onUpdate,
  onDelete,
  onToast,
}: {
  plumbers: Plumber[];
  onAdd: (p: Omit<Plumber, "id">) => void;
  onUpdate: (id: string, patch: Partial<Plumber>) => void;
  onDelete: (id: string) => void;
  onToast: (t: string) => void;
}) {
  const [editing, setEditing] = useState<Plumber | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openReviews, setOpenReviews] = useState<string | null>(null);
  const [confirmReviewDelete, setConfirmReviewDelete] = useState<string | null>(null);

  const deleteReview = (plumberId: string, reviewId: string) => {
    const p = plumbers.find((x) => x.id === plumberId);
    if (!p) return;
    onUpdate(plumberId, { reviews: (p.reviews ?? []).filter((r) => r.id !== reviewId) });
    onToast("Отзыв удалён");
  };

  const save = (p: Plumber) => {
    if (!p.firstName.trim() || !p.lastName.trim() || !p.phone.trim()) {
      onToast("Заполните имя, фамилию и телефон");
      return;
    }
    if (editing?.id) {
      onUpdate(editing.id, p);
      onToast("Сохранено");
    } else {
      onAdd(p);
      onToast("Сантехник добавлен");
    }
    setEditing(null);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <button
        onClick={() =>
          setEditing({
            id: "",
            firstName: "",
            lastName: "",
            photo: "",
            description: "",
            phone: "",
            specialties: [],
            reviews: [],
          })
        }
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 py-3 text-[13px] font-black text-white shadow-md shadow-teal-600/25 active:scale-[0.98]"
      >
        <Plus size={16} strokeWidth={3} /> Добавить сантехника
      </button>

      <div className="space-y-2">
        {plumbers.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-3 p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-slate-200">
                {p.photo ? (
                  <img src={p.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-teal-600">
                    <span className="text-[18px] font-black">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-black text-slate-800">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-[11px] font-medium text-slate-500">{p.phone}</div>
              </div>
              <button
                onClick={() => setEditing({ ...p })}
                className="rounded-xl bg-teal-50 p-2.5 text-teal-700 transition active:scale-90"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirmDelete === p.id) {
                    onDelete(p.id);
                    setConfirmDelete(null);
                    onToast("Сантехник удалён");
                  } else {
                    setConfirmDelete(p.id);
                    setTimeout(() => setConfirmDelete(null), 2500);
                  }
                }}
                className={`rounded-xl p-2.5 transition active:scale-90 ${
                  confirmDelete === p.id
                    ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                    : "bg-slate-100 text-slate-400"
                }`}
                title={confirmDelete === p.id ? "Точно удалить?" : "Удалить"}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="border-t border-slate-100 px-3 py-2.5">
              <button
                onClick={() => setOpenReviews(openReviews === p.id ? null : p.id)}
                className="flex w-full items-center text-left text-[12px] font-black text-teal-700"
              >
                <span>Отзывы ({p.reviews?.length ?? 0})</span>
                <span className="ml-auto text-slate-400">
                  {openReviews === p.id ? "Скрыть" : "Модерация"}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {openReviews === p.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 space-y-2">
                      {(p.reviews ?? []).length === 0 ? (
                        <p className="py-2 text-center text-[11.5px] text-slate-400">Отзывов пока нет</p>
                      ) : (
                        (p.reviews ?? []).map((r) => (
                          <div key={r.id} className="rounded-xl bg-slate-50 p-2.5">
                            <div className="mb-1 flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[12.5px] font-bold text-slate-700">
                                    {r.authorName}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <span
                                        key={i}
                                        className={`text-[10px] ${
                                          i < r.rating ? "text-amber-400" : "text-slate-300"
                                        }`}
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </span>
                                </div>
                                {r.authorPhone && (
                                  <div className="text-[10.5px] font-medium text-slate-400">
                                    {r.authorPhone}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirmReviewDelete === r.id) {
                                    deleteReview(p.id, r.id);
                                    setConfirmReviewDelete(null);
                                  } else {
                                    setConfirmReviewDelete(r.id);
                                    setTimeout(() => setConfirmReviewDelete(null), 2500);
                                  }
                                }}
                                className={`shrink-0 rounded-lg p-1.5 transition active:scale-90 ${
                                  confirmReviewDelete === r.id
                                    ? "bg-red-500 text-white"
                                    : "bg-white text-slate-400 ring-1 ring-slate-200"
                                }`}
                                title={confirmReviewDelete === r.id ? "Точно удалить?" : "Удалить отзыв"}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <p className="text-[12px] leading-relaxed text-slate-600">{r.text}</p>
                            {r.photos && r.photos.length > 0 && (
                              <div className="mt-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {r.photos.map((src, i) => (
                                  <a
                                    key={i}
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200"
                                  >
                                    <img src={src} alt="" className="h-full w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 text-[10px] font-medium text-slate-400">{r.createdAt}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && <PlumberEditForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PlumberEditForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Plumber;
  onSave: (p: Plumber) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Plumber>({ ...initial });
  const [photoUrl, setPhotoUrl] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Plumber>(k: K, v: Plumber[K]) => setD((p) => ({ ...p, [k]: v }));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await fileToDataUrl(f);
      set("photo", data);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка загрузки изображения");
    }
  };

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="absolute inset-0 z-10 flex flex-col bg-[#f4f8fa]"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={onClose}
          className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-[16px] font-black text-slate-800">
          {initial.id ? "Редактирование" : "Новый сантехник"}
        </h3>
        <button
          onClick={() => onSave(d)}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 px-4 py-2.5 text-[13px] font-black text-white shadow-md shadow-orange-500/25 active:scale-95"
        >
          <Save size={15} /> Сохранить
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-slate-400">
            <ImagePlus size={14} /> Фото
          </div>
          <div className="flex gap-3">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
              {d.photo ? (
                <img src={d.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <span className="text-[28px] font-black">
                    {d.firstName[0]}
                    {d.lastName[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 py-2.5 text-[12.5px] font-bold text-teal-700 transition active:scale-[0.98]"
              >
                Загрузить файл
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {d.photo && (
                <button
                  onClick={() => set("photo", "")}
                  className="w-full rounded-xl bg-slate-100 py-2 text-[12px] font-bold text-slate-500 active:scale-[0.98]"
                >
                  Убрать фото
                </button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              onBlur={() => {
                if (photoUrl.trim()) {
                  set("photo", photoUrl.trim());
                  setPhotoUrl("");
                }
              }}
              placeholder="Или вставьте ссылку на фото…"
              className={input}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Имя
              </label>
              <input value={d.firstName} onChange={(e) => set("firstName", e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Фамилия
              </label>
              <input value={d.lastName} onChange={(e) => set("lastName", e.target.value)} className={input} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Телефон
            </label>
            <input
              value={d.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              className={input}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Описание
            </label>
            <textarea
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className={`${input} resize-none`}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Специализации
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(d.specialties ?? []).map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700"
                >
                  {s}
                  <button
                    onClick={() =>
                      set(
                        "specialties",
                        (d.specialties ?? []).filter((_, idx) => idx !== i)
                      )
                    }
                    className="text-teal-600 hover:text-teal-800"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && specialtyInput.trim()) {
                    set("specialties", [...(d.specialties ?? []), specialtyInput.trim()]);
                    setSpecialtyInput("");
                  }
                }}
                placeholder="Например: Монтаж насосов"
                className={`${input} flex-1 px-3 py-2 text-[12px]`}
              />
              <button
                onClick={() => {
                  if (specialtyInput.trim()) {
                    set("specialties", [...(d.specialties ?? []), specialtyInput.trim()]);
                    setSpecialtyInput("");
                  }
                }}
                disabled={!specialtyInput.trim()}
                className="rounded-xl bg-teal-600 px-3 text-[12px] font-black text-white disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================ Media library admin ============================ */
function MediaAdmin({ onToast }: { onToast: (t: string) => void }) {
  const { items, addItems, deleteItem, clearAll, syncStatus } = useMediaLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    onToast("Загрузка медиафайлов…");
    const newItems: import("../hooks/useMediaLibrary").MediaItem[] = [];
    for (const f of Array.from(files)) {
      try {
        const dataUrl = await mediaFileToUrl(f);
        newItems.push({
          id: `m${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name,
          dataUrl,
          sizeKB: Math.round(f.size / 1024),
          createdAt: new Date().toLocaleDateString("ru-RU"),
          kind: f.type.startsWith("audio/") ? "audio" : "image",
        });
      } catch {
        onToast(`Не удалось загрузить ${f.name}`);
      }
    }
    if (newItems.length) {
      await addItems(newItems);
      onToast(`${newItems.length} медиафайлов добавлено`);
    } else {
      onToast("Файлы не были загружены");
    }
    setUploading(false);
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onToast("Ссылка скопирована");
    } catch {
      onToast("Не удалось скопировать");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
          Облако для логотипа, баннеров, изображений и звуковых уведомлений. Хранится в Supabase.
        </p>
        <span
          className={`ml-2 flex items-center gap-1 text-[10px] font-bold ${
            syncStatus === "synced"
              ? "text-emerald-600"
              : syncStatus === "syncing"
              ? "text-amber-600"
              : "text-red-500"
          }`}
        >
          {syncStatus === "synced" && <CheckCircle2 size={10} />} {syncStatus}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`mb-3 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
          dragOver ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Upload size={18} />
        </div>
        <p className="mt-2 text-[12px] font-bold text-slate-700">Перетащите изображения или аудиозапись сюда</p>
        <p className="text-[11px] text-slate-400">PNG, JPG, WebP, MP3, WAV, M4A, OGG, WebM</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-[12px] font-black text-white shadow-md shadow-teal-600/20 active:scale-95 disabled:opacity-50"
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {uploading ? "Загрузка…" : "Загрузить"}
          </button>
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Очистить всё облако?")) {
                  clearAll();
                  onToast("Облако очищено");
                }
              }}
              className="rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-500 active:scale-95"
            >
              Очистить
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <Images size={36} className="mb-2 opacity-30" />
          <p className="text-[12px] font-bold">Пока пусто</p>
          <p className="text-[11px]">Загрузите логотип, баннеры, аудиозапись и т.д.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
              <div className="aspect-square bg-slate-50">
                {item.kind === "audio" || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(item.name) || item.dataUrl.startsWith("data:audio/") ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-teal-600">
                    <Volume2 size={30} />
                    <audio controls src={item.dataUrl} className="w-full max-w-[140px]" />
                  </div>
                ) : (
                  <img src={item.dataUrl} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[11px] font-bold text-slate-700">{item.name}</div>
                <div className="text-[10px] text-slate-400">
                  {item.sizeKB} КБ · {item.createdAt}
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => copy(item.dataUrl)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                  >
                    <Copy size={12} /> Копировать
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Удалить изображение?")) deleteItem(item.id);
                    }}
                    className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ Statistics tab ============================ */
function StatisticsTab() {
  const { orders, loading } = useOrders();

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const paidOrders = orders.filter(
      (o) => o.status === "paid_online" || o.status === "paid_shop"
    );

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const monthlyRevenue = paidOrders
      .filter((o) => {
        const date = new Date(o.paidAt || o.createdAt);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, o) => sum + o.total, 0);
    const onlinePayments = paidOrders
      .filter((o) => o.status === "paid_online")
      .reduce((sum, o) => sum + o.total, 0);
    const offlinePayments = paidOrders
      .filter((o) => o.status === "paid_shop")
      .reduce((sum, o) => sum + o.total, 0);

    // Топ строится по фактическим продажам позиций, без минимального порога цены.
    const productsMap = new Map<
      number,
      { id: number; name: string; price: number; quantity: number; revenue: number }
    >();
    paidOrders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.productId;
        const quantity = item.unit === "м" ? item.meters || 0 : item.quantity || 0;
        const current = productsMap.get(key) || {
          id: key,
          name: item.name,
          price: item.price,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += quantity;
        current.revenue += item.sum;
        productsMap.set(key, current);
      });
    });
    const topProducts = [...productsMap.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10);

    return { totalRevenue, monthlyRevenue, onlinePayments, offlinePayments, topProducts };
  }, [orders]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="mb-4">
        <h3 className="text-[18px] font-black text-slate-800">Статистика продаж</h3>
        <p className="text-[11.5px] text-slate-400">
          Учитываются только заказы со статусом «Оплачен (картой)» или «Оплачен (магазин)»
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Выручка за все время
          </div>
          <div className="mt-1 text-[28px] font-black">{money(stats.totalRevenue)} ₽</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Выручка за месяц</div>
          <div className="mt-1 text-[28px] font-black">{money(stats.monthlyRevenue)} ₽</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-5 text-white shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Оплачено картой (онлайн)
          </div>
          <div className="mt-1 text-[28px] font-black">{money(stats.onlinePayments)} ₽</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 p-5 text-white shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Оплачено офлайн</div>
          <div className="mt-1 text-[28px] font-black">{money(stats.offlinePayments)} ₽</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h4 className="mb-3 text-[14px] font-black text-slate-800">Топ-10 товаров по продажам</h4>
        {loading ? (
          <div className="py-12 text-center text-[13px] font-bold text-slate-400">Загружаю продажи…</div>
        ) : stats.topProducts.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart3 size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-[14px] font-bold text-slate-500">Пока нет данных о продажах</p>
            <p className="mt-1 text-[12px] text-slate-400">Статистика появится после первых заказов</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.topProducts.map((p, index) => (
              <div key={p.id} className="flex items-center gap-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-[12px] font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-slate-800">{p.name}</div>
                  <div className="text-[11px] font-medium text-slate-400">
                    Продано: {p.quantity} · Выручка: {money(p.revenue)} ₽
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-black text-teal-700">{money(p.revenue)} ₽</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ Loyalty admin ============================ */
function LoyaltyAdmin({
  users,
  onSetReceiptStatus,
  onActivateUser,
  onToast,
}: {
  users: LoyaltyUser[];
  onSetReceiptStatus: (userId: string, receiptId: number, status: "approved" | "rejected") => void;
  onActivateUser: (userId: string) => void;
  onToast: (t: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmActivate) return;
    const t = setTimeout(() => setConfirmActivate(null), 2500);
    return () => clearTimeout(t);
  }, [confirmActivate]);

  const sorted = [...users].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-slate-400">
        <CreditCard size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-bold">Заявок пока нет</p>
        <p className="mt-1 text-[12px]">
          Здесь появятся клиенты, зарегистрировавшиеся на скидочную карту.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-slate-400">
        Проверьте фото чеков. Когда подтверждённая сумма достигнет{" "}
        {LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽ — активируйте карту. Чеки из заказов
        сайта подтверждаются автоматически.
      </p>
      <div className="space-y-2.5">
        {sorted.map((u) => {
          const approved = approvedSum(u);
          const ready = approved >= LOYALTY_THRESHOLD && u.status === "pending";
          const isOpen = expanded === u.id;
          return (
            <div key={u.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              <button
                onClick={() => setExpanded(isOpen ? null : u.id)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#123a5c] to-teal-600 text-[13px] font-black text-white">
                  {u.firstName[0]?.toUpperCase()}
                  {u.lastName[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-black text-slate-800">
                    {u.lastName} {u.firstName}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    {formatPhone(u.phone)} · чеков: {u.receipts.length}
                  </div>
                </div>
                {u.status === "active" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-600">
                    <UserCheck size={11} /> Активна
                  </span>
                ) : ready ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold text-amber-600">
                    Готово к активации
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10.5px] font-bold text-slate-500">
                    {approved.toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="space-y-2 p-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-baseline justify-between text-[12px]">
                          <span className="font-bold text-slate-500">Подтверждено</span>
                          <span className="font-black text-slate-700">
                            {approved.toLocaleString("ru-RU")} ₽{" "}
                            <span className="font-bold text-slate-400">
                              / {LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                            style={{
                              width: `${Math.min(100, (approved / LOYALTY_THRESHOLD) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {u.receipts.length === 0 ? (
                        <p className="py-2 text-center text-[12px] font-medium text-slate-400">
                          Чеки ещё не прикреплены
                        </p>
                      ) : (
                        [...u.receipts].reverse().map((r) => (
                          <div key={r.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2">
                            {r.img ? (
                              <a href={r.img} target="_blank" rel="noreferrer">
                                <img
                                  src={r.img}
                                  alt=""
                                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200"
                                />
                              </a>
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-300 ring-1 ring-slate-200">
                                <ReceiptIcon size={20} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold text-slate-700">
                                {r.sum.toLocaleString("ru-RU")} ₽
                              </div>
                              <div className="text-[10.5px] font-medium text-slate-400">
                                {r.date}
                                {r.orderNumber && (
                                  <span className="ml-1.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-black text-teal-700">
                                    Заказ {r.orderNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                            {r.status === "approved" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                                <CheckCircle2 size={11} /> ОК
                              </span>
                            )}
                            {r.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500">
                                <XCircle size={11} /> Отклонён
                              </span>
                            )}
                            {r.status === "pending" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    onSetReceiptStatus(u.id, r.id, "approved");
                                    onToast("Чек подтверждён");
                                  }}
                                  className="rounded-lg bg-emerald-500 p-2 text-white shadow-sm transition active:scale-90"
                                  title="Подтвердить"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    onSetReceiptStatus(u.id, r.id, "rejected");
                                    onToast("Чек отклонён");
                                  }}
                                  className="rounded-lg bg-slate-200 p-2 text-slate-500 transition active:scale-90"
                                  title="Отклонить"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {u.status === "pending" && (
                        <button
                          onClick={() => {
                            if (!ready) return;
                            if (confirmActivate === u.id) {
                              onActivateUser(u.id);
                              setConfirmActivate(null);
                              onToast(`Карта ${u.firstName} активирована`);
                            } else {
                              setConfirmActivate(u.id);
                            }
                          }}
                          disabled={!ready}
                          className={`w-full rounded-xl py-3 text-[13px] font-black transition active:scale-[0.98] ${
                            !ready
                              ? "cursor-not-allowed bg-slate-100 text-slate-400"
                              : confirmActivate === u.id
                              ? "bg-emerald-600 text-white shadow-md"
                              : "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/25"
                          }`}
                        >
                          {!ready
                            ? `До активации не хватает ${(LOYALTY_THRESHOLD - approved).toLocaleString("ru-RU")} ₽`
                            : confirmActivate === u.id
                            ? "Точно активировать карту?"
                            : "Активировать карту −5%"}
                        </button>
                      )}
                      {u.status === "active" && u.cardNumber && (
                        <div className="rounded-xl bg-emerald-50 p-3 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Номер карты
                          </div>
                          <div className="mt-0.5 font-mono text-[14px] font-black text-emerald-700">
                            {u.cardNumber}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ Cards admin: пользователи + карты ============================ */
function LoyaltyAdminV2({
  users,
  onSetReceiptStatus,
  onActivateUser,
  onToast,
}: {
  users: LoyaltyUser[];
  onSetReceiptStatus: (userId: string, receiptId: number, status: "approved" | "rejected") => void;
  onActivateUser: (userId: string) => void;
  onToast: (t: string) => void;
}) {
  const [section, setSection] = useState<"users" | "cards">("users");
  const [cardFilter, setCardFilter] = useState<"inactive" | "active">("inactive");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);

  const allUsers = [...users].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const cardUsers = allUsers.filter((user) => Array.isArray(user.receipts) && user.receipts.length > 0);
  const activeCards = cardUsers.filter((user) => user.status === "active");
  const inactiveCards = cardUsers.filter((user) => user.status !== "active");
  const visibleCards = cardFilter === "active" ? activeCards : inactiveCards;

  const initials = (user: LoyaltyUser) =>
    `${user.firstName?.[0] || "?"}${user.lastName?.[0] || ""}`.toUpperCase();
  const displayName = (user: LoyaltyUser) => `${user.lastName || ""} ${user.firstName || "Покупатель"}`.trim();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="mb-4 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        <button
          onClick={() => setSection("users")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-black transition ${
            section === "users" ? "bg-white text-[#123a5c] shadow-sm" : "text-slate-500"
          }`}
        >
          <Users size={15} /> Пользователи <span className="text-slate-400">{allUsers.length}</span>
        </button>
        <button
          onClick={() => setSection("cards")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-black transition ${
            section === "cards" ? "bg-white text-[#123a5c] shadow-sm" : "text-slate-500"
          }`}
        >
          <CreditCard size={15} /> Скидочные карты <span className="text-slate-400">{cardUsers.length}</span>
        </button>
      </div>

      {section === "users" ? (
        <>
          <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-slate-400">
            Все пользователи, которые зарегистрировали личный кабинет. Карта появляется в соседней вкладке только после загрузки первого чека.
          </p>
          {allUsers.length === 0 ? (
            <EmptyCards icon={<Users size={38} />} title="Пользователей пока нет" text="Здесь появятся покупатели после регистрации личного кабинета." />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              <div className="hidden grid-cols-[1.2fr_1fr_1fr_.7fr] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10.5px] font-black uppercase tracking-wider text-slate-400 lg:grid">
                <span>Пользователь</span><span>Телефон</span><span>Email</span><span>Регистрация</span>
              </div>
              {allUsers.map((user) => (
                <div key={user.id} className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 lg:grid-cols-[1.2fr_1fr_1fr_.7fr] lg:items-center lg:gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#123a5c] to-teal-600 text-[11px] font-black text-white">{initials(user)}</span>
                    <div className="min-w-0"><b className="block truncate text-[13px] text-slate-800">{displayName(user)}</b><span className="text-[10.5px] text-slate-400 lg:hidden">{user.status === "active" ? "Карта активна" : "Личный кабинет"}</span></div>
                  </div>
                  <div className="text-[12px] font-semibold text-slate-600">{formatPhone(user.phone || "")}</div>
                  <div className="flex items-center gap-1 truncate text-[12px] text-slate-500"><Mail size={12} className="shrink-0 text-slate-300" />{user.email || "Не указан"}</div>
                  <div className="text-[11.5px] text-slate-400">{user.createdAt || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex gap-1.5">
            <button onClick={() => setCardFilter("inactive")}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${cardFilter === "inactive" ? "bg-amber-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}>
              Неактивные карты ({inactiveCards.length})
            </button>
            <button onClick={() => setCardFilter("active")}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${cardFilter === "active" ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}>
              Активные карты ({activeCards.length})
            </button>
          </div>
          <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-slate-400">
            Здесь только пользователи, которые загрузили хотя бы один чек для участия в программе скидок.
          </p>
          {!visibleCards.length ? (
            <EmptyCards
              icon={<CreditCard size={38} />}
              title={cardFilter === "active" ? "Активных карт пока нет" : "Нет заявок на карту"}
              text={cardFilter === "active" ? "Подтверждённые администратором карты появятся здесь." : `Пользователи появятся здесь после загрузки первого чека или заказа от ${LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽.`}
            />
          ) : (
            <div className="space-y-2.5">
              {visibleCards.map((user) => {
                const approved = approvedSum(user);
                const pending = (user.receipts || []).filter((receipt) => receipt.status === "pending");
                const ready = approved >= LOYALTY_THRESHOLD && user.status === "pending";
                const isOpen = expanded === user.id;
                return (
                  <div key={user.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <button onClick={() => setExpanded(isOpen ? null : user.id)} className="flex w-full items-center gap-3 p-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#123a5c] to-teal-600 text-[12px] font-black text-white">{initials(user)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><b className="truncate text-[13.5px] text-slate-800">{displayName(user)}</b>{user.status === "active" && <CheckCircle2 size={14} className="text-emerald-500" />}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{formatPhone(user.phone || "")} · чеков: {(user.receipts || []).length}</div>
                      </div>
                      {user.status === "active" ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">Активна</span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ready ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>{ready ? "Готова" : `${approved.toLocaleString("ru-RU")} ₽`}</span>
                      )}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100">
                          <div className="space-y-2 p-3">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <div className="flex items-baseline justify-between text-[12px]"><span className="font-bold text-slate-500">Подтверждено</span><span className="font-black text-slate-700">{approved.toLocaleString("ru-RU")} ₽ <span className="text-slate-400">/ {LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽</span></span></div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${Math.min(100, approved / LOYALTY_THRESHOLD * 100)}%` }} /></div>
                            </div>
                            {[...(user.receipts || [])].reverse().map((receipt) => (
                              <div key={receipt.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2">
                                {receipt.img ? <a href={receipt.img} target="_blank" rel="noreferrer"><img src={receipt.img} alt="Чек" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" /></a> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-300 ring-1 ring-slate-200"><ReceiptIcon size={19} /></span>}
                                <div className="min-w-0 flex-1"><b className="text-[13px] text-slate-700">{receipt.sum.toLocaleString("ru-RU")} ₽</b><div className="text-[10.5px] text-slate-400">{receipt.date}{receipt.orderNumber && <span className="ml-1.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-black text-teal-700">Заказ {receipt.orderNumber}</span>}</div></div>
                                {receipt.status === "pending" ? (
                                  <div className="flex gap-1"><button onClick={() => { onSetReceiptStatus(user.id, receipt.id, "approved"); onToast("Чек подтверждён"); }} className="rounded-lg bg-emerald-500 p-2 text-white active:scale-90" title="Подтвердить"><CheckCircle2 size={14} /></button><button onClick={() => { onSetReceiptStatus(user.id, receipt.id, "rejected"); onToast("Чек отклонён"); }} className="rounded-lg bg-slate-200 p-2 text-slate-500 active:scale-90" title="Отклонить"><XCircle size={14} /></button></div>
                                ) : <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${receipt.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{receipt.status === "approved" ? "ОК" : "Отклонён"}</span>}
                              </div>
                            ))}
                            {user.status === "pending" && <button onClick={() => { if (!ready) return; if (confirmActivate === user.id) { onActivateUser(user.id); setConfirmActivate(null); onToast(`Карта ${user.firstName} активирована`); } else setConfirmActivate(user.id); }} disabled={!ready} className={`w-full rounded-xl py-3 text-[13px] font-black transition active:scale-[0.98] ${!ready ? "cursor-not-allowed bg-slate-100 text-slate-400" : confirmActivate === user.id ? "bg-emerald-600 text-white" : "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/25"}`}>{!ready ? `До активации не хватает ${(LOYALTY_THRESHOLD - approved).toLocaleString("ru-RU")} ₽` : confirmActivate === user.id ? "Точно активировать карту?" : "Активировать карту −5%"}</button>}
                            {user.status === "active" && user.cardNumber && <div className="rounded-xl bg-emerald-50 p-3 text-center"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Номер карты</div><div className="mt-0.5 font-mono text-[14px] font-black text-emerald-700">{user.cardNumber}</div></div>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyCards({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center text-slate-400 shadow-sm ring-1 ring-slate-100"><span className="mb-3 opacity-30">{icon}</span><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-1 max-w-sm text-[12px] leading-relaxed">{text}</p></div>;
}

/* ============================ Panel ============================ */
export default function AdminPanel({
  open,
  onClose,
  products,
  onUpdate,
  onAdd,
  onDelete,
  onSwap,
  onReset,
  categories,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  onMoveCategory,
  onResetCategories,
  syncStatus,
  loyaltyUsers,
  onSetReceiptStatus,
  onActivateUser,
  onSync,
  plumbers,
  onAddPlumber,
  onUpdatePlumber,
  onDeletePlumber,
  brands,
  onAddBrand,
  onUpdateBrand,
  onDeleteBrand,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onUpdate: (id: number, patch: Partial<Product>) => void;
  onAdd: (p: Omit<Product, "id">) => void;
  onDelete: (id: number) => void;
  onSwap: (idA: number, idB: number) => void;
  onReset: () => void;
  categories: Category[];
  onUpdateCategory: (key: string, patch: Partial<Category>) => void;
  onAddCategory: (category: Category) => void;
  onDeleteCategory: (key: string) => void;
  onMoveCategory: (key: string, dir: -1 | 1) => void;
  onResetCategories: () => void;
  syncStatus: "synced" | "syncing" | "error";
  loyaltyUsers: LoyaltyUser[];
  onSetReceiptStatus: (userId: string, receiptId: number, status: "approved" | "rejected") => void;
  onActivateUser: (userId: string) => void;
  onSync: () => Promise<{ ok: boolean; message: string; keys?: string[] }>;
  plumbers: Plumber[];
  onAddPlumber: (p: Omit<Plumber, "id">) => void;
  onUpdatePlumber: (id: string, patch: Partial<Plumber>) => void;
  onDeletePlumber: (id: string) => void;
  brands: Brand[];
  onAddBrand: (b: Brand) => void;
  onUpdateBrand: (key: string, patch: Partial<Brand>) => void;
  onDeleteBrand: (key: string) => void;
}) {
  const [tab, setTab] = useState<
    "products" | "categories" | "brands" | "orders" | "statistics" | "cards" | "plumbers" | "media"
  >("products");
  const pendingCards = loyaltyUsers.filter(
    (u) => u.status === "pending" && u.receipts.some((r) => r.status === "pending")
  ).length;
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === "1");
  const [showSqlTip, setShowSqlTip] = useState(false);
  const [query, setQuery] = useState("");
  const [navCategory, setNavCategory] = useState<string | null>(null);
  const [navSubcategory, setNavSubcategory] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const [syncingNow, setSyncingNow] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (confirmId !== null) {
      const t = setTimeout(() => setConfirmId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [confirmId]);

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const searchResults = isSearching
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    : [];

  const activeCategoryObj = navCategory
    ? categories.find((c) => c.key === navCategory) ?? null
    : null;
  const activeSubcategories = activeCategoryObj?.subcategories ?? [];
  const activeSubObj =
    navSubcategory !== "all" ? activeSubcategories.find((s) => s.key === navSubcategory) ?? null : null;

  const categoryProducts = navCategory
    ? products.filter((p) => productCategoryKey(p) === navCategory)
    : [];
  const visibleProducts = activeSubObj
    ? categoryProducts.filter((p) => productMatchesSubcategory(p, activeSubObj))
    : categoryProducts;

  const categoryCount = (key: string) =>
    products.filter((p) => productCategoryKey(p) === key).length;
  const subcategoryCount = (sub: Subcategory) =>
    categoryProducts.filter((p) => productMatchesSubcategory(p, sub)).length;

  const moveInVisibleList = (id: number, dir: -1 | 1) => {
    const idx = visibleProducts.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= visibleProducts.length) return;
    onSwap(id, visibleProducts[targetIdx].id);
  };

  const inStock = products.filter((p) => p.inStock).length;

  const save = (p: Product) => {
    const normalized: Product = {
      ...p,
      characteristics: p.characteristics
        ?.map((ch) => ({ name: ch.name.trim(), value: ch.value.trim() }))
        .filter((ch) => ch.name && ch.value),
    };
    if (!normalized.characteristics?.length) delete normalized.characteristics;
    if (normalized.gallery && !normalized.gallery.length) delete normalized.gallery;
    if (!normalized.oldPrice || normalized.oldPrice <= normalized.price) delete normalized.oldPrice;
    if (!normalized.warranty) delete normalized.warranty;

    if (isNew) {
      const { id: _id, ...rest } = normalized;
      onAdd(rest);
      setToast("Товар добавлен");
    } else {
      onUpdate(normalized.id, normalized);
      setToast("Сохранено");
    }
    setEditing(null);
    setIsNew(false);
  };

  const blank = (): Product => ({
    id: 0,
    name: "",
    price: 0,
    description: "",
    inStock: true,
    category: navCategory ?? categories[0]?.key ?? "",
    subcategory: navSubcategory !== "all" ? navSubcategory : undefined,
    code: "",
  });

  const NAV_ITEMS = [
    { key: "products" as const, label: "Товары", icon: Package, desc: `${products.length} позиций` },
    { key: "categories" as const, label: "Категории", icon: FolderTree, desc: `${categories.length} категории` },
    { key: "brands" as const, label: "Бренды", icon: Award, desc: `${brands.length} брендов` },
    { key: "orders" as const, label: "Заказы", icon: ShoppingBag, desc: "Приём и оплата" },
    { key: "statistics" as const, label: "Статистика", icon: BarChart3, desc: "Выручка и топ" },
    {
      key: "cards" as const,
      label: "Скидочные карты",
      icon: BadgePercent,
      desc: pendingCards ? `${pendingCards} на проверке` : "Заявки",
    },
    { key: "plumbers" as const, label: "Сантехники", icon: Wrench, desc: `${plumbers.length} мастеров` },
    { key: "media" as const, label: "Медиа", icon: Images, desc: "Лого, баннеры" },
  ] as const;

  /** Строка товара. */
  function ProductRow({
    p,
    reorder,
  }: {
    p: Product;
    reorder?: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void };
  }) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100"
      >
        {reorder && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={reorder.onUp}
              disabled={!reorder.canUp}
              className="rounded-md bg-slate-100 p-0.5 text-slate-500 transition active:scale-90 disabled:opacity-30"
              title="Выше"
            >
              <ChevronUp size={15} />
            </button>
            <button
              onClick={reorder.onDown}
              disabled={!reorder.canDown}
              className="rounded-md bg-slate-100 p-0.5 text-slate-500 transition active:scale-90 disabled:opacity-30"
              title="Ниже"
            >
              <ChevronDown size={15} />
            </button>
          </div>
        )}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img src={thumb(p)} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-slate-800">{p.name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[10.5px] text-slate-400">{p.code}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${p.inStock ? "bg-emerald-500" : "bg-amber-400"}`}
            />
            {p.warranty && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9.5px] font-black text-teal-700"
                title="В карточке показывается строка гарантии"
              >
                <ShieldCheck size={11} /> 12 мес
              </span>
            )}
          </div>
          <div className="text-[13px] font-black text-teal-700">
            {p.price.toLocaleString("ru-RU")} ₽
            {p.unit === "м" && <span className="text-[10.5px] font-bold text-slate-400"> / м</span>}
          </div>
        </div>
        <button
          onClick={() => {
            setEditing({ ...p });
            setIsNew(false);
          }}
          className="rounded-xl bg-teal-50 p-2.5 text-teal-700 transition active:scale-90"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => {
            if (confirmId === p.id) {
              onDelete(p.id);
              setConfirmId(null);
              setToast("Товар удалён");
            } else {
              setConfirmId(p.id);
            }
          }}
          className={`rounded-xl p-2.5 transition active:scale-90 ${
            confirmId === p.id
              ? "bg-red-500 text-white shadow-md shadow-red-500/30"
              : "bg-slate-100 text-slate-400"
          }`}
          title={confirmId === p.id ? "Точно удалить?" : "Удалить"}
        >
          <Trash2 size={16} />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] bg-[#f1f5f9] lg:bg-[#eef2f7]"
        >
          {!authed ? (
            <div className="flex min-h-full items-center justify-center p-4 lg:p-8">
              <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid lg:grid-cols-[1.05fr_0.95fr]">
                <div className="hidden flex-col justify-between bg-gradient-to-br from-[#0b2b45] via-[#0f4a5a] to-teal-600 p-8 text-white lg:flex">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                      <Lock size={22} />
                    </div>
                    <div>
                      <div className="text-[16px] font-black leading-none">Водяной</div>
                      <div className="text-[11px] font-bold tracking-widest text-white/60">
                        АДМИН ПАНЕЛЬ
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[28px] font-black leading-tight">
                      Управляйте
                      <br />
                      магазином
                    </h2>
                    <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/70">
                      Товары, категории, скидочные карты и сантехники — всё синхронизируется с Supabase
                      и доступно на всех устройствах.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-[11px] font-bold">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400" /> Supabase подключён
                      <span className="mx-1 text-white/30">•</span> {products.length} товаров
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-white/50">
                    Доступ: admin / 123456789
                  </div>
                </div>
                <Login onAuth={() => setAuthed(true)} />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col lg:flex-row">
              <aside className="hidden w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
                <div className="border-b border-slate-100 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b2b45] to-teal-600 text-white shadow-md">
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="text-[15px] font-black leading-none text-slate-800">
                        Админ-панель
                      </div>
                      <div className="text-[11px] font-medium text-slate-400">
                        {products.length} товаров · {inStock} в наличии
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    {syncStatus === "syncing" && (
                      <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                    )}
                    {syncStatus === "synced" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    {syncStatus === "error" && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    )}
                    <span
                      className={`text-[11px] font-bold ${
                        syncStatus === "syncing"
                          ? "text-amber-600"
                          : syncStatus === "synced"
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {syncStatus === "syncing"
                        ? "Синхронизация…"
                        : syncStatus === "synced"
                        ? "Supabase подключён"
                        : "Ошибка Supabase"}
                    </span>
                    <button
                      onClick={async () => {
                        setSyncingNow(true);
                        const r = await onSync();
                        setSyncingNow(false);
                        setToast(r.ok ? r.message : `Ошибка: ${r.message}`);
                      }}
                      className="ml-auto rounded-lg bg-white p-1 text-slate-400 hover:text-teal-600"
                    >
                      <RefreshCw size={12} className={syncingNow ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setTab(item.key)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                        tab === item.key
                          ? "bg-[#0b2b45] text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          tab === item.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <item.icon size={18} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-black leading-none">{item.label}</span>
                        <span
                          className={`block text-[11px] ${
                            tab === item.key ? "text-white/60" : "text-slate-400"
                          }`}
                        >
                          {item.desc}
                        </span>
                      </span>
                      {item.key === "cards" && pendingCards > 0 && (
                        <span
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                            tab === item.key ? "bg-white text-[#0b2b45]" : "bg-amber-500 text-white"
                          }`}
                        >
                          {pendingCards}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="border-t border-slate-100 p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={onClose}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-200"
                    >
                      <X size={16} /> Закрыть
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem(AUTH_KEY);
                        setAuthed(false);
                        onClose();
                      }}
                      className="flex items-center justify-center rounded-xl bg-slate-100 p-2.5 text-slate-500 hover:bg-slate-200"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* мобильная шапка */}
                <div className="shrink-0 bg-white shadow-[0_2px_16px_rgba(15,60,70,0.08)] lg:hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={onClose}
                      className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[17px] font-black leading-none tracking-tight text-slate-800">
                        Админ-панель
                      </h2>
                      <p className="mt-1 text-[11.5px] font-medium text-slate-400">
                        {products.length} товаров · {inStock} в наличии
                      </p>
                      <div className="mt-1.5 flex items-center">
                        {syncStatus === "syncing" && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-500">
                            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
                            Синхронизация Supabase...
                          </span>
                        )}
                        {syncStatus === "synced" && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Supabase подключен ✅
                          </span>
                        )}
                        {syncStatus === "error" && (
                          <button
                            onClick={() => setShowSqlTip(true)}
                            className="inline-flex items-center gap-1 text-left text-[10.5px] font-bold text-red-500 underline decoration-red-400 underline-offset-2 hover:text-red-600"
                          >
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                            Supabase: ошибка таблиц (нажать)
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            setSyncingNow(true);
                            const result = await onSync();
                            setSyncingNow(false);
                            setToast(result.ok ? result.message : `Ошибка: ${result.message}`);
                          }}
                          disabled={syncingNow}
                          className="ml-2 rounded-lg bg-slate-100 p-1 text-slate-400 transition hover:text-teal-600 active:scale-90 disabled:opacity-50"
                          title="Синхронизировать сейчас"
                        >
                          <RefreshCw size={12} className={syncingNow ? "animate-spin" : ""} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem(AUTH_KEY);
                        setAuthed(false);
                        onClose();
                      }}
                      title="Выйти"
                      className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
                    >
                      <LogOut size={19} />
                    </button>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      { key: "products" as const, label: "Товары", icon: Package },
                      { key: "categories" as const, label: "Категории", icon: FolderTree },
                      { key: "brands" as const, label: "Бренды", icon: Award },
                      { key: "orders" as const, label: "Заказы", icon: ShoppingBag },
                      { key: "cards" as const, label: "Карты", icon: BadgePercent },
                      { key: "plumbers" as const, label: "Сантехники", icon: Wrench },
                      { key: "media" as const, label: "Медиа", icon: Images },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`relative flex shrink-0 items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] min-[380px]:gap-1.5 min-[380px]:text-[12.5px] font-black transition active:scale-95 ${
                          tab === t.key
                            ? "bg-gradient-to-r from-[#123a5c] to-teal-600 text-white shadow-md shadow-teal-700/20"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <t.icon size={14} strokeWidth={2.5} />
                        {t.label}
                        {t.key === "cards" && pendingCards > 0 && (
                          <span
                            className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-black ${
                              tab === "cards" ? "bg-white text-teal-700" : "bg-amber-400 text-white"
                            }`}
                          >
                            {pendingCards}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {tab === "products" && (
                    <>
                      <div className="flex gap-2 px-4 pb-3">
                        <div className="relative flex-1">
                          <Search
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Поиск по названию или артикулу"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-[13.5px] font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white"
                          />
                        </div>
                        <button
                          onClick={() => {
                            setEditing(blank());
                            setIsNew(true);
                          }}
                          className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-3.5 text-[13px] font-black text-white shadow-md shadow-teal-600/25 active:scale-95"
                        >
                          <Plus size={16} strokeWidth={3} />
                        </button>
                      </div>

                      {!isSearching && navCategory && (
                        <div className="flex items-center gap-1.5 px-4 pb-2 text-[12px] font-bold text-teal-700">
                          <button
                            onClick={() => {
                              setNavCategory(null);
                              setNavSubcategory("all");
                            }}
                            className="flex items-center gap-1 active:scale-95"
                          >
                            <ArrowLeft size={14} /> Все категории
                          </button>
                          <span className="text-slate-300">/</span>
                          <span className="truncate text-slate-500">
                            {activeCategoryObj?.label}
                            {activeSubObj ? ` / ${activeSubObj.label}` : ""}
                          </span>
                        </div>
                      )}

                      {!isSearching && navCategory && activeSubcategories.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <button
                            onClick={() => setNavSubcategory("all")}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition active:scale-95 ${
                              navSubcategory === "all"
                                ? "bg-[#123a5c] text-white shadow-sm"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            Все ({categoryProducts.length})
                          </button>
                          {activeSubcategories.map((s) => (
                            <button
                              key={s.key}
                              onClick={() => setNavSubcategory(s.key)}
                              className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition active:scale-95 ${
                                navSubcategory === s.key
                                  ? "bg-[#123a5c] text-white shadow-sm"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {s.label} ({subcategoryCount(s)})
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* десктопная панель товаров */}
                {tab === "products" && (
                  <div className="hidden shrink-0 border-b border-slate-200 bg-white px-6 py-4 lg:block">
                    <div className="flex items-center gap-3">
                      {(navCategory || isSearching) && (
                        <button
                          onClick={() => {
                            if (isSearching) setQuery("");
                            setNavCategory(null);
                            setNavSubcategory("all");
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-[12.5px] font-black text-slate-600 transition hover:bg-slate-200 active:scale-95"
                        >
                          <ArrowLeft size={15} /> К категориям
                        </button>
                      )}

                      <div className="min-w-0">
                        <h2 className="truncate text-[18px] font-black text-slate-900">
                          {isSearching
                            ? "Результаты поиска"
                            : activeSubObj?.label ?? activeCategoryObj?.label ?? "Категории товаров"}
                        </h2>
                        <p className="text-[11.5px] font-medium text-slate-400">
                          {isSearching
                            ? `${searchResults.length} найдено`
                            : navCategory
                            ? `${visibleProducts.length} товаров`
                            : `${categories.length} категорий · ${products.length} товаров`}
                        </p>
                      </div>

                      <div className="relative ml-auto w-full max-w-sm">
                        <Search
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Поиск по названию или артикулу"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setEditing(blank());
                          setIsNew(true);
                        }}
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 text-[13px] font-black text-white shadow-md shadow-teal-600/25 transition hover:shadow-lg active:scale-95"
                      >
                        <Plus size={16} strokeWidth={3} /> Добавить товар
                      </button>
                    </div>

                    {!isSearching && navCategory && activeSubcategories.length > 0 && (
                      <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          onClick={() => setNavSubcategory("all")}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition active:scale-95 ${
                            navSubcategory === "all"
                              ? "bg-[#123a5c] text-white shadow-sm"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          Все ({categoryProducts.length})
                        </button>
                        {activeSubcategories.map((sub) => (
                          <button
                            key={sub.key}
                            onClick={() => setNavSubcategory(sub.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition active:scale-95 ${
                              navSubcategory === sub.key
                                ? "bg-[#123a5c] text-white shadow-sm"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {sub.label} ({subcategoryCount(sub)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "products" && (
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {isSearching ? (
                      searchResults.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-slate-400">
                          <Package size={36} className="mb-3 opacity-40" />
                          <p className="text-sm font-bold">Ничего не найдено</p>
                        </div>
                      ) : (
                        <div className="grid gap-2 lg:grid-cols-2">
                          {searchResults.map((p) => (
                            <ProductRow
                              key={p.id}
                              p={p}
                              reorder={{
                                canUp: false,
                                canDown: false,
                                onUp: () => {},
                                onDown: () => {},
                              }}
                            />
                          ))}
                        </div>
                      )
                    ) : !navCategory ? (
                      <div className="space-y-2">
                        {categories.map((c) => (
                          <button
                            key={c.key}
                            onClick={() => {
                              setNavCategory(c.key);
                              setNavSubcategory("all");
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100 transition active:scale-[0.98]"
                          >
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-slate-200">
                              <img src={c.img} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="truncate text-[14px] font-black text-slate-800">
                                {c.label}
                              </div>
                              <div className="text-[11.5px] font-medium text-slate-500">
                                {categoryCount(c.key)} товаров
                                {c.subcategories?.length ? ` · ${c.subcategories.length} подкатегорий` : ""}
                              </div>
                            </div>
                            <ChevronRight size={18} className="shrink-0 text-slate-300" />
                          </button>
                        ))}
                        {categories.length === 0 && (
                          <p className="py-10 text-center text-[12.5px] font-medium text-slate-400">
                            Сначала создайте категории во вкладке «Категории»
                          </p>
                        )}
                      </div>
                    ) : visibleProducts.length === 0 ? (
                      <div className="flex flex-col items-center py-16 text-slate-400">
                        <Package size={36} className="mb-3 opacity-40" />
                        <p className="text-sm font-bold">Товаров пока нет</p>
                      </div>
                    ) : (
                      <div className="grid gap-2 lg:grid-cols-2">
                        {visibleProducts.map((p, i) => (
                          <ProductRow
                            key={p.id}
                            p={p}
                            reorder={{
                              canUp: i > 0,
                              canDown: i < visibleProducts.length - 1,
                              onUp: () => moveInVisibleList(p.id, -1),
                              onDown: () => moveInVisibleList(p.id, 1),
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {!isSearching && !navCategory && (
                      <div className="mt-6 border-t border-slate-200 pt-4 pb-2">
                        <button
                          onClick={() => {
                            if (resetConfirm) {
                              onReset();
                              setResetConfirm(false);
                              setToast("Каталог сброшен");
                            } else {
                              setResetConfirm(true);
                              setTimeout(() => setResetConfirm(false), 2500);
                            }
                          }}
                          className={`mx-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold transition active:scale-95 ${
                            resetConfirm
                              ? "bg-red-500 text-white shadow-md"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <RotateCcw size={14} />
                          {resetConfirm ? "Точно сбросить каталог?" : "Сбросить каталог к исходному"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {tab === "categories" && (
                  <CategoryEditor
                    categories={categories}
                    onUpdate={onUpdateCategory}
                    onAdd={onAddCategory}
                    onDelete={onDeleteCategory}
                    onMove={onMoveCategory}
                    onReset={onResetCategories}
                    onToast={setToast}
                  />
                )}

                {tab === "orders" && <OrdersTab onToast={setToast} />}

                {tab === "cards" && (
                  <LoyaltyAdminV2
                    users={loyaltyUsers}
                    onSetReceiptStatus={onSetReceiptStatus}
                    onActivateUser={onActivateUser}
                    onToast={setToast}
                  />
                )}

                {tab === "plumbers" && (
                  <PlumbersAdmin
                    plumbers={plumbers}
                    onAdd={onAddPlumber}
                    onUpdate={onUpdatePlumber}
                    onDelete={onDeletePlumber}
                    onToast={setToast}
                  />
                )}

                {tab === "brands" && (
                  <BrandsAdmin
                    brands={brands}
                    products={products}
                    onAdd={onAddBrand}
                    onUpdate={onUpdateBrand}
                    onDelete={onDeleteBrand}
                    onToast={setToast}
                  />
                )}

                {tab === "media" && <MediaAdmin onToast={setToast} />}

                {tab === "statistics" && <StatisticsTab />}

                <AnimatePresence>
                  {editing && (
                    <EditForm
                      initial={editing}
                      isNew={isNew}
                      categories={categories}
                      brands={brands}
                      onSave={save}
                      onClose={() => {
                        setEditing(null);
                        setIsNew(false);
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#123a5c] px-5 py-2.5 text-[13px] font-black text-white shadow-xl"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>

          {!authed && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-xl bg-white/80 p-2 text-slate-500 shadow-md backdrop-blur active:scale-90"
            >
              <X size={20} />
            </button>
          )}

          <AnimatePresence>
            {showSqlTip && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowSqlTip(false)}
                  className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="absolute left-4 right-4 top-1/2 z-[80] mx-auto max-h-[88vh] max-w-sm -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"
                >
                  <div className="flex items-center border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-800">Настройка Supabase</h3>
                    <button
                      onClick={() => setShowSqlTip(false)}
                      className="ml-auto text-slate-400 active:scale-90"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-slate-600">
                    <p>
                      <b>Таблица и Storage.</b> Для синхронизации необходимо создать одну таблицу в
                      проекте Supabase.
                    </p>
                    <p>
                      1. Откройте панель управления <b>Supabase</b>.
                      <br />
                      2. Перейдите в раздел <b>SQL Editor</b>.
                      <br />
                      3. Нажмите <b>New query</b>.
                      <br />
                      4. Скопируйте и вставьте следующий SQL-код:
                    </p>
                    <pre className="select-all overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-teal-700">
                      {SETUP_SQL}
                    </pre>
                    <p>
                      5. Нажмите кнопку <b>Run</b>, затем проверьте запись кнопкой ниже.
                    </p>
                    <button
                      onClick={async () => {
                        setToast("Проверяем запись…");
                        const r = await cloudSync.selfTest();
                        setToast(r.ok ? "✅ " + r.message : "❌ " + r.message);
                      }}
                      className="w-full rounded-xl bg-emerald-600 py-2.5 text-[12.5px] font-black text-white active:scale-[0.98]"
                    >
                      Проверить запись в Supabase
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SETUP_SQL);
                      setToast("Скопировано!");
                      setShowSqlTip(false);
                    }}
                    className="mt-4 w-full rounded-xl bg-teal-600 py-3 text-[14px] font-bold text-white shadow-lg shadow-teal-600/10 active:scale-95"
                  >
                    Скопировать SQL код
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
