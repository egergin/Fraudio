namespace Fraudio.Infrastructure.Demo;

/// <summary>
/// Demo işlem üreteci için önceden tanımlı, koordinatlı konum kataloğu.
///
/// Koordinatlar bilinçli olarak gömülüdür: üreteç hiçbir harici coğrafi kodlama
/// servisine çıkmaz. Böylece demo trafiği ağ bağımlılığı oluşturmaz ve
/// Open-Meteo kotasını tüketmez.
///
/// Listeyi genişletmek için buraya yeni bir <see cref="DemoLocation"/> eklemek
/// yeterlidir. Çalışma zamanında alt küme seçmek için
/// DEMO_TRANSACTION_LOCATIONS ortam değişkeni kullanılır.
/// </summary>
public sealed record DemoLocation(string City, string Country, double Latitude, double Longitude);

public static class DemoLocationCatalogue
{
    /// <summary>
    /// Coğrafi olarak dağınık şehirler. Aradaki uzun mesafeler, imkansız
    /// seyahat kuralının demo ortamında gerçekçi biçimde tetiklenebilmesini
    /// sağlar.
    /// </summary>
    public static readonly IReadOnlyList<DemoLocation> All =
    [
        new("Istanbul", "Turkey", 41.0082, 28.9784),
        new("Ankara", "Turkey", 39.9334, 32.8597),
        new("Izmir", "Turkey", 38.4237, 27.1428),
        new("Bursa", "Turkey", 40.1826, 29.0665),
        new("Antalya", "Turkey", 36.8969, 30.7133),
        new("London", "United Kingdom", 51.5072, -0.1276),
        new("Berlin", "Germany", 52.5200, 13.4050),
        new("Amsterdam", "Netherlands", 52.3676, 4.9041),
        new("Paris", "France", 48.8566, 2.3522),
        new("Madrid", "Spain", 40.4168, -3.7038),
        new("Dubai", "United Arab Emirates", 25.2048, 55.2708),
        new("Singapore", "Singapore", 1.3521, 103.8198),
        new("Tokyo", "Japan", 35.6762, 139.6503),
        new("New York", "United States", 40.7128, -74.0060),
        new("Sao Paulo", "Brazil", -23.5505, -46.6333),
    ];

    /// <summary>
    /// Verilen şehir adlarına karşılık gelen katalog kayıtlarını döndürür.
    /// Eşleşme büyük/küçük harf duyarsızdır. Tanınmayan adlar
    /// <paramref name="unknown"/> listesine yazılır ve sessizce yok sayılır;
    /// çağıran taraf bunu uyarı olarak loglar.
    /// </summary>
    public static IReadOnlyList<DemoLocation> Resolve(
        IEnumerable<string> cityNames,
        out IReadOnlyList<string> unknown)
    {
        var resolved = new List<DemoLocation>();
        var missing = new List<string>();

        foreach (var name in cityNames)
        {
            var trimmed = name.Trim();
            if (trimmed.Length == 0) continue;

            var match = All.FirstOrDefault(
                x => string.Equals(x.City, trimmed, StringComparison.OrdinalIgnoreCase));

            if (match is null) missing.Add(trimmed);
            else if (!resolved.Contains(match)) resolved.Add(match);
        }

        unknown = missing;
        return resolved;
    }
}
