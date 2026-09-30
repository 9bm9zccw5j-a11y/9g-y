export interface Product {
  id: number;
  name: string;
  price: number;
  /** Ключ бренда товара (см. Brand). Назначается в админ-панели. */
  brandId?: string;
  /** Старая цена до скидки. Показывается зачёркнутой, если она выше price. */
  oldPrice?: number;
  description: string;
  inStock: boolean;
  category: string;
  subcategory?: string;
  code: string;
  image?: string;
  /** Галерея изображений товара (dataURL или URL). */
  gallery?: string[];
  characteristics?: ProductCharacteristic[];
  /** Единица измерения: "шт" (по умолчанию) или "м" (за метр). */
  unit?: "шт" | "м";
  /** Минимальное количество метров для продажи (если unit === "м"). */
  minMeters?: number;
  /** Показывать в карточке строку «Гарантия производителя 12 месяцев».
   * Включается в админке только для технически сложных товаров. */
  warranty?: boolean;
}

export interface ProductCharacteristic {
  name: string;
  value: string;
}

/** Бренд товара. Создаётся и редактируется в админ-панели (вкладка «Бренды»). */
export interface Brand {
  key: string;
  name: string;
  /** Логотип бренда (dataURL или URL). */
  logo?: string;
  /** Страна — родина бренда (пишется в карточке товара). */
  countryOrigin?: string;
  /** Страна производства. */
  countryMade?: string;
  /** Краткая справка о бренде — открывается по иконке (i). */
  info?: string;
}

/** Флаги стран для карточки бренда. */
export const COUNTRY_FLAGS: Record<string, string> = {
  "Беларусь": "🇧🇾",
  "Германия": "🇩🇪",
  "Испания": "🇪🇸",
  "Италия": "🇮🇹",
  "Китай": "🇨🇳",
  "Корея": "🇰🇷",
  "Польша": "🇵🇱",
  "Россия": "🇷🇺",
  "Турция": "🇹🇷",
  "Финляндия": "🇫🇮",
  "Франция": "🇫🇷",
  "Чехия": "🇨🇿",
  "Швеция": "🇸🇪",
  "Япония": "🇯🇵",
};

export const COUNTRY_NAMES = Object.keys(COUNTRY_FLAGS);

/** Стартовый список брендов — дальше пополняется в админ-панели. */
export const DEFAULT_BRANDS: Brand[] = [
  {
    key: "ampm",
    name: "AM.PM",
    countryOrigin: "Германия",
    countryMade: "Германия",
    info: "Мебель и сантехника для ванной комнаты: смесители, душевые системы, аксессуары.",
  },
  {
    key: "belamos",
    name: "Belamos",
    countryOrigin: "Беларусь",
    countryMade: "Беларусь",
    info: "Скважинные, циркуляционные насосы и насосные станции для дома и участка.",
  },
  {
    key: "valtec",
    name: "Valtec",
    countryOrigin: "Италия",
    countryMade: "Италия",
    info: "Совместный российско-итальянский бренд трубной арматуры, фитинги и коллекторы.",
  },
];

export interface Subcategory {
  key: string;
  label: string;
  img?: string;
  /** Для старого каталога PPR: автоматическая привязка по части названия. */
  match?: string[];
}

export interface Category {
  key: string;
  label: string;
  img: string;
  subcategories?: Subcategory[];
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    key: "ppr",
    label: "PPR трубы и фитинги",
    img: "/images/cat-ppr.png",
    subcategories: [
      { key: "ppr-pipe", label: "PPR Труба", match: ["Труба"] },
      { key: "ppr-coupling", label: "PPR Муфта", match: ["Муфта"] },
      { key: "ppr-elbow", label: "PPR Уголок", match: ["Угольник", "Колено"] },
      { key: "ppr-union", label: "PPR Американка", match: ["Американка"] },
      { key: "ppr-valve", label: "PPR Кран", match: ["Кран"] },
      { key: "ppr-cross", label: "PPR Крестовина", match: ["Крестовина"] },
      { key: "ppr-cap", label: "PPR Заглушка", match: ["Заглушка"] },
    ],
  },
  { key: "Латунные Фитинги", label: "Латунь", img: "/images/cat-brass.png" },
  { key: "Краны и Вентили", label: "Краны", img: "/images/cat-valves.png" },
];

export const DEFAULT_PRODUCTS: Product[] = [];
