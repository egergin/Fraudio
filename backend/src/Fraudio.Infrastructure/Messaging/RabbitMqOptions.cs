namespace Fraudio.Infrastructure.Messaging;

public sealed class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string Username { get; set; } = "fraud";
    public string Password { get; set; } = string.Empty;
    public string Exchange { get; set; } = RabbitMqNames.Exchange;
}
