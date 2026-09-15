namespace Fraudio.Domain.Fraud;

public static class LocationFraudRule
{
    public const double MaxTravelSpeedKmh = 800.0;
    private const double EarthRadiusKm = 6371.0;
    
    public static bool? IsViolated(
        GeoPoint? previous, DateTime previousAt,
        GeoPoint? current, DateTime currentAt)
    {
        if (current is null)
        {
            return null;
        }

        if (previous is null)
        {
            return false;
        }

        var distanceKm = DistanceKm(previous, current);
        var required = TimeSpan.FromHours(distanceKm / MaxTravelSpeedKmh);
        var actual = currentAt - previousAt;
        return actual < required;
    }

    public static double DistanceKm(GeoPoint a, GeoPoint b)
    {
        var lat1 = ToRadians(a.Latitude);
        var lat2 = ToRadians(b.Latitude);
        var dLat = lat2 - lat1;
        var dLon = ToRadians(b.Longitude - a.Longitude);

        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1) * Math.Cos(lat2) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * EarthRadiusKm * Math.Asin(Math.Sqrt(h));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
