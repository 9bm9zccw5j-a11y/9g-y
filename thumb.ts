import type { Product } from "../data/catalog";

/**
 * Превью товара: первое фото галереи, затем главное изображение,
 * затем картинка категории как запасной вариант.
 */
export function productThumb(p: Pick<Product, "image" | "gallery" | "category">): string {
  return (
    p.gallery?.[0] ||
    p.image ||
    (p.category === "Краны и Вентили"
      ? "/images/cat-valves.png"
      : p.category === "Латунные Фитинги"
        ? "/images/cat-brass.png"
        : "/images/cat-ppr.png")
  );
}
