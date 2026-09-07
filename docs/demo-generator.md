# Demo İşlem Üreteci

Panelde sürekli değişen, gerçekçi demo etkinliği oluşturmak için periyodik
olarak rastgele bir işlem üreten arka plan servisi.

Bu yetenek **yalnızca demo ve geliştirme ortamları içindir** ve varsayılan
olarak kapalıdır.

---

## 1. Ne yapar?

Yapılandırılan aralıkta (varsayılan 30 dakika) bir kez çalışır ve şunları
üretir:

| Alan | Kaynak |
| :--- | :--- |
| Kullanıcı kimliği | `TransactionUsers` tablosundan **gerçekten var olan** rastgele bir kayıt |
| Tutar | `DEMO_TRANSACTION_MIN_AMOUNT` – `DEMO_TRANSACTION_MAX_AMOUNT` aralığında, iki ondalık basamağa yuvarlanmış |
| Konum | Koordinatlarıyla birlikte gömülü şehir kataloğundan rastgele bir kayıt |
| Zaman damgası | `TimeProvider` üzerinden UTC |

Üretilen işlem, ardından normal alım hattına yayınlanır.

---

## 2. Üretilen veri sistemde nasıl akar?

Demo işlemi, arayüzden gönderilen gerçek bir işlemle **tamamen aynı yolu**
izler. Hiçbir adım atlanmaz:

```text
DemoTransactionGeneratorService  (BackgroundService, backend konteyneri içinde)
        │
        ▼
DemoTransactionGenerator
        │  rastgele kullanıcı + tutar + konum
        ▼
ITransactionMessagePublisher.PublishAsync
        │  RabbitMQ · fraud-platform.exchange · routing key: transaction.received
        │  başlık: x-source = demo-generator
        ▼
transaction.queue
        │
        ▼
TransactionWorker  (mevcut tüketici — değiştirilmedi)
        │
        ▼
ITransactionProcessor.ProcessAsync
        ├─► FraudDetectionService  → Redis (hız / tutar / konum kuralları)
        ├─► PostgreSQL             → Transaction + FraudResult
        ├─► RabbitMQ               → fraud.detected
        └─► WebSocket (/ws)        → transaction.approved | transaction.suspicious
                                          │
                                          ▼
                                    React paneli — canlı akış otomatik güncellenir
```

Bunun iki önemli sonucu var:

* **Dolandırıcılık kuralları atlanmaz.** Üretilen işlem, hız, tutar ve
  imkansız seyahat kurallarının tamamına tabidir ve karar matrisine göre
  `Onaylandı` veya `Şüpheli` olarak sonuçlanır.
* **Panel kullanıcı etkileşimi olmadan güncellenir.** Sonuç WebSocket
  üzerinden yayınlandığı için canlı akış ve uyarı sayacı kendiliğinden
  değişir; sayfa yenilemek gerekmez.

Üreteç veritabanına doğrudan yazmaz ve paralel bir sahte hat kurmaz.

---

## 3. Yapılandırma

Tüm ayarlar ortam değişkenleriyle yapılır ve depodaki mevcut düz anahtar
kuralını izler. Örnekler `.env.example` içindedir.

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `DEMO_TRANSACTION_GENERATOR_ENABLED` | `false` | Üreteci açar/kapatır. Kapalıyken barındırılan servis hiç kaydedilmez. |
| `DEMO_TRANSACTION_INTERVAL_MINUTES` | `30` | Üretim aralığı (dakika). Ondalık kabul edilir. |
| `DEMO_TRANSACTION_MIN_AMOUNT` | `10` | En küçük tutar. |
| `DEMO_TRANSACTION_MAX_AMOUNT` | `5000` | En büyük tutar. |
| `DEMO_TRANSACTION_LOCATIONS` | *(boş)* | Virgülle ayrılmış şehir listesi. Boşsa katalogun tamamı kullanılır. |
| `DEMO_TRANSACTION_RUN_ON_STARTUP` | `false` | Açılışta hemen bir işlem üretilsin mi. |

Aralık yalnızca `DemoTransactionOptions.Interval` üzerinden okunur; başka
hiçbir yerde sabitlenmemiştir.

### Etkinleştirme

`.env` dosyanızda:

```bash
DEMO_TRANSACTION_GENERATOR_ENABLED=true
```

ardından:

```bash
docker compose up -d --build backend
```

Ayrı bir süreç başlatmanız gerekmez; üreteç mevcut backend konteynerinin
içinde çalışır ve yeni bir port açmaz.

### Geçersiz yapılandırma

Hatalı değerler uygulamayı **başlatmaz hâle getirmez**. Değer varsayılana
düşer ve açılışta bir uyarı loglanır:

```text
warn: Demo işlem üreteci yapılandırma uyarısı: DEMO_TRANSACTION_INTERVAL_MINUTES
      değeri ('yarim-saat') sayı olarak okunamadı; varsayılan 30 kullanılıyor.
```

`MIN > MAX` verilirse değerler otomatik olarak yer değiştirilir ve uyarı
loglanır.

---

## 4. Konum kataloğu

Konumlar, koordinatlarıyla birlikte
`backend/src/Fraudio.Infrastructure/Demo/DemoLocationCatalogue.cs` içinde
tanımlıdır:

> Istanbul · Ankara · Izmir · Bursa · Antalya · London · Berlin · Amsterdam ·
> Paris · Madrid · Dubai · Singapore · Tokyo · New York · Sao Paulo

Şehirler coğrafi olarak bilinçli biçimde dağıtılmıştır; aradaki uzun
mesafeler imkansız seyahat kuralının demo ortamında gerçekçi olarak
tetiklenmesini sağlar.

**Listeyi genişletmek** için katalogda yeni bir `DemoLocation` kaydı
oluşturmanız yeterlidir:

```csharp
new("Kopenhag", "Denmark", 55.6761, 12.5683),
```

**Alt küme kullanmak** için yeniden derlemeye gerek yoktur:

```bash
DEMO_TRANSACTION_LOCATIONS=Istanbul,Tokyo,New York
```

Tanınmayan şehir adları yok sayılır ve uyarı olarak loglanır. Hiçbiri geçerli
değilse katalogun tamamına düşülür.

Koordinatlar gömülü olduğu için üreteç **hiçbir harici coğrafi kodlama
servisine çıkmaz**; Open-Meteo bağımlılığı ve ağ trafiği oluşturmaz.

---

## 5. Demo verisinin ayırt edilmesi

Üretilen mesajlar RabbitMQ başlığıyla işaretlenir:

```text
x-source: demo-generator
```

Bu, kod tabanının hâlihazırda kullandığı mesaj metadata mekanizmasıdır
(`x-retry-count` ile aynı). Bilinçli olarak tercih edilmiştir çünkü:

* veritabanı şeması değişmez,
* genel API sözleşmesi değişmez,
* demo trafiği kuyruk düzeyinde izlenebilir kalır.

Bu işaret dahilîdir ve panele ayrı bir alan olarak sunulmaz.

---

## 6. Loglama

Her başarılı üretim yapılandırılmış bir kayıt bırakır:

```text
info: Demo işlem üretildi 3f2a…c81 customer-102 1284.37 Tokyo Japan
      2026-03-01T12:30:00Z demo-generator
```

Kullanıcı yoksa geçersiz veri üretmek yerine uyarı loglanır:

```text
warn: Demo işlem üretilmedi: Veritabanında kayıtlı işlem kullanıcısı
      bulunmuyor; demo işlem üretilmedi.
```

Kimlik bilgileri veya gizli anahtarlar loglanmaz.

---

## 7. Dayanıklılık ve eşzamanlılık

**Hatalar döngüyü sonlandırmaz.** Kuyruk erişilemezse veya veritabanı
düşerse hata loglanır ve bir sonraki zamanlanmış tur normal şekilde devam
eder.

**Örtüşen çalıştırma oluşmaz.** Zamanlayıcı `PeriodicTimer` kullanır ve
döngü ardışıktır: bir sonraki tik ancak mevcut üretim tamamlandıktan sonra
beklenir. Bir üretim beklenenden uzun sürerse tikler sıraya girmez ve
eşzamanlı kopya iş oluşmaz.

**Kapanış zariftir.** Servis `CancellationToken`'ı doğru kullanır;
uygulama kapanırken döngü temiz biçimde sonlanır.

---

## 8. Test

```bash
DOTNET_CLI_HOME="$PWD/work/dotnet-cli" dotnet test backend/Fraudio.slnx
```

Zamanlama testleri `FakeTimeProvider` ile sanal zamanda ilerler; hiçbir test
gerçek süre beklemez.

Kapsanan davranışlar:

* üreteç varsayılan olarak kapalı
* aralık yapılandırmadan okunuyor ve aralık dolmadan üretim yapılmıyor
* rastgele kullanıcı yalnızca veritabanında var olanlardan seçiliyor
* kullanıcı yoksa zarif atlama ve uyarı
* tutar yapılandırılan aralıkta ve iki ondalık basamakta
* konum yalnızca yapılandırılan katalogdan, koordinatlar sıfır değil
* geçersiz yapılandırmada varsayılana düşme
* mevcut yayıncı üzerinden yayın ve demo başlığı
* örtüşen çalıştırmaların engellenmesi
* hata sonrası zamanlamanın sürmesi
* iptalde zarif kapanış
