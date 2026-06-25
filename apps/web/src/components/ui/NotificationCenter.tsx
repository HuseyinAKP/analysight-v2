"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Zap, AlertTriangle, Newspaper, X } from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

function NotifIcon({ type }: { type: AppNotification["type"] }) {
  if (type === "signal") return <Zap className="w-4 h-4 text-yellow-400" />;
  if (type === "alert") return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <Newspaper className="w-4 h-4 text-blue-400" />;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, clearAll, mounted } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) return null;

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
        aria-label="Bildirimler"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-white">Bildirimler</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-zinc-400 hover:text-blue-400 transition-colors"
                >
                  Tümünü Okundu İşaretle
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-zinc-700" />
                <p className="text-xs text-zinc-500">
                  Henüz bildirim yok. Hisse takip et, sinyal gelince burada görünür.
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/60 border-b border-zinc-800/50",
                    !n.read && "border-l-2 border-l-blue-500 pl-[14px]"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-white truncate">{n.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">{n.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-mono">
                        {n.symbol}
                      </span>
                      <span className="text-[10px] text-zinc-600">{timeAgo(n.created_at)}</span>
                      {!n.read && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-zinc-800">
              <button
                onClick={clearAll}
                className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
              >
                Tümünü Temizle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
