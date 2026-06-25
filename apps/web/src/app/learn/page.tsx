"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronDown, ChevronUp, TrendingUp, BarChart2, Shield, Brain, Coins, Target } from "lucide-react";

// ── Content ───────────────────────────────────────────────────────────────────
interface Article {
  id: string;
  title: string;
  summary: string;
  readTime: string;
  level: "Başlangıç" | "Orta" | "İleri";
  content: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  articles: Article[];
}

const CATEGORIES: Category[] = [
  {
    id: "basics",
    label: "Borsa 101",
    icon: BookOpen,
    color: "blue",
    articles: [
      {
        id: "what-is-stock",
        title: "Hisse Senedi Nedir? Neden Alınır?",
        summary: "Hisse senedi almak bir şirketin ortağı olmak demektir. Peki bu sizi nasıl zengin edebilir?",
        readTime: "3 dk",
        level: "Başlangıç",
        content: `**Hisse Senedi Nedir?**

Bir şirkete para yatırdığınızda o şirketin küçük bir parçasına sahip olursunuz. Buna hisse senedi denir.

Örnek: Şirketin toplam değeri 1 milyon TL ise ve siz 1.000 TL yatırırsanız, şirketin binde birine sahip olursunuz.

**Neden Değeri Artar?**

Şirket para kazandıkça, büyüdükçe veya gelecek beklentileri iyileştikçe hisse fiyatı yükselir. Siz de bu değer artışından pay alırsınız.

**Temettü Nedir?**

Bazı şirketler yılda bir veya iki kez kârlarını hissedarlarına dağıtır. Buna temettü denir. Yani hisseyi elinde tutan kişi hem fiyat artışından hem de temettüden para kazanabilir.

**Risk Nedir?**

Şirket zarar ederse veya piyasalar kötüye giderse hisse fiyatı düşebilir. Bu nedenle yalnızca kaybetmeyi göze alabileceğiniz parayı yatırmanız önerilir.

**Hatırlamanız Gereken:**
- Hisse = şirket ortaklığı
- Fiyat artışı + temettü = iki kazanç yolu
- Her yatırımda risk vardır, çeşitlendirme bu riski azaltır`,
      },
      {
        id: "how-bist-works",
        title: "BIST Nedir? Borsa Nasıl Çalışır?",
        summary: "Türkiye'nin en büyük borsası olan BIST'i ve nasıl işlem yapıldığını anlıyoruz.",
        readTime: "4 dk",
        level: "Başlangıç",
        content: `**BIST (Borsa İstanbul) Nedir?**

BIST, Türkiye'deki şirketlerin hisselerinin alınıp satıldığı resmi piyasadır. 500'den fazla şirket burada işlem görür.

**İşlem Saatleri**

BIST her iş günü 10:00 - 18:00 saatleri arasında açık olur. Bu saatler dışında işlem yapamazsınız.

**BIST100 Nedir?**

Borsadaki en büyük 100 şirketin performansını gösteren bir endekstir. "BIST yüzde 2 yükseldi" dendiğinde bu 100 şirketin ortalama değişiminden söz ediliyordur.

**Nasıl Alım Satım Yapılır?**

1. Bir aracı kurum veya uygulama üzerinden hesap açarsınız (Midas, Gedik, İş Yatırım vb.)
2. Hesabınıza para yatırırsınız
3. Almak istediğiniz hissenin kodunu (THYAO, GARAN gibi) yazıp miktar girersiniz
4. Emir iletilir ve eşleşirse işleminiz gerçekleşir

**Önemli Not**

İşlemler T+2 mantığıyla çalışır: Bugün sattığınız hissenin parası 2 iş günü sonra hesabınıza geçer.`,
      },
      {
        id: "diversification",
        title: "Çeşitlendirme Neden Bu Kadar Önemli?",
        summary: "\"Tüm yumurtaları aynı sepete koyma\" ilkesi yatırımda nasıl uygulanır?",
        readTime: "3 dk",
        level: "Başlangıç",
        content: `**Çeşitlendirme Nedir?**

Paranızı tek bir hisseye değil, birden fazla hisseye veya varlık türüne (hisse, altın, tahvil, döviz) dağıtmaktır.

**Neden Önemli?**

Diyelim ki tüm paranızı bir havayolu hissesine koydunuz. Pandemi geldi, şirket iflas etti — tüm paranızı kaybettiniz.

Ama paranızı 10 farklı sektördeki hisseye dağıtsaydınız, havayolu çökse bile diğerleri sizi kurtarırdı.

**Pratik Çeşitlendirme**

- Farklı sektörler: Banka + Enerji + Teknoloji + Savunma
- Farklı piyasalar: BIST + ABD + Kripto
- Farklı varlıklar: Hisse + Altın + Dolar
- Farklı büyüklükler: Büyük şirket + Küçük şirket

**Ne Kadar Çeşitlendirmeli?**

10-20 hisse genellikle yeterlidir. 50 hisse almak takibi zorlaştırır ve getiriyi ortalamaya yaklaştırır.

**Altın Kural**

Hiçbir tek pozisyon toplam portföyünüzün %20'sinden fazla olmamalıdır.`,
      },
    ],
  },
  {
    id: "technical",
    label: "Teknik Analiz",
    icon: BarChart2,
    color: "purple",
    articles: [
      {
        id: "rsi-explained",
        title: "RSI Göstergesi Nasıl Okunur?",
        summary: "RSI 30'un altına düştüğünde ne anlama gelir? Bu gerçekten alım fırsatı mı?",
        readTime: "5 dk",
        level: "Orta",
        content: `**RSI (Göreceli Güç Endeksi) Nedir?**

RSI, bir hissenin son dönemde ne kadar hızlı ve güçlü hareket ettiğini ölçer. 0 ile 100 arasında bir değer alır.

**Temel Kurallar**

- RSI > 70: Hisse aşırı alınmış olabilir. Kısa vadede düşüş riski artar.
- RSI < 30: Hisse aşırı satılmış olabilir. Toparlanma ihtimali artar.
- RSI 40-60: Nötr bölge, belirgin bir sinyal yok.

**Dikkat Edilmesi Gereken**

RSI düşük diye her zaman alım yapılmaz. Güçlü düşüş trendinde RSI uzun süre 30'un altında kalabilir.

**RSI Divergence (Uyumsuzluk)**

Fiyat yeni dip yaparken RSI daha yüksek dip yapıyorsa bu güçlü bir tersine dönüş sinyali olabilir. Fiyat zayıflarken momentum artıyor demektir.

**Analysight'te RSI**

Her hisse sayfasında güncel RSI değerini ve yorumunu görebilirsiniz. RSI < 30 olduğunda sistem sizi uyarır.

**Sonuç**

RSI tek başına yeterli değildir. MACD, fiyat seviyeleri ve hacimle birlikte değerlendirin.`,
      },
      {
        id: "candlestick-basics",
        title: "Mum Grafik Nasıl Okunur?",
        summary: "Japonların icat ettiği mum grafikler neden hâlâ en popüler grafik türü?",
        readTime: "5 dk",
        level: "Orta",
        content: `**Mum Grafik Nedir?**

Her mum, seçilen zaman diliminde (1 gün, 1 saat vb.) fiyatın açılış, kapanış, en yüksek ve en düşük noktasını gösterir.

**Mum Anatomisi**

- Gövde: Açılış ve kapanış fiyatı arasındaki alan
- Yeşil/Beyaz gövde: Kapanış > Açılış (yükseliş)
- Kırmızı/Siyah gövde: Kapanış < Açılış (düşüş)
- Fitil (kuyruğu): Gün içi en yüksek ve en düşük noktalar

**Önemli Mum Formasyonları**

**Doji:** Açılış ve kapanış neredeyse aynı. Kararsızlık sinyali, trend dönüşü olabilir.

**Çekiç (Hammer):** Küçük gövde, uzun alt fitil. Düşüş trendinin sonunda oluşursa güçlü alım sinyali.

**Kayan Yıldız (Shooting Star):** Küçük gövde, uzun üst fitil. Yükseliş trendinin sonunda satış sinyali.

**Yutan (Engulfing):** Önceki mumu tamamen yutan büyük mum. Yön değişimi habercisi.

**Analysight'te Kullanım**

Candlestick grafik bölümünde tüm bu formasyonları gerçek verilerle inceleyebilir, "Analiz Et" butonuyla AI yorumu alabilirsiniz.`,
      },
      {
        id: "moving-averages",
        title: "Hareketli Ortalamalar ve EMA",
        summary: "EMA20, EMA50, EMA200 — bu sayılar ne anlama geliyor ve nasıl kullanılıyor?",
        readTime: "4 dk",
        level: "Orta",
        content: `**Hareketli Ortalama Nedir?**

Son N günün fiyatlarının ortalamasını alarak hesaplanan ve grafikte çizgi olarak görünen gösterge.

**EMA vs SMA**

- SMA (Basit Hareketli Ortalama): Tüm günlere eşit ağırlık verir
- EMA (Üstel Hareketli Ortalama): Son günlere daha fazla ağırlık verir, fiyat hareketlerine daha hızlı tepki verir

**Popüler EMA'lar**

- EMA20: Kısa vadeli trend (günlük trader'lar için)
- EMA50: Orta vadeli trend (swing trader'lar için)
- EMA200: Uzun vadeli trend (yatırımcılar için)

**Altın Kesişim (Golden Cross)**

EMA50, EMA200'ü yukarıdan aşağıya kestiğinde bu güçlü bir yükseliş sinyalidir. "Golden Cross" olarak bilinir.

**Ölüm Kesişimi (Death Cross)**

EMA50, EMA200'ü aşağıdan yukarıya kestiğinde güçlü düşüş sinyali. "Death Cross" olarak bilinir.

**Pratik Kural**

Fiyat EMA200'ün üzerindeyse uzun vadeli trend yukarı. Altındaysa aşağı. Bu kadar basit.`,
      },
    ],
  },
  {
    id: "risk",
    label: "Risk Yönetimi",
    icon: Shield,
    color: "orange",
    articles: [
      {
        id: "stop-loss",
        title: "Stop Loss Nedir? Neden Hayati Önemde?",
        summary: "Bir pozisyonda ne kadar kaybedebileceğinizi bilmeden işlem açmak körlük gibidir.",
        readTime: "4 dk",
        level: "Başlangıç",
        content: `**Stop Loss Nedir?**

Belirlediğiniz fiyata geldiğinde pozisyonunuzu otomatik kapatan emir türüdür. Kayıplarınızı sınırlar.

**Neden Şart?**

"Fiyat geri döner" diye beklemek, küçük kayıpları büyütür. %10 düşüşü telafi etmek için %11 kazanmak gerekir. %50 düşüş için %100 kazanç gerekir.

Amerikan deyimiyle: "Cut your losses short, let your winners run."

**Stop Loss Nasıl Belirlenir?**

- Teknik destek seviyelerinin biraz altına koyun
- Genellikle giriş fiyatının %5-10 altı makul başlangıç noktasıdır
- Volatil hisseler için daha geniş stop kullanın

**Risk/Ödül Oranı**

Her işlemde risk/ödül oranınızı hesaplayın.
- Risk: Giriş - Stop Loss
- Ödül: Hedef - Giriş
- Oran en az 1:2 olmalı (1 TL risk için 2 TL potansiyel)

Analysight her hisse için bu hesaplamayı otomatik yapar.

**Altın Kural**

Tek bir işlemde portföyünüzün %2'sinden fazlasını riske atmayın.`,
      },
      {
        id: "position-sizing",
        title: "Pozisyon Boyutlandırma Sanatı",
        summary: "Ne kadar para ile hangi hisseye girmeli? Bu sorunun cevabı servet oluşturur.",
        readTime: "5 dk",
        level: "Orta",
        content: `**Pozisyon Boyutlandırma Nedir?**

Her işlem için ne kadar para ayıracağınıza karar vermek. Bu, risk yönetiminin kalbidir.

**%2 Kuralı**

Tek bir işlemde maksimum portföyünüzün %2'sini riske edin.

Örnek: 100.000 TL portföy → Tek işlemde max 2.000 TL risk.

**Hesaplama**

Portföy = 100.000 TL
Max Risk = %2 = 2.000 TL
Hisse Fiyatı = 50 TL, Stop Loss = 45 TL
Risk/Hisse = 50 - 45 = 5 TL
Alınabilecek Lot = 2.000 / 5 = 400 lot

**Kelly Kriteri (İleri Seviye)**

Matematiksel olarak optimal pozisyon boyutunu hesaplar:
f = (p × b - q) / b
p = kazanma olasılığı, b = ödül/risk, q = 1-p

Pratikte Kelly'nin yarısını kullanmak önerilir.

**Psycholoji**

Küçük pozisyonlar mantıklı kararlar vermenizi sağlar. Büyük pozisyonlar panik yaratır. Panik kötü kararlar doğurur.

**Analysight Entegrasyonu**

Risk Haritası bölümünde her hisse için önerilen pozisyon büyüklüğü hesaplanır.`,
      },
    ],
  },
  {
    id: "fundamental",
    label: "Temel Analiz",
    icon: TrendingUp,
    color: "emerald",
    articles: [
      {
        id: "pe-ratio",
        title: "F/K Oranı: Hisse Pahalı mı, Ucuz mu?",
        summary: "Bir hissenin ucuz veya pahalı olduğunu nasıl anlarsınız? F/K oranı size ipucu verir.",
        readTime: "4 dk",
        level: "Başlangıç",
        content: `**F/K (Fiyat/Kazanç) Oranı Nedir?**

Şirketin piyasa değerinin yıllık net kârına bölünmesiyle bulunur.

F/K = Hisse Fiyatı / Hisse Başına Kâr (EPS)

**Ne Anlama Gelir?**

F/K = 15 → Şirketin şu anki kârıyla kendinizi 15 yılda amorti edersiniz.

**Düşük F/K = Ucuz mı?**

Mutlaka değil. Ucuz görünen hisse, büyüme beklentisi olmadığı için ya da sorun yaşadığı için ucuz olabilir.

**Sektör Karşılaştırması Şart**

- Bankacılık: F/K 5-10 normal
- Teknoloji: F/K 30-50 normal
- Utilities (elektrik/su): F/K 15-20 normal

Sektör ortalamasının altında F/K → göreceli ucuz
Sektör ortalamasının üstünde → göreceli pahalı

**PEG Oranı (Daha Doğru Ölçüm)**

PEG = F/K / Büyüme Oranı
PEG < 1 → Büyümesine göre ucuz
PEG > 1 → Büyümesine göre pahalı

**Analysight'te**

Her hissenin Temel Analiz bölümünde F/K, PD/DD ve diğer değerleme metrikleri gösterilir.`,
      },
      {
        id: "earnings",
        title: "Kazanç Açıklamaları: Ne Beklenmeli?",
        summary: "Şirketler her üç ayda bir kâr/zarar açıklar. Bu açıklamalar fiyatı nasıl etkiler?",
        readTime: "4 dk",
        level: "Orta",
        content: `**Kazanç Açıklaması (Earnings) Nedir?**

Şirketler her 3 ayda bir finansal sonuçlarını açıklar: Gelir, gider, kâr ve önemli gelişmeler.

**Piyasa Beklentisi**

Analistler açıklamadan önce tahmin yapar. Sonuç bu tahminin üstünde çıkarsa (beat) hisse yükselir, altında (miss) kalırsa düşer.

**"Buy the rumor, sell the news"**

Bazen beklenti çok iyimser olduğunda, kazanç gerçekten iyi olsa bile "satış haberi" olabilir. Çünkü beklenti fiyata zaten yansımıştır.

**EPS Nedir?**

Earnings Per Share — hisse başına kâr. Şirketin toplam kârının hisse sayısına bölümü.

**Rehberlik (Guidance)**

Şirket gelecek çeyrek veya yıl için tahmin verirse buna guidance denir. Bu rakamlar çoğu zaman geçmiş sonuçlardan daha önemlidir.

**Kazanç Takvimi**

Analysight'teki Kazançlar bölümünde yaklaşan kazanç açıklamalarını ve analist beklentilerini görebilirsiniz.`,
      },
    ],
  },
  {
    id: "psychology",
    label: "Yatırım Psikolojisi",
    icon: Brain,
    color: "violet",
    articles: [
      {
        id: "fear-greed",
        title: "Korku ve Açgözlülük: Borsanın Gerçek Düşmanları",
        summary: "Piyasalar insanlardan oluşur. İnsan duyguları anlarsanız, piyasayı da anlarsınız.",
        readTime: "5 dk",
        level: "Başlangıç",
        content: `**Warren Buffett'ın Meşhur Sözü**

"Başkaları açgözlü olduğunda korkun, başkaları korktuğunda açgözlü olun."

Bu basit ama uygulaması son derece zor.

**Korku (Fear) Nasıl Zararlı Olur?**

Piyasa düştüğünde panik satışı yapmak en yaygın hatadır. Düşüş gerçek bir sorun değilse, panikle satmak en dip fiyatından çıkmak demektir.

**Açgözlülük Nasıl Zararlı Olur?**

Hisse sürekli yükseldiğinde "bir daha yükselir" diye gereğinden fazla alım yapmak ve tepede kalmak. Ya da kaybeden pozisyonu "geri döner" diye tutmak.

**FOMO (Kaçırma Korkusu)**

"Herkes para kazanıyor, ben de gireyim" düşüncesi. Genellikle en üst noktada alım yapılmasına yol açar.

**Survivor Bias (Hayatta Kalma Önyargısı)**

Sadece başarı hikayelerini duyarsınız. Aynı stratejiyle kaybedenleri görmezsiniz.

**Pratik Çözümler**

- Kurallara göre işlem yapın, duygulara göre değil
- Her işlem öncesi stop loss ve hedef belirleyin
- Günlük fiyat takibini azaltın (haftalık yeterli)
- Kaybettiğinizde "telafi etmeye" çalışmayın`,
      },
      {
        id: "common-mistakes",
        title: "Yeni Yatırımcıların 7 Yaygın Hatası",
        summary: "Bu hataları önceden bilerek onbinlerce liranızı kurtarabilirsiniz.",
        readTime: "5 dk",
        level: "Başlangıç",
        content: `**1. Stop Loss Koymamak**

"Fiyat geri döner" diye beklemek. Küçük kayıplar büyür, büyük kayıplar felakete dönüşür.

**2. Tek Hisseye Tüm Parayı Yatırmak**

Çeşitlendirmemek. Bir şirket batabilir, bir sektör çökebilir. Yumurtaları dağıtın.

**3. Başkasının Tavsiyesiyle Körü Körüne Alım**

Sosyal medyadaki "Bu hisse patlayacak!" tavsiyelerine uymak. Tavsiye veren kişi çıkmış olabilir.

**4. Kısa Vadeli Düşünce**

Hisseyi alıp 1 hafta içinde satmayı planlamak. Vergi ve komisyon maliyetleri kârı yer.

**5. Kayıpları Ortalama İndir Yaparak Kapatmaya Çalışmak**

Düşen hisseye daha fazla alım yapmak ("batık maliyet yanılgısı"). Düşen bir şeyin daha fazla düşme ihtimali de var.

**6. Haberlere Göre Anlık Karar**

Her haberde alım satım yapmak. Piyasalar haberleri genellikle önceden fiyatlar.

**7. Getiri Beklentisini Aşırı Yüksek Tutmak**

"Her ay %20 kazanacağım." Küresel en iyi fonlar yıllık %15-20 kazanır. Aylık %20 sürdürülebilir değildir.

**Analysight Bunu Nasıl Önler?**

Her hisse sayfasında Risk Haritası, R/R Oranı ve senaryo analizleri bu hataları yapmadan önce düşünmenizi sağlar.`,
      },
    ],
  },
  {
    id: "crypto",
    label: "Kripto Para",
    icon: Coins,
    color: "yellow",
    articles: [
      {
        id: "crypto-basics",
        title: "Bitcoin ve Kripto Para: Gerçekten Yatırım Aracı mı?",
        summary: "Kripto nedir, neden değerlidir ve bir portföyde ne kadar yer almalıdır?",
        readTime: "5 dk",
        level: "Başlangıç",
        content: `**Bitcoin Nedir?**

Merkezi bir otoriteye (banka, devlet) bağlı olmayan dijital para birimidir. Blockchain teknolojisiyle çalışır.

**Neden Değer Kazanır?**

- Arz sınırlı: Toplamda 21 milyon Bitcoin üretilebilir
- Talep artıyor: Kurumsal yatırımcılar, ETF'ler, ülkeler kabul ediyor
- Güven: Merkezi kontrol yok, şeffaf yapı

**Kripto vs Hisse Senedi**

- Kripto 7/24 işlem görür, borsa sadece iş günleri açık
- Kripto çok daha volatil (oynak) — günde %20 hareket normal
- Kripto düzenleyici risk taşır (ülkeler yasaklayabilir)
- Hissenin arkasında gerçek bir şirket ve varlık var

**Portföyde Kaç Yer Almalı?**

Risk toleransınıza göre değişir:
- Düşük risk iştahı: %0-5
- Orta risk iştahı: %5-15
- Yüksek risk iştahı: %15-25

Hiçbir zaman kaybetmeyi kaldıramayacağınız miktarı kripto'ya koymayın.

**Altcoin Uyarısı**

Bitcoin ve Ethereum dışındaki binlerce coin'in büyük çoğunluğu değersiz veya dolandırıcılıktır. Araştırmadan almayın.`,
      },
    ],
  },
];

const LEVEL_COLOR = {
  "Başlangıç": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Orta":       "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "İleri":      "bg-red-500/20 text-red-300 border-red-500/30",
};

const CAT_COLORS: Record<string, string> = {
  blue:    "bg-blue-500/10 border-blue-500/30 text-blue-400",
  purple:  "bg-purple-500/10 border-purple-500/30 text-purple-400",
  orange:  "bg-orange-500/10 border-orange-500/30 text-orange-400",
  emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  violet:  "bg-violet-500/10 border-violet-500/30 text-violet-400",
  yellow:  "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
};

// ── Article accordion ─────────────────────────────────────────────────────────
function ArticleCard({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all",
      open ? "border-zinc-600 bg-zinc-900" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700")}>
      <button className="w-full text-left p-4 flex items-start gap-4" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", LEVEL_COLOR[article.level])}>
              {article.level}
            </span>
            <span className="text-[10px] text-zinc-600">{article.readTime} okuma</span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug mb-1">{article.title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">{article.summary}</p>
        </div>
        <div className="shrink-0 text-zinc-500 mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-zinc-800 pt-4">
          <div className="space-y-2 text-sm leading-relaxed">
            {article.content.split("\n").map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-1" />;
              const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
              if (line.startsWith("**") && line.endsWith("**"))
                return <p key={i} className="font-bold text-white text-sm mt-3 mb-1" dangerouslySetInnerHTML={{ __html: html }} />;
              if (line.startsWith("- "))
                return <p key={i} className="text-zinc-300 pl-3">· {line.replace(/^- /, "")}</p>;
              return <p key={i} className="text-zinc-300" dangerouslySetInnerHTML={{ __html: html }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Glossary ──────────────────────────────────────────────────────────────────
const GLOSSARY_TERMS = [
  { term: "Hisse Senedi",     def: "Bir şirkette küçük bir mülkiyet payını temsil eden menkul kıymet." },
  { term: "Temettü",         def: "Şirketin kârından hissedarlarına dağıttığı nakit ödeme." },
  { term: "Portföy",         def: "Bir yatırımcının sahip olduğu tüm yatırımların toplamı." },
  { term: "Volatilite",      def: "Fiyat dalgalanmasının ölçüsü. Yüksek volatilite = yüksek risk ve fırsat." },
  { term: "Likidite",        def: "Varlığın hızlı ve kolay alınıp satılabilme kapasitesi." },
  { term: "Piyasa Değeri",   def: "Şirketin toplam hisse sayısı × hisse fiyatı. Şirketin borsa büyüklüğü." },
  { term: "Bull Piyasa",     def: "Fiyatların yükseldiği, iyimserliğin hakim olduğu dönem." },
  { term: "Bear Piyasa",     def: "Fiyatların %20+ düştüğü, kötümserliğin hakim olduğu dönem." },
  { term: "Short Satış",     def: "Hissenin değer kaybedeceğini düşünerek ödünç alıp satma işlemi." },
  { term: "Stop Loss",       def: "Belirlenen fiyatta otomatik satış yapan emir. Kaybı sınırlandırır." },
  { term: "R/R Oranı",       def: "Risk/Ödül Oranı. Alınan riske göre beklenen kazanç. 1:2 minimum önerilir." },
  { term: "EPS",             def: "Hisse Başına Kâr. Şirketin net kârının toplam hisse sayısına bölümü." },
  { term: "F/K Oranı",       def: "Fiyat/Kazanç. Hissenin kârına göre ne kadar pahalı olduğunu gösterir." },
  { term: "Hacim",           def: "Belirli bir dönemde işlem gören hisse adedi. Yüksek hacim = güçlü hareket." },
  { term: "Endeks",          def: "Belirli hisse grubunun genel performansını gösteren ölçüt. (BIST100, S&P500)" },
  { term: "ETF",             def: "Borsa Yatırım Fonu. Birden fazla hisseyi kapsayan ve borsada işlem gören fon." },
  { term: "Momentum",        def: "Fiyat hareketinin hız ve yönü. Yükselen momentum = güçlenen trend." },
  { term: "Destek",          def: "Fiyatın tekrar tekrar geri döndüğü alt seviye. Alıcıların yoğun olduğu bölge." },
  { term: "Direnç",          def: "Fiyatın tekrar tekrar geri döndüğü üst seviye. Satıcıların yoğun olduğu bölge." },
  { term: "Konsolidasyon",   def: "Fiyatın belirli bir aralıkta sıkıştığı, yön aradığı dönem." },
];

function Glossary() {
  const [search, setSearch] = useState("");
  const filtered = GLOSSARY_TERMS.filter(t =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.def.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Terim ara…"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
      />
      <div className="space-y-2">
        {filtered.map(t => (
          <div key={t.term} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-sm font-bold text-white mb-1">{t.term}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{t.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type View = "articles" | "glossary";

export default function LearnPage() {
  const [activeCategory, setActiveCategory] = useState<string>("basics");
  const [view, setView] = useState<View>("articles");

  const category = CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0];
  const totalArticles = CATEGORIES.reduce((s, c) => s + c.articles.length, 0);

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-6">

      {/* Header */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h1 className="text-xl font-bold text-white">Yatırımcı Okulu</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Borsa ve finansı sıfırdan öğrenmek için {totalArticles} makale, sözlük ve pratik rehberler.
          Hiçbir ön bilgi gerekmez.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView("articles")}
          className={cn("text-sm px-4 py-1.5 rounded-full font-medium transition-all",
            view === "articles" ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200")}>
          Makaleler
        </button>
        <button onClick={() => setView("glossary")}
          className={cn("text-sm px-4 py-1.5 rounded-full font-medium transition-all",
            view === "glossary" ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200")}>
          Terim Sözlüğü ({GLOSSARY_TERMS.length})
        </button>
      </div>

      {view === "glossary" ? (
        <Glossary />
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all",
                    isActive
                      ? cn(CAT_COLORS[cat.color], "font-bold")
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                  )}>
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span className="text-[10px] opacity-60">{cat.articles.length}</span>
                </button>
              );
            })}
          </div>

          {/* Articles */}
          <div className="space-y-3">
            {category.articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Progress tip */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-start gap-4">
            <Target className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white mb-1">Pratik Yapmadan Öğrenmek Olmaz</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Makaleleri okuduktan sonra gerçek hisseler üzerinde deneyin. THYAO sayfasına gidip RSI değerini kontrol edin,
                grafikteki EMA çizgilerini inceleyin ve "Analiz Et" butonuyla AI yorumu alın. Öğrendiklerinizi gerçek veriyle pekiştirin.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
