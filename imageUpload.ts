import { supabase } from "./supabase";

const MEDIA_BUCKET = "vodyanoy-media";

function safeName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base || "image"}.${ext}`;
}

async function uploadBlob(blob: Blob, filename: string): Promise<string> {
  try {
    const path = `uploads/${safeName(filename)}`;
    const upload = supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      cacheControl: "31536000",
      contentType: blob.type || undefined,
      upsert: false,
    });
    // Если Storage не настроен/недоступен, не оставляем UI висеть бесконечно.
    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("storage timeout")), 20000)
    );
    const { error } = await Promise.race([upload, timeout]);
    if (error) throw error;
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) throw new Error("Storage не вернул публичный URL");
    return data.publicUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Не удалось загрузить изображение в Supabase Storage: ${message}. ` +
        `Создайте публичный bucket vodyanoy-media и политики из SQL админ-панели.`
    );
  }
}

/** Загружает оригинальный файл в Supabase Storage. */
async function uploadOriginal(file: File): Promise<string> {
  return uploadBlob(file, file.name);
}

/**
 * Загружает любой медиафайл (картинку или аудио) в Storage.
 * Для аудиозаписей при недоступном Storage сохраняем data URL: WebP-оптимизация
 * применима только к изображениям.
 */
export async function mediaFileToUrl(file: File): Promise<string> {
  try {
    return await uploadOriginal(file);
  } catch (error) {
    if (file.type.startsWith("image/")) {
      return optimizedDataUrl(file, 1400);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось прочитать аудиофайл"));
      reader.readAsDataURL(file);
    });
  }
}

/** Резервная оптимизация, если Supabase Storage пока недоступен. */
function optimizedDataUrl(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = Math.min(1, maxDimension / side);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode"));
    };
    img.src = url;
  });
}

/** Переносит старое base64-изображение в Storage и возвращает URL. */
export async function uploadDataUrlToStorage(
  dataUrl: string,
  filename = "legacy-image.webp"
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return uploadBlob(blob, filename);
}

/**
 * Сохраняет оригинал в Supabase Storage. Base64 fallback намеренно отсутствует:
 * крупные строки ломают синхронизацию JSON каталога в Safari.
 */
export async function imageFileToDataUrl(
  file: File,
  maxDimension = 1400
): Promise<string> {
  try {
    return await uploadOriginal(file);
  } catch (error) {
    console.warn("Storage недоступен, используем WebP fallback:", error);
    return optimizedDataUrl(file, maxDimension);
  }
}
