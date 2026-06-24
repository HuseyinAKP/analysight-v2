"""
Ekonomik Takvim Servisi — Yüksek etkili makro olaylar.

Gerçek entegrasyon için: Trading Economics API, FRED, Investing.com scraper.
Şu an: Yapılandırılmış mock veri — gerçekçi tarihler ve beklentilerle.
"""
from __future__ import annotations
from datetime import datetime, timedelta, date
import random

# ── Sabit yüksek etkili olaylar ───────────────────────────────────────────────
# Her ay belirli günlerde tekrar eder — gerçekçi takvim simülasyonu
RECURRING_EVENTS = [
    # ABD
    {"country": "US", "flag": "🇺🇸", "name": "ABD CPI (Enflasyon)",     "abbr": "CPI",    "impact": "high",   "currency": "USD", "category": "inflation",   "frequency": "monthly", "day_of_month": 12, "hour": 14, "minute": 30,
     "description": "ABD'nin aylık tüketici fiyat endeksi. Fed'in faiz kararlarını doğrudan etkiler.",
     "market_impact": "Beklentinin üstünde CPI → Dolar güçlenir, hisse senetleri baskı altına girebilir. BIST'te yabancı çıkışı tetiklenebilir."},

    {"country": "US", "flag": "🇺🇸", "name": "Fed Faiz Kararı",          "abbr": "FED",    "impact": "high",   "currency": "USD", "category": "monetary",    "frequency": "6weekly", "day_of_month": 18, "hour": 21, "minute": 0,
     "description": "Fed'in politika faiz oranı kararı. Küresel piyasaların en önemli tek olayı.",
     "market_impact": "Faiz artışı → Dolar güçlenir, gelişen piyasalara baskı. Faiz indirimi → Risk iştahı artar, BIST ve kripto yükselir."},

    {"country": "US", "flag": "🇺🇸", "name": "ABD İstihdam (NFP)",       "abbr": "NFP",    "impact": "high",   "currency": "USD", "category": "employment",  "frequency": "monthly", "day_of_month": 7,  "hour": 15, "minute": 30,
     "description": "Tarım dışı istihdam değişimi. Fed politikasının ikinci temel göstergesi.",
     "market_impact": "Güçlü istihdam → Fed faizi düşürmez → Dolar güçlenir. Zayıf istihdam → Faiz indirim beklentisi artar."},

    {"country": "US", "flag": "🇺🇸", "name": "ABD PCE Enflasyonu",       "abbr": "PCE",    "impact": "high",   "currency": "USD", "category": "inflation",   "frequency": "monthly", "day_of_month": 28, "hour": 15, "minute": 30,
     "description": "Fed'in tercih ettiği enflasyon ölçütü. CPI'dan daha geniş kapsamlı.",
     "market_impact": "Fed'in %2 hedefine yakınlık değerlendirmesi. Yüksek gelirse faiz indirimi gecikir."},

    {"country": "US", "flag": "🇺🇸", "name": "ABD GDP (Büyüme)",         "abbr": "GDP",    "impact": "medium", "currency": "USD", "category": "growth",      "frequency": "quarterly","day_of_month": 25, "hour": 15, "minute": 30,
     "description": "ABD Gayri Safi Yurtiçi Hasılası — ekonominin genel sağlığı.",
     "market_impact": "Beklentinin üstünde büyüme → Risk iştahı artar. Negatif büyüme (resesyon sinyali) → Satış dalgası."},

    # TCMB / Türkiye
    {"country": "TR", "flag": "🇹🇷", "name": "TCMB Faiz Kararı",         "abbr": "TCMB",   "impact": "high",   "currency": "TRY", "category": "monetary",    "frequency": "monthly", "day_of_month": 20, "hour": 14, "minute": 0,
     "description": "Türkiye Cumhuriyet Merkez Bankası politika faiz kararı. BIST ve TRY'yi doğrudan etkiler.",
     "market_impact": "Faiz artışı → TRY güçlenebilir, bankacılık hisseleri karışık reaksiyon. İndirim → TRY baskı, BIST kısa vadede yükselebilir."},

    {"country": "TR", "flag": "🇹🇷", "name": "Türkiye TÜFE Enflasyonu",  "abbr": "TÜFE",   "impact": "high",   "currency": "TRY", "category": "inflation",   "frequency": "monthly", "day_of_month": 3,  "hour": 10, "minute": 0,
     "description": "Türkiye Tüketici Fiyat Endeksi. TCMB kararlarının temel girdisi.",
     "market_impact": "Yüksek TÜFE → TCMB faiz kesmesi zorlaşır → TRY baskısı devam eder. Düşen TÜFE → faiz indirimi yaklaştı beklentisi."},

    {"country": "TR", "flag": "🇹🇷", "name": "Türkiye Cari Açık",        "abbr": "CA",     "impact": "medium", "currency": "TRY", "category": "trade",       "frequency": "monthly", "day_of_month": 11, "hour": 10, "minute": 0,
     "description": "Aylık cari denge. TRY'nin uzun vadeli sürdürülebilirliğini gösterir.",
     "market_impact": "Yüksek cari açık → TRY üzerinde yapısal baskı. Turizm sezonu cari açığı kapatabilir."},

    {"country": "TR", "flag": "🇹🇷", "name": "Türkiye Büyüme (GDP)",     "abbr": "GDP-TR", "impact": "medium", "currency": "TRY", "category": "growth",      "frequency": "quarterly","day_of_month": 15, "hour": 10, "minute": 0,
     "description": "Türkiye ekonomik büyümesi. İç talep ve ihracat dinamiklerini yansıtır.",
     "market_impact": "Güçlü büyüme → BIST'e pozitif. Ancak yüksek büyüme enflasyonu körüklüyorsa TCMB faiz kesmez."},

    # Avrupa
    {"country": "EU", "flag": "🇪🇺", "name": "ECB Faiz Kararı",          "abbr": "ECB",    "impact": "high",   "currency": "EUR", "category": "monetary",    "frequency": "6weekly", "day_of_month": 16, "hour": 14, "minute": 15,
     "description": "Avrupa Merkez Bankası politika faiz kararı. Euro bölgesi faiz düzeyini belirler.",
     "market_impact": "Euro güçlenirse Türkiye'nin ihracat rekabeti zorlaşır. EUR/TRY paritesi değişir."},

    {"country": "EU", "flag": "🇪🇺", "name": "Euro Bölgesi CPI",         "abbr": "EU-CPI", "impact": "medium", "currency": "EUR", "category": "inflation",   "frequency": "monthly", "day_of_month": 19, "hour": 11, "minute": 0,
     "description": "Euro bölgesi tüketici fiyat endeksi. ECB kararlarını şekillendirir.",
     "market_impact": "Yüksek AB enflasyonu → ECB faiz yüksek tutar → Euro güçlenir."},

    # Çin
    {"country": "CN", "flag": "🇨🇳", "name": "Çin Büyüme (GDP)",         "abbr": "CN-GDP", "impact": "high",   "currency": "CNY", "category": "growth",      "frequency": "quarterly","day_of_month": 18, "hour": 4,  "minute": 0,
     "description": "Çin ekonomik büyüme verisi. Küresel emtia talebi ve gelişen piyasalar için kritik.",
     "market_impact": "Güçlü Çin büyümesi → Emtia fiyatları yükselir → EREGL, TUPRS gibi hisseler olumlu etkilenebilir."},

    {"country": "CN", "flag": "🇨🇳", "name": "Çin Üretim PMI",           "abbr": "CN-PMI", "impact": "medium", "currency": "CNY", "category": "manufacturing","frequency": "monthly", "day_of_month": 1,  "hour": 3,  "minute": 0,
     "description": "Çin imalat sektörü aktivite endeksi. 50 üstü genişleme, altı daralma.",
     "market_impact": "PMI > 50 → Çin talebi güçlü → Demir-çelik, petrokimya hisseleri olumlu."},
]

# ── Sektör bazlı BIST etki haritası ──────────────────────────────────────────
SECTOR_IMPACT: dict[str, dict[str, str]] = {
    "inflation": {
        "Bankacılık":   "Faiz marjı artar, ancak kredi kalitesi baskı altına girebilir",
        "Enerji":       "Maliyet artışı, ürün fiyatlarına yansıtma kapasitesi belirleyici",
        "Perakende":    "Tüketici harcamaları kısılabilir, hammadde maliyeti artar",
        "İnşaat":       "Konut talebi azalabilir, proje maliyetleri artar",
        "Savunma":      "Genellikle sınırlı etki, devlet sözleşmeleri koruma sağlar",
    },
    "monetary": {
        "Bankacılık":   "Doğrudan etkilenir — net faiz marjı ve kredi büyümesi değişir",
        "GYO":          "Faiz artışı kira getirisi cazibesini düşürür",
        "Teknoloji":    "Yüksek faiz büyüme hisselerini baskılar",
        "Savunma":      "Görece savunmacı, faiz değişiminden az etkilenir",
    },
    "employment": {
        "Teknoloji":    "ABD güçlü istihdam → dolar güçlenir → TL baskı",
        "İhracat":      "Güçlü ABD tüketimi Türk ihracatçılara pozitif",
    },
    "growth": {
        "Emtia":        "Küresel büyüme emtia talebini artırır (demir, çelik, petrol)",
        "İhracat":      "Güçlü küresel büyüme ihracat hacmini artırır",
    },
}


def _days_until_event(event: dict, reference: date) -> int:
    """Bir sonraki oluşum gününü hesapla."""
    dom = event.get("day_of_month", 15)
    candidate = reference.replace(day=min(dom, 28))
    if candidate <= reference:
        # Gelecek ay
        if reference.month == 12:
            candidate = candidate.replace(year=reference.year + 1, month=1)
        else:
            candidate = candidate.replace(month=reference.month + 1)
    return (candidate - reference).days


def get_calendar(days_ahead: int = 30) -> dict:
    today = date.today()
    events = []

    for ev in RECURRING_EVENTS:
        dom = ev.get("day_of_month", 15)
        # Bu ay ve gelecek ay için kontrol et
        for month_offset in range(0, 3):
            m = today.month + month_offset
            y = today.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            try:
                event_date = date(y, m, min(dom, 28))
            except ValueError:
                continue

            delta = (event_date - today).days
            if 0 <= delta <= days_ahead:
                event_time = datetime(y, m, event_date.day, ev.get("hour", 12), ev.get("minute", 0))
                # Mock beklenti değerleri
                random.seed(hash(f"{ev['abbr']}{y}{m}") % 2**31)
                forecast = round(random.uniform(1.5, 4.5), 1)
                previous = round(forecast + random.uniform(-0.5, 0.5), 1)
                actual = None
                if delta == 0 and ev.get("hour", 12) < datetime.now().hour:
                    actual = round(forecast + random.uniform(-0.3, 0.3), 1)

                events.append({
                    "id": f"{ev['abbr']}_{y}{m:02d}",
                    "name": ev["name"],
                    "abbr": ev["abbr"],
                    "country": ev["country"],
                    "flag": ev["flag"],
                    "impact": ev["impact"],
                    "currency": ev["currency"],
                    "category": ev["category"],
                    "date": event_date.isoformat(),
                    "datetime": event_time.strftime("%Y-%m-%dT%H:%M:00"),
                    "time_tr": event_time.strftime("%H:%M"),
                    "days_until": delta,
                    "is_today": delta == 0,
                    "forecast": f"{forecast}%",
                    "previous": f"{previous}%",
                    "actual": f"{actual}%" if actual is not None else None,
                    "description": ev["description"],
                    "market_impact": ev["market_impact"],
                    "sector_impacts": SECTOR_IMPACT.get(ev["category"], {}),
                })
                break  # Her event için sadece en yakın tarih

    # Tarihe göre sırala
    events.sort(key=lambda e: e["datetime"])

    # Özet istatistikler
    high_count   = sum(1 for e in events if e["impact"] == "high")
    today_events = [e for e in events if e["is_today"]]

    return {
        "events": events,
        "total": len(events),
        "high_impact_count": high_count,
        "today_count": len(today_events),
        "period_days": days_ahead,
        "generated_at": datetime.now().isoformat(),
    }


def get_event_ai_context(event_abbr: str) -> dict:
    """Belirli bir olay için bağlam döner — Claude analizi için."""
    for ev in RECURRING_EVENTS:
        if ev["abbr"] == event_abbr:
            return {
                "name": ev["name"],
                "description": ev["description"],
                "market_impact": ev["market_impact"],
                "sector_impacts": SECTOR_IMPACT.get(ev["category"], {}),
                "category": ev["category"],
            }
    return {}
