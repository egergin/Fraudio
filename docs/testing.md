# Test Kılavuzu

Test paketi birim kurallarını, alan değerlendirmelerini ve tam API entegrasyon testlerini kapsar.

---

## 1. Tüm Testleri Çalıştırma
.NET CLI ile tüm testleri çalıştırmak için:

```bash
DOTNET_CLI_HOME="$PWD/work/dotnet-cli" dotnet test backend/Fraudio.slnx
```

---

## 2. Test Projelerinin Dağılımı

### `Fraudio.Domain.Tests`
* Kural kriterlerini test eder:
  * Hız sınırı: 5 işlem geçer, 6 işlem başarısız olur.
  * Tutar sınırı: tutar > 3 × 24 saatlik ortalama tetikler.
  * Konum imkansız seyahat: mesafe/zaman > 800 km/saat tetikler.
  * Karar matrisi: 0-1 kural = `Onaylandı`, 2-3 kural = `Şüpheli`.

### `Fraudio.Api.Tests`
* Bellek içi kalıcılık ve taklit harici altyapı ile tam HTTP hattını test eder:
  * `POST /api/auth/login` (Yönetici/Analist kimlik doğrulama, geçersiz şifre reddi).
  * `POST /api/transactions` (RBAC uygulaması: Yönetici kabul, Analist yasak, Anonim yetkisiz).
  * Girdi doğrulama: Negatif tutar reddi.
  * `GET /api/frauds/recent` (Analist rolü için veri projeksiyonu).
  * `GET /api/transaction-users/{userId}` (Kullanıcı inceleme dosyası getirme).
  * `GET /api/system/health` (Yönetici sağlık kontrolü raporlama).
