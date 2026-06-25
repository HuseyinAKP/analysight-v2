"use client";
import { useState, useEffect, useCallback } from "react";

const KEY = "analysight_notifications_v1";

export interface AppNotification {
  id: string;
  type: "alert" | "signal" | "news";
  symbol: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function load(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list: AppNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

const SAMPLE_NOTIFICATIONS: AppNotification[] = [
  {
    id: "demo-1",
    type: "signal",
    symbol: "THYAO",
    title: "THYAO — Güçlü Alım Sinyali",
    body: "RSI 32'ye geriledi, aşırı satım bölgesine girdi. Olası geri dönüş fırsatı.",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "demo-2",
    type: "alert",
    symbol: "GARAN",
    title: "GARAN — MACD Kesişimi",
    body: "MACD sinyal çizgisini yukarı kesti. Kısa vadeli yükseliş momentumu güçleniyor.",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "demo-3",
    type: "news",
    symbol: "AAPL",
    title: "AAPL — Önemli Haber",
    body: "Apple yeni ürün lansmanı açıkladı. Analistler olumlu beklenti içinde.",
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = load();
    if (stored.length === 0) {
      save(SAMPLE_NOTIFICATIONS);
      setNotifications(SAMPLE_NOTIFICATIONS);
    } else {
      setNotifications(stored);
    }
    setMounted(true);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      save(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      save(next);
      return next;
    });
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "created_at">) => {
    const newN: AppNotification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => {
      const next = [newN, ...prev];
      save(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    save([]);
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, addNotification, clearAll, mounted };
}
