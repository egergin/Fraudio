
# Şüpheli İşlem Kuralları
**Kural İhlali**
0–1 → Approved<br>2–3 → Suspicious

## 1 Dakikada > 5 işlem
Kullanıcının son 1 dakika içerisindeki işlem sayısına bakılır. Aynı dakika içerisinde **6.** işlem gelirse kural tetiklenir.

```
fraud = txnCounter > 5
```

## İşlem Tutarı > 24 Saat Ortalamasının 3 Katı
Önceki 24 saatin ortalamasıyla karşılaştırılır. Yeni işlem ortalamadan yüksek ise kural tetiklenir.

```
fraud = priorAverage.HasValue && current > priorAverage * 3
```

## Location — 800 km/h ile imkânsız yolculuk
İki işlemin yapıldığı konumlar arasındaki Haversine mesafesinin 800 km/h hıza bölünmesiyle yolculuk süresi bulunur. Gerçek aralık daha kısaysa kural ihlali olur.

```
required = distance(prev, curr) / 800 km/h
fraud = actualTime < required
```

## Örnek İşlemler

| İşlem | Sonuç |
|---|---|
| 5 işlem/dk | ✓ |
| 6 işlem/dk | Hız |
| 250 vs ort 100 | ✓ |
| 300.01 vs ort 100 | Tutar |
| 5 dk'da İstanbul → New York | Konum |
| 2 saatte İstanbul → Ankara | ✓ |
