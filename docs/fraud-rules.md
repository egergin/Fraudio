# Sahtekarlık Tespit Kuralları Spesifikasyonu

Platform, gelen her işlem için üç temel kuralı değerlendirir.

---

## 1. Hız Kuralı (Velocity)
* **Koşul:** Bir kullanıcı **son 1 dakika içinde 5'ten fazla işlem** gerçekleştirdiğinde.
* **Eşik:** Kayar 60 saniyelik pencere içindeki **6. işlem** ihlali tetikler.
* **Depolama:** Redis Sorted Set `fraud:velocity:{userId}`, UTC zaman damgası ticks ile puanlanır. Her kontrolde temizlenir (`double.NegativeInfinity` ile `şimdi - 1dk`).

---

## 2. Tutar Kuralı (Amount)
* **Koşul:** Yeni işlem tutarı, kullanıcının **son 24 saatteki işlem tutarlarının ortalamasının 3 katını** aştığında.
* **Formül:** `mevcutTutar > ortalama(son24SaatTutarları) * 3`
* **Depolama:** Redis Sorted Set `fraud:amount:{userId}`, üye `{transactionId}:{amount}` ile. Benzersiz üye token'ları, 24 saatlik pencere içinde tutarlar tekrar ettiğinde çarpışmaları önler.

---

## 3. Konum Kuralı (İmkansız Seyahat)
* **Koşul:** Kullanıcının önceki işlem konumu ile mevcut işlem konumu arasındaki teorik seyahat süresi **800 km/saat**'i aşan bir hız gerektirdiğinde.
* **Mesafe Hesaplaması:** Dünya yarıçapı (6.371 km) üzerinde Haversine formülü.
* **Formül:**
  ```text
  mesafe = Haversine(öncekiKonum, mevcutKonum)
  gerekenSaat = mesafe / 800.0
  gerçekSaat = (mevcutOluşmaZamanı - öncekiOluşmaZamanı).ToplamSaat
  ihlal = gerçekSaat < gerekenSaat
  ```
* **Yedek Davranış:** Koordinatlar çözümlenemezse veya `(0, 0)` ise, konum kuralı `Değerlendirilmedi` (ihlal edilmedi) olarak işlenir ve hız ile tutar kontrollerinin normal şekilde devam etmesine izin verilir.

---

## 4. Karar Matrisi
* **0 kural ihlali:** `Onaylandı (Approved)`
* **1 kural ihlali:** `Onaylandı (Approved)`
* **2 kural ihlali:** `Şüpheli (Suspicious)`
* **3 kural ihlali:** `Şüpheli (Suspicious)`

Determinizm ve denetlenebilirliği korumak için risk puanlama kasıtlı olarak kapsam dışı bırakılmıştır.
