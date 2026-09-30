import { useCallback, useEffect, useState } from "react";

/**
 * Небольшой роутер на History API без дополнительной библиотеки.
 * Работает с кнопками браузера «Назад/Вперёд» и сохраняет читаемые ссылки.
 */
function readPath() {
  const path = window.location.pathname || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

export function useAppRoute() {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const onPopState = () => setPath(readPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    const next = to.startsWith("/") ? to : `/${to}`;
    if (next === readPath()) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
    setPath(next);
  }, []);

  return { path, navigate };
}

export const routePart = (value: string) => encodeURIComponent(value);
export const unroutePart = (value?: string) => {
  try {
    return value ? decodeURIComponent(value) : undefined;
  } catch {
    return value;
  }
};