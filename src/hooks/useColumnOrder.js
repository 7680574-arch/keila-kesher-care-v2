import { useState, useEffect } from "react";

export function useColumnOrder(storageKey, defaultOrder) {
  const [order, setOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return defaultOrder;
  });

  const [hidden, setHidden] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}__hidden`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch {}
  }, [order, storageKey]);

  useEffect(() => {
    try { localStorage.setItem(`${storageKey}__hidden`, JSON.stringify(hidden)); } catch {}
  }, [hidden, storageKey]);

  return [order, setOrder, hidden, setHidden];
}