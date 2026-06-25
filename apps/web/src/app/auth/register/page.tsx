"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, TrendingUp } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mb-2">E-postanı kontrol et</h2>
          <p className="text-zinc-400 text-sm">
            <strong>{email}</strong> adresine doğrulama linki gönderdik. Linke tıklayarak hesabını aktifleştir.
          </p>
          <Link href="/auth/login" className="inline-block mt-6 text-blue-400 hover:text-blue-300 text-sm">
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-7 h-7 text-blue-400" />
            <span className="text-xl font-bold text-zinc-100">Analysight</span>
          </div>
          <p className="text-zinc-400 text-sm">Ücretsiz hesap oluştur</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ornek@email.com"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="En az 6 karakter"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Zaten hesabın var mı?{" "}
          <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}
