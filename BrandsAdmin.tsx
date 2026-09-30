import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2, X, ImagePlus } from "lucide-react";
import { COUNTRY_FLAGS, COUNTRY_NAMES, type Brand, type Product } from "../data/catalog";
import { imageFileToDataUrl } from "../utils/imageUpload";

const input =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white";
const label = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[а-яё]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const emptyBrand = (): Brand => ({ key: "", name: "" });

export default function BrandsAdmin({
  brands,
  products,
  onAdd,
  onUpdate,
  onDelete,
  onToast,
}: {
  brands: Brand[];
  products: Product[];
  onAdd: (b: Brand) => void;
  onUpdate: (key: string, patch: Partial<Brand>) => void;
  onDelete: (key: string) => void;
  onToast: (t: string) => void;
}) {
  const [editing, setEditing] = useState<{ brand: Brand; originalKey?: string } | null>(null);
  const countIn = (key: string) => products.filter((p) => p.brandId === key).length;

  const remove = (b: Brand) => {
    const n = countIn(b.key);
    const ok = window.confirm(
      n > 0
        ? `У бренда «${b.name}» ${n} товаров. Удалить бренд? У этих товаров бренд будет снят.`
        : `Удалить бренд «${b.name}»?`
    );
    if (!ok) return;
    onDelete(b.key);
    onToast("Бренд удалён");
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="h-full space-y-3 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-[15px] font-black text-slate-900 lg:text-[18px]">Бренды</h2>
          <p className="text-[11.5px] text-slate-400">
            Бренд показывается в карточке товара: логотип, родина бренда и страна производства
          </p>
        </div>
        <button
          onClick={() => setEditing({ brand: emptyBrand() })}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-[12px] font-black text-white transition active:scale-95 hover:bg-teal-700"
        >
          <Plus size={15} /> Добавить бренд
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-[13px] font-bold text-slate-400 shadow-sm">
          Брендов пока нет — добавьте первый.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <div key={b.key} className="rounded-2xl bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                {b.logo ? (
                  <img src={b.logo} alt="" className="h-10 w-16 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[13px] font-black italic text-slate-500">
                    {b.name}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-black text-slate-900">{b.name}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {b.key} · {countIn(b.key)} товаров
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing({ brand: { ...b }, originalKey: b.key })}
                    className="rounded-lg p-1.5 text-teal-600 transition hover:bg-teal-50"
                    title="Редактировать"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(b)}
                    className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-[11.5px] font-semibold text-slate-500">
                {b.countryOrigin && (
                  <div>
                    {COUNTRY_FLAGS[b.countryOrigin] ?? "🏳️"} {b.countryOrigin} — родина бренда
                  </div>
                )}
                {b.countryMade && (
                  <div>
                    {COUNTRY_FLAGS[b.countryMade] ?? "🏳️"} {b.countryMade} — страна производства
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      <AnimatePresence>
        {editing && (
          <BrandEditForm
            initial={editing.brand}
            originalKey={editing.originalKey}
            onSave={(brand) => {
              if (editing.originalKey) {
                onUpdate(editing.originalKey, brand);
                onToast("Бренд сохранён");
              } else {
                onAdd(brand);
                onToast("Бренд добавлен");
              }
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BrandEditForm({
  initial,
  originalKey,
  onSave,
  onClose,
}: {
  initial: Brand;
  originalKey?: string;
  onSave: (b: Brand) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Brand>(initial);
  const [nameTouched, setNameTouched] = useState(!!originalKey);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const name = d.name.trim();
    if (name.length < 2) {
      window.alert("Введите название бренда");
      return;
    }
    const key = (d.key || slug(name) || `brand-${Date.now()}`).trim();
    onSave({
      key,
      name,
      logo: d.logo?.trim() || undefined,
      countryOrigin: d.countryOrigin || undefined,
      countryMade: d.countryMade || undefined,
      info: d.info?.trim() || undefined,
    });
  };

  const countrySelect = (field: "countryOrigin" | "countryMade", text: string) => (
    <div>
      <label className={label}>{text}</label>
      <select value={d[field] ?? ""} onChange={(e) => set(field, e.target.value || undefined)} className={input}>
        <option value="">— не указано —</option>
        {COUNTRY_NAMES.map((c) => (
          <option key={c} value={c}>
            {COUNTRY_FLAGS[c]} {c}
          </option>
        ))}
      </select>
    </div>
  );

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
      <div className="flex h-full w-full flex-col bg-[#f4f8fa] lg:h-auto lg:max-h-[90vh] lg:w-full lg:max-w-lg lg:overflow-hidden lg:rounded-[1.75rem] lg:bg-white lg:shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <span className="text-[14px] font-black text-slate-900">
            {originalKey ? "Бренд" : "Новый бренд"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:p-6">
          <div>
            <label className={label}>Название</label>
            <input
              value={d.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!nameTouched) set("key", slug(e.target.value));
              }}
              placeholder="Например, Valtec"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Ключ (латиницей, уникальный)</label>
            <input
              value={d.key}
              onChange={(e) => {
                setNameTouched(true);
                set("key", slug(e.target.value));
              }}
              placeholder="valtec"
              className={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {countrySelect("countryOrigin", "Родина бренда")}
            {countrySelect("countryMade", "Страна производства")}
          </div>

          <div>
            <label className={label}>Логотип бренда</label>
            <div className="flex items-center gap-3">
              {d.logo ? (
                <img src={d.logo} alt="" className="h-12 w-20 rounded-lg border border-slate-200 object-contain" />
              ) : (
                <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-400">
                  нет лого
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  value={d.logo ?? ""}
                  onChange={(e) => set("logo", e.target.value || undefined)}
                  placeholder="https://… или загрузите файл"
                  className={input}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-200"
                  >
                    <ImagePlus size={13} /> {uploading ? "Загрузка…" : "Загрузить файл"}
                  </button>
                  {d.logo && (
                    <button
                      onClick={() => set("logo", undefined)}
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      Убрать
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setUploading(true);
                    try {
                      set("logo", await imageFileToDataUrl(f));
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : "Ошибка загрузки изображения");
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={label}>Справка о бренде (показывается по иконке «i»)</label>
            <textarea
              value={d.info ?? ""}
              onChange={(e) => set("info", e.target.value || undefined)}
              placeholder="Чем известен бренд, ассортимент, гарантия…"
              className={`${input} min-h-[80px] resize-none`}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-4 lg:px-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12.5px] font-black text-slate-500 transition hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-[12.5px] font-black text-white transition hover:bg-teal-700 active:scale-95"
          >
            Сохранить
          </button>
        </div>
      </div>
    </motion.div>
  );
}
