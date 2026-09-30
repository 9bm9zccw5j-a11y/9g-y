import { useEffect, useState } from "react";
import { DEFAULT_CATEGORIES, type Category } from "../data/catalog";
import { cloudSync } from "../utils/cloudSync";

const STORAGE_KEY = "vodyanoy_categories_v1";

/** Объединяет список, сохраняя порядок source; недостающие дефолтные — в конец. */
function merge(source: Category[]): Category[] {
  if (!source || source.length === 0) {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  const defaultsByKey = new Map(DEFAULT_CATEGORIES.map((d) => [d.key, d]));
  const seen = new Set<string>();
  const result: Category[] = [];
  for (const c of source) {
    if (!c || !c.key || seen.has(c.key)) continue;
    seen.add(c.key);
    const d = defaultsByKey.get(c.key);
    result.push(d ? { ...d, ...c, key: c.key } : { ...c });
  }
  return result;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(() => {
    // Стартуем с локального кэша, чтобы плитки категорий были видны сразу.
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(cached) && cached.length > 0) return merge(cached);
    } catch { /* игнорируем */ }
    return DEFAULT_CATEGORIES;
  });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloud = await cloudSync.getCategories();
        if (cancelled) return;

        if (cloud === undefined) {
          setSyncStatus("error");
        } else if (cloud && cloud.length > 0) {
          const m = merge(cloud);
          setCategories(m);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
          setSyncStatus("synced");
        } else {
          // Облако пусто — пишем текущие (из кэша) как seed.
          const local = categories;
          if (local.length > 0) {
            cloudSync.saveCategories(local).then((ok) => {
              if (!cancelled) setSyncStatus(ok ? "synced" : "error");
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
          }
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled) setSyncStatus("error");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (next: Category[]) => {
    setCategories(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSyncStatus("syncing");
    const ok = await cloudSync.saveCategories(next);
    setSyncStatus(ok ? "synced" : "error");
  };

  const updateCategory = (key: string, patch: Partial<Category>) =>
    save(categories.map((c) => (c.key === key ? { ...c, ...patch, key: c.key } : c)));

  const addCategory = (category: Category) => save([...categories, category]);

  const deleteCategory = (key: string) => save(categories.filter((c) => c.key !== key));

  const moveCategory = (key: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.key === key);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[idx], next[target]] = [next[target], next[idx]];
    save(next);
  };

  const resetCategories = () => save(DEFAULT_CATEGORIES.map((c) => ({ ...c })));

  const refreshCategories = async () => {
    const cloud = await cloudSync.getCategories();
    if (cloud === undefined) {
      setSyncStatus("error");
      return false;
    }
    if (cloud && cloud.length > 0) {
      const m = merge(cloud);
      setCategories(m);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
      setSyncStatus("synced");
      return true;
    }
    return false;
  };

  return {
    categories,
    updateCategory,
    addCategory,
    deleteCategory,
    moveCategory,
    resetCategories,
    refreshCategories,
    categoriesLoading: loading,
    categoriesSyncStatus: syncStatus,
  };
}
export type { Category };
