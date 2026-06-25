import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Sen Analysight platformunun finansal analiz asistanısın.
Türkçe, sade ve aksiyon alınabilir yanıtlar verirsin.
Kesinlikle "al" veya "sat" tavsiyesi vermezsin — sadece veriyi yorumlarsın.
Yanıtların kısa (2-4 cümle), net ve kullanıcıyı yönlendirici olmalıdır.
Her zaman "bu yatırım tavsiyesi değildir" notunu eklemeyi unutma.`;

export async function POST(req: NextRequest) {
  try {
    const { symbol, message, context, history } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "Yapay zeka asistanı şu an aktif değil. API anahtarı gereklidir. (.env dosyasına ANTHROPIC_API_KEY ekleyin)",
      });
    }

    const contextStr = context ? `\n\nMevcut analiz verisi:\n${JSON.stringify(context, null, 2)}` : "";
    const systemMsg  = SYSTEM_PROMPT + `\n\nKullanıcı şu anda ${symbol} sembolünü inceliyor.` + contextStr;

    const messages = [
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 400,
        system: systemMsg,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ reply: "Yanıt üretilemedi. Lütfen tekrar deneyin." });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "Yanıt alınamadı.";
    return NextResponse.json({ reply });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ reply: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
