import { useEffect, useState } from "react";
import { DEFAULT_BRANDS, type Brand } from "../data/catalog";
import { cloudSync } from "../utils/cloudSync";

const STORAGE_KEY = "vodyanoy_brands_v1";

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>(() => {
    // Локальный кэш — чтобы карточка товара сразу знала бренд, пока грузится облако.
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(cached)) return cached;
    } catch {
      /* игнорируем */
    }
    return DEFAULT_BRANDS;
  });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloud = await cloudSync.getBrands();
        if (cancelled) return;
        if (cloud === undefined) {
          setSyncStatus("error");
        } else if (cloud && cloud.length > 0) {
          setBrands(cloud);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
          setSyncStatus("synced");
        } else {
          // Облако пустое — засеваем список стартовыми брендами.
          setBrands(DEFAULT_BRANDS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BRANDS));
          cloudSync.saveBrands(DEFAULT_BRANDS).then((ok) => {
            if (!cancelled) setSyncStatus(ok ? "synced" : "error");
          });
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled) setSyncStatus("error");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Экземпляры хука живут и в витрине, и в админ-панели — событие синхронизирует их сразу.
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const next = (event as CustomEvent<Brand[]>).detail;
      if (Array.isArray(next)) {
        setBrands(next);
        setSyncStatus("synced");
      }
    };
    window.addEventListener("vodyanoy-brands-updated", onUpdate);
    return () => window.removeEventListener("vodyanoy-brands-updated", onUpdate);
  }, []);

  const save = async (next: Brand[]) => {
    setBrands(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("vodyanoy-brands-updated", { detail: next }));
    setSyncStatus("syncing");
    const ok = await cloudSync.saveBrands(next);
    setSyncStatus(ok ? "synced" : "error");
  };

  const addBrand = (b: Brand) => save([...brands.filter((x) => x.key !== b.key), b]);
  const updateBrand = (key: string, patch: Partial<Brand>) =>
    save(brands.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const deleteBrand = (key: string) => save(brands.filter((x) => x.key !== key));

  return { brands, loading, syncStatus, addBrand, updateBrand, deleteBrand };
}
