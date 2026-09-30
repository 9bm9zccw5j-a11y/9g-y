import { useCallback, useEffect, useState } from "react";
import { cloudSync } from "../utils/cloudSync";

export interface PlumberReview {
  id: string;
  authorName: string;
  authorPhone: string;
  rating: number; // 1-5
  text: string;
  /** Фото выполненной работы */
  photos?: string[];
  createdAt: string;
}

export interface Plumber {
  id: string;
  firstName: string;
  lastName: string;
  photo?: string;
  description: string;
  phone: string;
  specialties?: string[];
  reviews?: PlumberReview[];
  rating?: number; // средний рейтинг
}

export function usePlumbers() {
  const [plumbers, setPlumbers] = useState<Plumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  const refreshPlumbers = useCallback(async () => {
    const cloud = await cloudSync.getPlumbers();
    if (cloud === undefined) {
      setSyncStatus("error");
      return false;
    }
    if (cloud && cloud.length > 0) {
      setPlumbers(cloud);
      setSyncStatus("synced");
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setSyncStatus("syncing");
      const cloud = await cloudSync.getPlumbers();
      if (!active) return;
      if (cloud === undefined) {
        setSyncStatus("error");
      } else if (cloud && cloud.length > 0) {
        setPlumbers(cloud);
        setSyncStatus("synced");
      } else {
        const ok = await cloudSync.savePlumbers([]);
        setSyncStatus(ok ? "synced" : "error");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async (next: Plumber[]) => {
    setPlumbers(next);
    setSyncStatus("syncing");
    const ok = await cloudSync.savePlumbers(next);
    setSyncStatus(ok ? "synced" : "error");
  };

  const addPlumber = (plumber: Omit<Plumber, "id">) =>
    save([...plumbers, { ...plumber, id: `p${Date.now()}` }]);

  const updatePlumber = (id: string, patch: Partial<Plumber>) =>
    save(plumbers.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const deletePlumber = (id: string) => save(plumbers.filter((p) => p.id !== id));

  const addReview = (plumberId: string, review: Omit<PlumberReview, "id" | "createdAt">) =>
    save(
      plumbers.map((p) =>
        p.id === plumberId
          ? {
              ...p,
              reviews: [
                ...(p.reviews ?? []),
                {
                  ...review,
                  id: `r${Date.now()}`,
                  createdAt: new Date().toLocaleDateString("ru-RU"),
                },
              ],
            }
          : p
      )
    );

  const deleteReview = (plumberId: string, reviewId: string) =>
    save(
      plumbers.map((p) =>
        p.id === plumberId
          ? { ...p, reviews: (p.reviews ?? []).filter((r) => r.id !== reviewId) }
          : p
      )
    );

  return {
    plumbers,
    loading,
    syncStatus,
    refreshPlumbers,
    addPlumber,
    updatePlumber,
    deletePlumber,
    addReview,
    deleteReview,
  };
}
