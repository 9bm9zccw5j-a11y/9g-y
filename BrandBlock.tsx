import { useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { Brand } from "../data/catalog";
import { COUNTRY_FLAGS } from "../data/catalog";

/**
 * Блок «Оригинальные товары с гарантией» в карточке товара:
 * имя бренда, логотип, ссылка на все товары бренда и страны происхождения.
 */
export default function BrandBlock({
  brand,
  onShowBrand,
}: {
  brand: Brand;
  onShowBrand: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const hasCountries = brand.countryOrigin || brand.countryMade;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-2xl bg-sky-50 px-3.5 py-2.5 text-[12.5px] font-black text-slate-800 ring-1 ring-sky-100">
        <ShieldCheck size={16} className="shrink-0 text-sky-500" />
        Оригинальные товары с гарантией
        <ChevronRight size={15} className="ml-auto shrink-0 text-slate-400" />
      </div>

      <div className="rounded-b-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 lg:p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-black tracking-tight text-slate-900">{brand.name}</span>
              {brand.info && (
                <button
                  onClick={() => setInfoOpen((o) => !o)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-black transition ${
                    infoOpen
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-slate-300 text-slate-400 hover:border-teal-500 hover:text-teal-600"
                  }`}
                  title="О бренде"
                >
                  i
                </button>
              )}
            </div>
            <button
              onClick={onShowBrand}
              className="mt-0.5 text-[12.5px] font-semibold text-slate-400 underline-offset-2 transition hover:text-teal-700 hover:underline"
            >
              Все товары бренда
            </button>
          </div>
          {brand.logo ? (
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-12 max-w-[45%] shrink-0 object-contain object-right"
            />
          ) : (
            <span className="shrink-0 text-[19px] font-black italic tracking-tight text-slate-800">
              {brand.name}
            </span>
          )}
        </div>

        {infoOpen && brand.info && (
          <p className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            {brand.info}
          </p>
        )}

        {hasCountries && (
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {brand.countryOrigin && (
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <span className="text-[16px] leading-none">{COUNTRY_FLAGS[brand.countryOrigin] ?? "🏳️"}</span>
                {brand.countryOrigin} — родина бренда
              </div>
            )}
            {brand.countryMade && (
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <span className="text-[16px] leading-none">{COUNTRY_FLAGS[brand.countryMade] ?? "🏳️"}</span>
                {brand.countryMade} — страна производства
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
