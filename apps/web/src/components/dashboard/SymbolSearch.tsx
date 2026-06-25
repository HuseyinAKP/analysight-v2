"use client";
import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { symbolsApi } from "@/lib/api";

export function SymbolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string; market: string }>>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await symbolsApi.search(query);
        setResults(data.slice(0, 6));
        setOpen(true);
      } catch { setResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(symbol: string) {
    setQuery("");
    setOpen(false);
    router.push(`/symbol/${symbol}`);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg px-3 gap-2 focus-within:border-blue-500 transition-colors">
        <Search className="w-4 h-4 text-gray-500 shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Sembol ara... (THYAO, AAPL, BTC)"
          className="bg-transparent py-2 text-sm w-full outline-none placeholder:text-gray-500"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(r => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol)}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-800 flex items-center justify-between group"
            >
              <span className="font-mono font-semibold text-white text-sm">{r.symbol}</span>
              <span className="text-xs text-gray-400 group-hover:text-gray-300">{r.name}</span>
              <span className="text-xs text-gray-600 ml-2">{r.market}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
