import { useEffect, useState } from "react";
import { DEFAULT_PRODUCTS, type Product } from "../data/catalog";
import { cloudSync } from "../utils/cloudSync";

const STORAGE_KEY = "vodyanoy_products_v1";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => {
    // Стартуем с локального кэша, чтобы витрина не была пустой, пока грузится облако.
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch { /* игнорируем */ }
    return DEFAULT_PRODUCTS;
  });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloud = await cloudSync.getProducts();
        if (cancelled) return;

        if (cloud === undefined) {
          // Облако недоступно — оставляем то, что уже в стейте (из кэша).
          setSyncStatus("error");
        } else if (cloud && cloud.length > 0) {
          setProducts(cloud);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
          setSyncStatus("synced");
        } else {
          // Облако пусто — если есть локальные данные, пишем их в облако как seed.
          // Если нет, остаёмся с DEFAULT_PRODUCTS (который может быть пустым).
          const local = products; // замыкание на текущий стейт
          if (local.length > 0) {
            cloudSync.saveProducts(local).then((ok) => {
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

  const save = async (next: Product[]) => {
    setProducts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSyncStatus("syncing");
    const ok = await cloudSync.saveProducts(next);
    setSyncStatus(ok ? "synced" : "error");
  };

  const updateProduct = (id: number, patch: Partial<Product>) =>
    save(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addProduct = (p: Omit<Product, "id">) => {
    const nextId = Math.max(0, ...products.map((x) => x.id)) + 1;
    save([...products, { ...p, id: nextId }]);
  };

  const deleteProduct = (id: number) => save(products.filter((p) => p.id !== id));

  const swapProducts = (idA: number, idB: number) => {
    const idxA = products.findIndex((p) => p.id === idA);
    const idxB = products.findIndex((p) => p.id === idB);
    if (idxA === -1 || idxB === -1) return;
    const next = [...products];
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    save(next);
  };

  const resetCatalog = () => save(DEFAULT_PRODUCTS.map((p) => ({ ...p })));

  const refreshProducts = async () => {
    const cloud = await cloudSync.getProducts();
    if (cloud === undefined) {
      setSyncStatus("error");
      return false;
    }
    if (cloud && cloud.length > 0) {
      setProducts(cloud);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
      setSyncStatus("synced");
      return true;
    }
    return false;
  };

  return {
    products,
    updateProduct,
    addProduct,
    deleteProduct,
    swapProducts,
    resetCatalog,
    refreshProducts,
    productsLoading: loading,
    productsSyncStatus: syncStatus,
  };
}
