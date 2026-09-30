export interface MediaItem {
  id: string;
  name: string;
  dataUrl: string;
  sizeKB: number;
  createdAt: string;
  /** Необязательная метка для новых файлов. Старые записи определяются по расширению. */
  kind?: "image" | "audio";
}

import { useEffect, useState } from "react";
import { cloudSync } from "../utils/cloudSync";

export function useMediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");

  useEffect(() => {
    let active = true;
    (async () => {
      setSyncStatus("syncing");
      const cloud = await cloudSync.getMedia();
      if (!active) return;
      if (cloud === undefined) {
        setSyncStatus("error");
      } else if (cloud && cloud.length >= 0) {
        setItems(cloud);
        setSyncStatus("synced");
      } else {
        setSyncStatus("synced");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Экземпляры хука используются и в «Медиа», и во вкладке «Заказы».
  // Событие позволяет сразу увидеть загруженную запись без обновления страницы.
  useEffect(() => {
    const onMediaUpdate = (event: Event) => {
      const next = (event as CustomEvent<MediaItem[]>).detail;
      if (Array.isArray(next)) {
        setItems(next);
        setSyncStatus("synced");
      }
    };
    window.addEventListener("vodyanoy-media-updated", onMediaUpdate);
    return () => window.removeEventListener("vodyanoy-media-updated", onMediaUpdate);
  }, []);

  const save = async (next: MediaItem[]) => {
    setItems(next);
    setSyncStatus("syncing");
    const ok = await cloudSync.saveMedia(next);
    setSyncStatus(ok ? "synced" : "error");
    window.dispatchEvent(new CustomEvent("vodyanoy-media-updated", { detail: next }));
  };

  const addItems = (newItems: MediaItem[]) => save([...newItems, ...items]);
  const deleteItem = (id: string) => save(items.filter((i) => i.id !== id));
  const clearAll = () => save([]);

  return { items, addItems, deleteItem, clearAll, syncStatus };
}
