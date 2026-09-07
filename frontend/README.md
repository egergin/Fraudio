# Fraudio — Ön Yüz

Fraudio dolandırıcılık operasyonları paneli. React 19 + Vite 6 ile yazılmıştır ve
mevcut ASP.NET Core backend'ini olduğu gibi tüketir.

## Teknoloji

| Katman | Seçim |
| :--- | :--- |
| UI | React 19 (JSX) |
| Derleme | Vite 6 |
| Yönlendirme | react-router-dom 7 |
| Grafik | Chart.js + react-chartjs-2 |
| Stil | Belirteç tabanlı düz CSS (`src/styles/`) |
| Test | Vitest + Testing Library (jsdom) |

Bilinçli olarak eklenmeyenler: CSS çerçevesi, bileşen kütüphanesi, durum yönetimi
kütüphanesi, ikon paketi. Uygulamanın boyutu bunları gerektirmiyor.

## Komutlar

```bash
npm install
npm run dev      # geliştirme sunucusu (:5173)
npm run build    # üretim derlemesi → dist/
npm run preview  # derlenmiş çıktıyı önizle
npm test         # Vitest paketi (58 test)
```

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080` | Backend kök adresi. WebSocket URL'i de buradan türetilir. |

Bu sözleşme önceki sürümle aynıdır; Docker Compose yapılandırması değişmemiştir.

## Dizin yapısı

```
src/
  auth/          Kimlik doğrulama bağlamı (JWT, oturum süresi, 401 yakalama)
  components/
    data/        Tablolar, canlı akış, grafikler, kural dağılımı
    investigate/ İnceleme çekmecesi (erişilebilir dialog)
    shell/       Uygulama kabuğu, gezinme, bağlantı göstergesi
    ui/          Primitifler (buton, panel, rozet) ve durum bileşenleri
  hooks/         useApiResource, useLiveStream, useMediaQuery
  lib/           api.js (merkezî istemci), domain.js, format.js
  pages/         Rota bileşenleri
  styles/        tokens → base → components → layout → features
  test/          Vitest paketi
```

## API entegrasyonu

Tüm ağ erişimi `src/lib/api.js` üzerinden geçer. Bu modül şunları merkezîleştirir:
Authorization başlığı, JSON ayrıştırma, HTTP hatalarının sınıflandırılması
(401 / 403 / 404 / 503 / ağ ayrımı), `AbortSignal` ile iptal ve 401 alındığında
oturumun temizlenmesi.

Kullanılan uç noktalar — hepsi backend'de mevcuttur, hiçbiri uydurma değildir:

| Uç nokta | Yetki | Kullanıldığı yer |
| :--- | :--- | :--- |
| `POST /api/auth/login` | açık | Giriş |
| `GET /api/frauds/recent` | Admin, Analyst | Genel bakış, dolandırıcılık izleme |
| `GET /api/transaction-users/{id}` | Admin, Analyst | Kullanıcı dosyası, inceleme çekmecesi |
| `GET /api/transaction-users/{id}/transactions` | Admin, Analyst | İşlem geçmişi |
| `GET /api/system/health` | Admin | Sistem sağlığı |
| `POST /api/transactions` | Admin | İşlem gönderme |
| `GET /api/admin/users` | Admin | Panel hesapları |
| `WS /ws?access_token=` | kimlik doğrulamalı | Canlı akış |

## Backend sınırları ve arayüze etkisi

Bunlar arayüzde gizlenmez; kullanıcıya açıkça bildirilir.

* `frauds/recent` ve kullanıcı geçmişi **20 kayıtla** sınırlıdır. Sunucu tarafı
  sayfalama, tarih aralığı veya filtreleme parametresi yoktur. Arama ve filtreler
  bu 20 kayıt üzerinde istemci tarafında çalışır ve bu durum ilgili sayfalarda
  belirtilir.
* **Toplu zaman serisi uç noktası yoktur.** Yoğunluk grafiği yalnızca elde bulunan
  şüpheli işlemlerden türetilir ve tam geçmişi temsil etmez.
* **İşlem kimliğine göre sorgulama uç noktası yoktur.** İnceleme görünümü, liste
  satırındaki veriyi kullanıcı özeti ve geçmişiyle birleştirerek oluşturulur.
* **İşlem kullanıcılarını listeleme uç noktası yoktur.** Bir kullanıcıya yalnızca
  bir uyarı veya akış olayı üzerinden ulaşılabilir.
* `system/health` yalnızca üç bağımlılığın erişilebilirliğini bildirir; gecikme,
  kaynak kullanımı veya kuyruk derinliği sunmaz.
* WebSocket sayaçları **oturuma özgüdür**. Arayüz bunları hiçbir zaman kalıcı
  geçmiş toplamı olarak sunmaz; ilgili alanlar açıkça etiketlenmiştir.

## Yetkilendirme

Rol backend'in döndürdüğü `role` alanından okunur ve asla varsayılan olarak
`Admin` kabul edilmez. Yönetici rotaları (`/health`, `/submit`, `/accounts`)
istemci tarafında korunur ve yetkisiz rollerde ilgili uç noktalar hiç çağrılmaz.
Backend RBAC'ı tek doğruluk kaynağı olmaya devam eder; istemci kontrolü yalnızca
gereksiz 403 gürültüsünü ve yanıltıcı arayüz öğelerini önler.

## Test

```bash
npm test
```

Kapsam: API istemcisi sözleşmesi ve hata sınıflandırması, alan mantığı
(şiddet karar matrisi, sağlık toplama, rol eşleme), sayfa davranışı
(yükleme/boş/hata/yetkisiz durumları, filtreleme, sıralama), RBAC uygulaması,
çekmece klavye erişilebilirliği ve duyarlı tablo/liste geçişi.
