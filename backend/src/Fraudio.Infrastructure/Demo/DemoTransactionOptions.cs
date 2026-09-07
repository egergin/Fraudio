using Microsoft.Extensions.Configuration;

namespace Fraudio.Infrastructure.Demo;

/// <summary>
/// Demo işlem üretecinin yapılandırması.
///
/// Depodaki mevcut kural izlenir: yapılandırma, düz ortam değişkeni
/// anahtarlarıyla okunur (JWT_SECRET, POSTGRES_CONNECTION vb. ile aynı stil),
/// iç içe appsettings bölümleri kullanılmaz.
/// </summary>
public sealed class DemoTransactionOptions
{
    public const string EnabledKey = "DEMO_TRANSACTION_GENERATOR_ENABLED";
    public const string IntervalKey = "DEMO_TRANSACTION_INTERVAL_MINUTES";
    public const string MinAmountKey = "DEMO_TRANSACTION_MIN_AMOUNT";
    public const string MaxAmountKey = "DEMO_TRANSACTION_MAX_AMOUNT";
    public const string LocationsKey = "DEMO_TRANSACTION_LOCATIONS";
    public const string RunOnStartupKey = "DEMO_TRANSACTION_RUN_ON_STARTUP";

    /// <summary>Üreteç kapalıysa barındırılan servis hiç kaydedilmez.</summary>
    public bool Enabled { get; init; }

    /// <summary>Tek zamanlama kaynağı; başka hiçbir yerde sabitlenmez.</summary>
    public TimeSpan Interval { get; init; } = TimeSpan.FromMinutes(30);

    public decimal MinAmount { get; init; } = 10m;

    public decimal MaxAmount { get; init; } = 5000m;

    /// <summary>Kullanılacak konumlar; boş bırakılırsa katalogun tamamı.</summary>
    public IReadOnlyList<DemoLocation> Locations { get; init; } = DemoLocationCatalogue.All;

    /// <summary>
    /// Varsayılan olarak kapalıdır: uygulama açılışında anında işlem
    /// üretilmez, önce bir aralık beklenir.
    /// </summary>
    public bool RunOnStartup { get; init; }

    /// <summary>
    /// Yapılandırmayı okurken karşılaşılan, ölümcül olmayan sorunlar.
    /// Barındırılan servis bunları başlangıçta uyarı olarak loglar.
    /// </summary>
    public IReadOnlyList<string> Warnings { get; init; } = [];

    /// <summary>
    /// Ortam değişkenlerinden okur. Geçersiz değerler varsayılana düşer ve
    /// bir uyarı üretir; hiçbir durumda istisna fırlatmaz, çünkü hatalı bir
    /// demo ayarı uygulamanın açılmasını engellememelidir.
    /// </summary>
    public static DemoTransactionOptions FromConfiguration(IConfiguration configuration)
    {
        var warnings = new List<string>();

        var enabled = ReadBool(configuration, EnabledKey, defaultValue: false, warnings);
        var runOnStartup = ReadBool(configuration, RunOnStartupKey, defaultValue: false, warnings);

        var interval = TimeSpan.FromMinutes(
            ReadDouble(configuration, IntervalKey, defaultValue: 30d, minimum: 0.01d, warnings));

        var minAmount = ReadDecimal(configuration, MinAmountKey, defaultValue: 10m, minimum: 0.01m, warnings);
        var maxAmount = ReadDecimal(configuration, MaxAmountKey, defaultValue: 5000m, minimum: 0.01m, warnings);

        if (minAmount > maxAmount)
        {
            warnings.Add(
                $"{MinAmountKey} ({minAmount}) değeri {MaxAmountKey} ({maxAmount}) değerinden büyük; " +
                "değerler yer değiştirildi.");
            (minAmount, maxAmount) = (maxAmount, minAmount);
        }

        var locations = ReadLocations(configuration, warnings);

        return new DemoTransactionOptions
        {
            Enabled = enabled,
            Interval = interval,
            MinAmount = minAmount,
            MaxAmount = maxAmount,
            Locations = locations,
            RunOnStartup = runOnStartup,
            Warnings = warnings,
        };
    }

    private static bool ReadBool(IConfiguration configuration, string key, bool defaultValue, List<string> warnings)
    {
        var raw = configuration[key];
        if (string.IsNullOrWhiteSpace(raw)) return defaultValue;
        if (bool.TryParse(raw.Trim(), out var parsed)) return parsed;

        warnings.Add($"{key} değeri ('{raw}') mantıksal bir değer olarak okunamadı; varsayılan {defaultValue} kullanılıyor.");
        return defaultValue;
    }

    private static double ReadDouble(
        IConfiguration configuration, string key, double defaultValue, double minimum, List<string> warnings)
    {
        var raw = configuration[key];
        if (string.IsNullOrWhiteSpace(raw)) return defaultValue;

        if (!double.TryParse(raw.Trim(), System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            warnings.Add($"{key} değeri ('{raw}') sayı olarak okunamadı; varsayılan {defaultValue} kullanılıyor.");
            return defaultValue;
        }

        if (parsed < minimum)
        {
            warnings.Add($"{key} değeri ({parsed}) izin verilen en küçük değerin ({minimum}) altında; {minimum} kullanılıyor.");
            return minimum;
        }

        return parsed;
    }

    private static decimal ReadDecimal(
        IConfiguration configuration, string key, decimal defaultValue, decimal minimum, List<string> warnings)
    {
        var raw = configuration[key];
        if (string.IsNullOrWhiteSpace(raw)) return defaultValue;

        if (!decimal.TryParse(raw.Trim(), System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            warnings.Add($"{key} değeri ('{raw}') tutar olarak okunamadı; varsayılan {defaultValue} kullanılıyor.");
            return defaultValue;
        }

        if (parsed < minimum)
        {
            warnings.Add($"{key} değeri ({parsed}) izin verilen en küçük tutarın ({minimum}) altında; {minimum} kullanılıyor.");
            return minimum;
        }

        return parsed;
    }

    private static IReadOnlyList<DemoLocation> ReadLocations(IConfiguration configuration, List<string> warnings)
    {
        var raw = configuration[LocationsKey];
        if (string.IsNullOrWhiteSpace(raw)) return DemoLocationCatalogue.All;

        var names = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var resolved = DemoLocationCatalogue.Resolve(names, out var unknown);

        if (unknown.Count > 0)
        {
            warnings.Add(
                $"{LocationsKey} içindeki şu konumlar katalogda bulunamadı ve yok sayıldı: {string.Join(", ", unknown)}. " +
                $"Geçerli konumlar: {string.Join(", ", DemoLocationCatalogue.All.Select(x => x.City))}.");
        }

        if (resolved.Count == 0)
        {
            warnings.Add($"{LocationsKey} hiçbir geçerli konum içermiyor; katalogun tamamı kullanılıyor.");
            return DemoLocationCatalogue.All;
        }

        return resolved;
    }
}
