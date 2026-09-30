import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Phone, Send, CheckCircle2, Camera, X } from "lucide-react";
import type { Plumber, PlumberReview } from "../hooks/usePlumbers";
import { imageFileToDataUrl } from "../utils/imageUpload";

const fileToDataUrl = imageFileToDataUrl;

export default function PlumbersList({
  open,
  plumbers,
  onAddReview,
  onClose,
}: {
  open: boolean;
  plumbers: Plumber[];
  onAddReview: (plumberId: string, review: Omit<PlumberReview, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Plumber | null>(null);
  const [toast, setToast] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [reviewForm, setReviewForm] = useState<{
    authorName: string;
    authorPhone: string;
    rating: number;
    text: string;
    photos: string[];
  }>({ authorName: "", authorPhone: "", rating: 5, text: "", photos: [] });

  // Если в пропсах обновился сантехник (пришёл новый отзыв) — синхронизируем карточку.
  useEffect(() => {
    if (!selected) return;
    const fresh = plumbers.find((p) => p.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [plumbers, selected]);

  // При открытии списка или переходе к мастеру начинаем чтение сверху.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, selected?.id]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const data = await fileToDataUrl(f);
        setReviewForm((p) => ({ ...p, photos: [...p.photos, data] }));
      } catch {
        /* пропускаем */
      }
    }
  };

  const submitReview = () => {
    if (!selected || !reviewForm.authorName.trim() || !reviewForm.text.trim()) return;
    onAddReview(selected.id, {
      authorName: reviewForm.authorName.trim(),
      authorPhone: reviewForm.authorPhone.trim(),
      rating: reviewForm.rating,
      text: reviewForm.text.trim(),
      photos: reviewForm.photos.length ? reviewForm.photos : undefined,
    });
    setReviewForm({ authorName: "", authorPhone: "", rating: 5, text: "", photos: [] });
    setToast("Отзыв опубликован");
    setTimeout(() => setToast(""), 1800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] flex flex-col bg-[#f4f8fa]"
        >
          <div className="flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_2px_16px_rgba(15,60,70,0.08)] lg:px-8 lg:py-4">
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-100 p-2 text-slate-500 transition active:scale-90"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-[17px] font-black text-slate-800 lg:text-[20px]">
              {selected ? "О мастере" : "Наши сантехники"}
            </h2>
          </div>

          <div ref={pageScrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-7">
            {!selected ? (
              <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex items-end justify-between">
                  <p className="max-w-lg text-[13px] font-semibold leading-relaxed text-slate-600 lg:text-[15px]">
                  Сантехники, которым доверяет магазин{" "}
                  <span className="font-black text-[#123a5c]">«Водяной»</span>
                  </p>
                  <span className="hidden text-[13px] font-bold text-slate-400 lg:block">{plumbers.length} мастеров</span>
                </div>
                <div className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0">
                {plumbers.map((p) => (
                  <motion.button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ y: -5 }}
                    className="flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md lg:flex-col lg:items-stretch lg:gap-0 lg:p-0"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-slate-200 lg:h-48 lg:w-full lg:rounded-none lg:ring-0">
                      {p.photo ? (
                        <img src={p.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-teal-600">
                          <span className="text-[22px] font-black">
                            {p.firstName[0]}
                            {p.lastName[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left lg:p-4">
                      <div className="text-[15px] font-black text-slate-800 lg:text-[18px]">
                        {p.firstName} {p.lastName}
                      </div>
                      {p.rating && (
                        <div className="mt-0.5 flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={
                                i < Math.round(p.rating!)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }
                            />
                          ))}
                          <span className="ml-1 text-[11px] font-bold text-slate-400">
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 text-[11.5px] font-medium text-slate-500">
                        {p.reviews?.length ?? 0} отзывов
                      </div>
                      <p className="mt-3 hidden line-clamp-2 text-[12.5px] leading-relaxed text-slate-500 lg:block">
                        {p.description}
                      </p>
                      {p.specialties && p.specialties.length > 0 && (
                        <div className="mt-3 hidden flex-wrap gap-1.5 lg:flex">
                          {p.specialties.slice(0, 2).map((specialty) => (
                            <span key={specialty} className="rounded-full bg-teal-50 px-2.5 py-1 text-[10.5px] font-bold text-teal-700">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-6xl space-y-4">
                <button
                  onClick={() => setSelected(null)}
                  className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-teal-700"
                >
                  <ArrowLeft size={14} /> Назад к списку
                </button>

                <div className="lg:grid lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] lg:gap-6 lg:items-start">
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-0">
                    <div className="aspect-[4/3] w-full bg-gradient-to-br from-teal-50 to-teal-100 lg:aspect-square">
                    {selected.photo ? (
                      <img src={selected.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-teal-600">
                        <span className="text-[60px] font-black">
                          {selected.firstName[0]}
                          {selected.lastName[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-[19px] font-black text-slate-800 lg:text-[23px]">
                      {selected.firstName} {selected.lastName}
                    </h3>
                    {selected.rating && (
                      <div className="mt-1.5 flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={
                              i < Math.round(selected.rating!)
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }
                          />
                        ))}
                        <span className="ml-1 text-[12px] font-bold text-slate-400">
                          {selected.rating.toFixed(1)} · {selected.reviews?.length ?? 0} отзывов
                        </span>
                      </div>
                    )}
                    <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
                      {selected.description}
                    </p>
                    {selected.specialties && selected.specialties.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selected.specialties.map((s, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <a
                      href={`tel:${selected.phone}`}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#123a5c] py-3 text-[14px] font-black text-white shadow-lg shadow-[#123a5c]/20 active:scale-[0.98]"
                    >
                      <Phone size={16} /> {selected.phone}
                    </a>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:mt-0 lg:p-6">
                  <h4 className="mb-3 text-[14px] font-black text-slate-800">
                    Отзывы ({selected.reviews?.length ?? 0})
                  </h4>

                  {(selected.reviews ?? []).length > 0 ? (
                    <div className="mb-4 space-y-2">
                      <AnimatePresence initial={false}>
                        {(selected.reviews ?? []).map((r) => (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-bold text-slate-700">
                                  {r.authorName}
                                </span>
                                {r.authorPhone && (
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={11}
                                    className={
                                      i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-[12.5px] leading-relaxed text-slate-600">{r.text}</p>
                            {r.photos && r.photos.length > 0 && (
                              <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {r.photos.map((src, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setPreviewPhoto(src)}
                                    className="h-20 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 transition active:scale-95"
                                  >
                                    <img src={src} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="mt-1.5 text-[10.5px] font-medium text-slate-400">
                              {r.createdAt}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <p className="mb-4 py-3 text-center text-[12.5px] font-medium text-slate-400">
                      Отзывов пока нет — станьте первым
                    </p>
                  )}

                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    <div className="text-[12px] font-black text-slate-700">Оставить отзыв</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Ваша оценка:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            onClick={() => setReviewForm((p) => ({ ...p, rating: r }))}
                            className="transition active:scale-90"
                          >
                            <Star
                              size={18}
                              className={
                                r <= reviewForm.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      <input
                        value={reviewForm.authorName}
                        onChange={(e) => setReviewForm((p) => ({ ...p, authorName: e.target.value }))}
                        placeholder="Ваше имя"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-teal-500"
                      />
                      <input
                        value={reviewForm.authorPhone}
                        onChange={(e) => setReviewForm((p) => ({ ...p, authorPhone: e.target.value }))}
                        placeholder="Телефон (необязательно)"
                        inputMode="tel"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-teal-500"
                      />
                    </div>
                    <textarea
                      value={reviewForm.text}
                      onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))}
                      placeholder="Ваш отзыв..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-teal-500"
                    />

                    {reviewForm.photos.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {reviewForm.photos.map((src, i) => (
                          <div
                            key={i}
                            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200"
                          >
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              onClick={() =>
                                setReviewForm((p) => ({
                                  ...p,
                                  photos: p.photos.filter((_, idx) => idx !== i),
                                }))
                              }
                              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white backdrop-blur-sm active:scale-90"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => photoRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-teal-300 bg-teal-50/50 py-2 text-[12px] font-bold text-teal-700 transition active:scale-[0.98]"
                    >
                      <Camera size={14} /> Фото выполненной работы
                    </button>
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />

                    <button
                      onClick={submitReview}
                      disabled={!reviewForm.authorName.trim() || !reviewForm.text.trim()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2.5 text-[13px] font-black text-white transition active:scale-[0.98] disabled:opacity-40"
                    >
                      <Send size={14} /> Отправить отзыв
                    </button>
                  </div>
                </div>
                </div>
              </div>
            )}

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

            <AnimatePresence>
              {previewPhoto && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPreviewPhoto(null)}
                    className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className="absolute inset-4 z-40 flex items-center justify-center lg:inset-16"
                  >
                    <div className="relative max-h-full max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
                      <button
                        onClick={() => setPreviewPhoto(null)}
                        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm active:scale-90"
                      >
                        <X size={16} />
                      </button>
                      <img
                        src={previewPhoto}
                        alt="Фото выполненной работы"
                      className="max-h-[85vh] max-w-[88vw] object-contain lg:max-h-[80vh] lg:max-w-[78vw]"
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
