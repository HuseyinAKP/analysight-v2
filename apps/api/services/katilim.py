"""
BIST Katılım Endeksi — Mayıs 2026 güncel listesi
Kaynak: Borsa İstanbul + TKBB Danışma Kurulu
Yılda 2 kez güncellenir (Mayıs ve Kasım dönemleri).
"""

# BIST Katılım 30 (XK030) — Mayıs–Eylül 2026
KATILIM_30 = {
    "ASELS","BIMAS","CCOLA","CIMSA","DOAS","EKGYO","ENKAI","EREGL",
    "FROTO","GUBRF","HEKTS","KERVT","KORDS","KOZAL","MPARK","OTKAR",
    "PGSUS","SASA","SDTTR","SELEC","SISE","TAVHL","THYAO","TKFEN",
    "TOASO","TSKB","TUPRS","ULKER","VESBE","ZOREN",
}

# BIST Katılım 100 (XK100) — üstteki 30 + ek 70
KATILIM_100_EK = {
    "AEFES","AGYO","AKFGY","AKCNS","AKSA","ALKIM","ALTIN","ARCLK",
    "ATAGY","AYGAZ","BAGFS","BMEKS","BRYAT","BUCIM","CEMTS","CLEBI",
    "CMENT","DEVA","DOHOL","EGEEN","EGPRO","ELITE","EUPWR","FENER",
    "GLYHO","GOODY","GSDHO","IHLGM","IHYAY","ISDMR","JANTS","KAPLM",
    "KAREL","KATMR","KERVN","KLGYO","KMPUR","KONTR","KRDMD","KUTPO",
    "LDMTR","LMKDC","LOGO","LUKSK","MAGEN","MARTI","MGROS","MOBTL",
    "NATEN","NETAS","NUGYO","ODAS","OSMEN","OYAYO","PAREG","PETKM",
    "PKENT","PLTUR","PRZMA","RYSAS","SANEL","SARKY","SOKM","TIRE",
    "TMSN","TNZTP","TRKCM","TTRAK","ULUFA","USAK","VAKKO","VERTU",
}

KATILIM_100 = KATILIM_30 | KATILIM_100_EK


def get_katilim_status(symbol: str) -> dict:
    """
    Bir hisse sembolünün katılım endeksi durumunu döner.
    Returns: { in_katilim_30, in_katilim_100, label, color }
    """
    sym = symbol.upper().replace(".IS", "")
    in_30  = sym in KATILIM_30
    in_100 = sym in KATILIM_100

    if in_30:
        return {
            "in_katilim_30":  True,
            "in_katilim_100": True,
            "label": "Katılım 30",
            "color": "emerald",
            "description": "BIST Katılım 30 ve Katılım 100 endekslerinde yer alıyor.",
        }
    if in_100:
        return {
            "in_katilim_30":  False,
            "in_katilim_100": True,
            "label": "Katılım 100",
            "color": "blue",
            "description": "BIST Katılım 100 endeksinde yer alıyor.",
        }
    return {
        "in_katilim_30":  False,
        "in_katilim_100": False,
        "label": None,
        "color": None,
        "description": "Katılım endekslerinde yer almıyor.",
    }


def get_katilim_list(index: str = "100") -> list[str]:
    """Katılım endeksi hisse listesini döner."""
    if index == "30":
        return sorted(KATILIM_30)
    return sorted(KATILIM_100)
