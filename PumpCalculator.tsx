import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calculator, Droplets, RotateCcw, CheckCircle2 } from "lucide-react";

export interface PumpModel {
  name: string;
  maxHead: number; // м
  flow: number; // м³/ч (номинальный)
  power: number; // Вт
  price: number;
  cable: number; // м кабеля в комплекте
}

/** Линейка скважинных насосов Belamos TF3 (Ø 3", диаметр корпуса 78 мм) */
export const TF3_MODELS: PumpModel[] = [
  { name: "Belamos TF3-40", maxHead: 43, flow: 2.7, power: 400, price: 11900, cable: 20 },
  { name: "Belamos TF3-60", maxHead: 65, flow: 2.7, power: 550, price: 14900, cable: 25 },
  { name: "Belamos TF3-80", maxHead: 87, flow: 2.7, power: 750, price: 17500, cable: 35 },
  { name: "Belamos TF3-110", maxHead: 116, flow: 2.7, power: 1000, price: 21900, cable: 40 },
];

/** Удельные потери напора, м на 1 м трубы при ~2.7 м³/ч */
const PIPE_LOSS: Record<string, number> = { "25": 0.075, "32": 0.022, "40": 0.008 };

type FieldKey = "dynamicLevel" | "wellDepth" | "horizontal" | "riseAbove" | "pressure";

interface Field {
  key: FieldKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

interface Inputs {
  dynamicLevel: number;
  wellDepth: number;
  horizontal: number;
  riseAbove: number;
  pressure: number;
  pipe: "25" | "32" | "40";
}

const FIELDS: Field[] = [
  { key: "dynamicLevel", label: "Динамический уровень воды", hint: "глубина зеркала воды при работе насоса", min: 5, max: 150, step: 1, unit: "м" },
  { key: "wellDepth", label: "Глубина скважины", hint: "общая глубина от устья до дна", min: 10, max: 200, step: 1, unit: "м" },
  { key: "horizontal", label: "Горизонтальный участок", hint: "длина трубы от скважины до дома", min: 0, max: 200, step: 1, unit: "м" },
  { key: "riseAbove", label: "Подъём над землёй", hint: "высота до верхней точки разбора", min: 0, max: 30, step: 1, unit: "м" },
  { key: "pressure", label: "Рабочее давление", hint: "нужное давление в системе", min: 1, max: 6, step: 0.5, unit: "бар" },
];

const DEFAULTS: Inputs = {
  dynamicLevel: 35,
  wellDepth: 50,
  horizontal: 20,
  riseAbove: 6,
  pressure: 2.5,
  pipe: "32",
};

export default function PumpCalculator({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick?: (m: PumpModel, head: number) => void;
}) {
  const [v, setV] = useState<Inputs>(DEFAULTS);

  const result = useMemo(() => {
    const geo = v.dynamicLevel + v.riseAbove;
    const pipeLen = v.dynamicLevel + v.riseAbove + v.horizontal;
    const friction = pipeLen * PIPE_LOSS[v.pipe] * 1.2;
    const press = v.pressure * 10.2;
    const required = geo + friction + press;
    const withMargin = required * 1.1;

    const model = TF3_MODELS.find((m) => m.maxHead >= withMargin) ?? null;
    const submersion = Math.max(0, v.wellDepth - v.dynamicLevel);

    const r = (x: number) => Math.round(x * 10) / 10;
    return {
      geo: r(geo),
      friction: r(friction),
      press: r(press),
      required: Math.round(required),
      withMargin: Math.round(withMargin),
      model,
      submersion: Math.round(submersion),
      cableOk: model ? model.cable >= v.dynamicLevel + 3 : false,
      depthWarn: v.dynamicLevel >= v.wellDepth,
    };
  }, [v]);

  const set = (k: keyof Inputs, val: number | string) => setV((p) => ({ ...p, [k]: val }) as Inputs);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/45 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 z-50 flex max-h-[93%] flex-col overflow-hidden rounded-t-[28px] bg-[#f6f9fb]"
          >
            <div className="shrink-0 bg-gradient-to-r from-[#123a5c] to-teal-600 px-5 pb-4 pt-3 text-white">
              <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/30" />
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/15 p-2">
                  <Calculator size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-black leading-tight">Калькулятор подбора насоса</h2>
                  <p className="text-[12px] font-medium text-white/70">
                    Скважинные насосы Belamos TF3 · Ø 78 мм
                  </p>
                </div>
                <button onClick={onClose} className="rounded-lg p-1 active:scale-90">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {FIELDS.map((f) => (
                  <div
                    key={f.key}
                    className="rounded-2xl bg-white p-3.5 shadow-[0_2px_12px_rgba(15,60,70,0.06)]"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13.5px] font-bold text-slate-700">{f.label}</span>
                      <span className="ml-auto shrink-0 rounded-lg bg-teal-50 px-2.5 py-1 text-[14px] font-black tabular-nums text-teal-700">
                        {v[f.key]} {f.unit}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{f.hint}</p>
                    <input
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={v[f.key]}
                      onChange={(e) => set(f.key, Number(e.target.value))}
                      className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600"
                    />
                  </div>
                ))}

                <div className="rounded-2xl bg-white p-3.5 shadow-[0_2px_12px_rgba(15,60,70,0.06)]">
                  <span className="text-[13.5px] font-bold text-slate-700">Диаметр трубы</span>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {(["25", "32", "40"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => set("pipe", d)}
                        className={`rounded-xl py-2.5 text-[14px] font-bold transition active:scale-95 ${
                          v.pipe === d
                            ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {d} мм
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {result.depthWarn && (
                <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-[12.5px] font-semibold text-amber-700">
                  Динамический уровень не может быть глубже самой скважины — скорректируйте значения.
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_4px_20px_rgba(15,60,70,0.10)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-400">
                    Расчёт напора
                  </h3>
                  <div className="mt-2 space-y-1.5 text-[13px]">
                    {[
                      ["Геометрический подъём", `${result.geo} м`],
                      ["Потери в трубе и фитингах", `${result.friction} м`],
                      [`Давление ${v.pressure} бар`, `${result.press} м`],
                    ].map(([a, b]) => (
                      <div key={a} className="flex text-slate-500">
                        <span>{a}</span>
                        <span className="ml-auto font-bold text-slate-700">{b}</span>
                      </div>
                    ))}
                    <div className="flex border-t border-dashed border-slate-200 pt-2 text-slate-600">
                      <span className="font-bold">Требуемый напор</span>
                      <span className="ml-auto font-black text-[#123a5c]">{result.required} м</span>
                    </div>
                    <div className="flex text-slate-600">
                      <span className="font-bold">С запасом 10%</span>
                      <span className="ml-auto font-black text-teal-700">{result.withMargin} м</span>
                    </div>
                  </div>
                </div>

                {result.model ? (
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
                      <CheckCircle2 size={14} /> Рекомендуемая модель
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 p-3.5">
                      <div className="rounded-xl bg-white p-2.5 shadow-sm">
                        <Droplets size={26} className="text-teal-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-black leading-tight text-[#123a5c]">
                          {result.model.name}
                        </div>
                        <div className="mt-0.5 text-[12px] font-semibold text-slate-500">
                          Напор до {result.model.maxHead} м · {result.model.flow} м³/ч ·{" "}
                          {result.model.power} Вт
                        </div>
                        <div className="mt-1 text-[17px] font-black text-teal-700">
                          {result.model.price.toLocaleString("ru-RU")} ₽
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-1 text-[12px] text-slate-500">
                      <p>
                        • Глубина погружения насоса: рекомендуется на{" "}
                        <b className="text-slate-700">
                          {Math.max(2, Math.min(result.submersion - 2, 5))} м
                        </b>{" "}
                        ниже динамического уровня, но не менее 1 м от дна.
                      </p>
                      <p>
                        • Кабель в комплекте: <b className="text-slate-700">{result.model.cable} м</b>
                        {!result.cableOk && <span className="text-amber-600"> — потребуется удлинение</span>}
                      </p>
                      <p>
                        • Труба ПНД <b className="text-slate-700">{v.pipe} мм</b>, длина трассы ≈{" "}
                        <b className="text-slate-700">
                          {Math.round(v.dynamicLevel + v.riseAbove + v.horizontal)} м
                        </b>
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setV(DEFAULTS)}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 py-3 text-[13px] font-bold text-slate-600 active:scale-95"
                      >
                        <RotateCcw size={15} /> Сброс
                      </button>
                      <button
                        onClick={() => {
                          onPick?.(result.model!, result.withMargin);
                          onClose();
                        }}
                        className="flex-1 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3 text-[14px] font-black text-white shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                      >
                        Обсудить в чате
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-[13px] font-semibold text-amber-700">
                    Требуемый напор {result.withMargin} м превышает возможности линейки TF3 (макс.{" "}
                    {TF3_MODELS[TF3_MODELS.length - 1].maxHead} м). Рассмотрите насосы большей
                    мощности или снизьте требования по давлению.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(15,60,70,0.06)]">
                <h3 className="mb-2.5 text-[13px] font-black uppercase tracking-wider text-slate-400">
                  Вся линейка Belamos TF3
                </h3>
                <div className="space-y-1">
                  {TF3_MODELS.map((m) => {
                    const active = result.model?.name === m.name;
                    return (
                      <div
                        key={m.name}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] ${
                          active ? "bg-teal-50 ring-1 ring-teal-200" : "bg-slate-50"
                        }`}
                      >
                        <span className={`font-bold ${active ? "text-teal-700" : "text-slate-600"}`}>
                          {m.name}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400">{m.maxHead} м</span>
                        <span className="ml-auto font-black text-slate-700">
                          {m.price.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-3 px-1 text-center text-[11px] leading-relaxed text-slate-400">
                Расчёт носит рекомендательный характер. Для точного подбора уточните дебит скважины и
                паспортные данные.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
