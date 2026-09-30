import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Полноэкранный просмотр фото товара с увеличением.
 * — клик по фото — зум ×2.25 и обратно, при зуме фото перетаскивается;
 * — стрелки на экране и клавиши ←/→ — листать галерею, Esc — закрыть;
 * — кнопки +/− и «во весь экран» — точный контроль масштаба.
 */
export default function ImageViewer({
  images,
  index,
  onIndexChange,
  open,
  onClose,
}: {
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);

  // При смене фото возвращаем масштаб к вписыванию.
  useEffect(() => {
    setZoom(MIN_ZOOM);
    setPos({ x: 0, y: 0 });
  }, [index, open]);

  // Клавиатура + блокировка прокрутки страницы под просмотром.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      else if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, z + 0.5));
      else if (e.key === "-") setZoom((z) => Math.max(MIN_ZOOM, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  const go = (dir: -1 | 1) => onIndexChange((index + dir + images.length) % images.length);

  const clampPos = (x: number, y: number) => {
    const l = 170 * (zoom - 1);
    return { x: Math.max(-l, Math.min(l, x)), y: Math.max(-l, Math.min(l, y)) };
  };

  const toggleZoom = () => {
    if (zoom > MIN_ZOOM) {
      setZoom(MIN_ZOOM);
      setPos({ x: 0, y: 0 });
    } else {
      setZoom(2.25);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[95] flex flex-col bg-slate-950/95 backdrop-blur-sm"
        >
          {/* верхняя панель */}
          <div className="flex shrink-0 items-center gap-2 px-4 py-3">
            <span className="font-mono text-[12px] font-bold text-white/70">
              {index + 1} / {images.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-90"
                title="Уменьшить"
              >
                <ZoomOut size={18} />
              </button>
              <span className="min-w-[42px] text-center font-mono text-[11.5px] font-bold text-white/70">
                ×{zoom.toFixed(1)}
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-90"
                title="Увеличить"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => {
                  setZoom(MIN_ZOOM);
                  setPos({ x: 0, y: 0 });
                }}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-90"
                title="Вписать в экран"
              >
                <Maximize2 size={18} />
              </button>
              <button
                onClick={onClose}
                className="ml-1 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25 active:scale-90"
                title="Закрыть (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* фото: клик по пустому месту закрывает, клик по фото — зум */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <img
              src={images[index]}
              alt=""
              draggable={false}
              onClick={() => {
                if (movedRef.current) return;
                toggleZoom();
              }}
              onPointerDown={(e) => {
                movedRef.current = false;
                if (zoom <= MIN_ZOOM) return;
                dragRef.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d) return;
                const dx = e.clientX - d.x;
                const dy = e.clientY - d.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
                setPos(clampPos(d.ox + dx, d.oy + dy));
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150 will-change-transform"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                cursor: zoom > MIN_ZOOM ? "grab" : "zoom-in",
              }}
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 active:scale-90 sm:left-5"
                  title="Предыдущее фото"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 active:scale-90 sm:right-5"
                  title="Следующее фото"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          {/* миниатюры */}
          {images.length > 1 && (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => onIndexChange(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-2 transition ${
                    i === index ? "ring-orange-400" : "opacity-50 ring-white/20 hover:opacity-100"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
