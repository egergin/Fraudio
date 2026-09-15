namespace Fraudio.Infrastructure.Messaging;

public static class RabbitMqNames
{
    public const string Exchange = "fraudio.exchange";

    public const string TransactionReceivedKey = "transaction.received";
    public const string FraudDetectedKey = "fraud.detected";

    public const string TransactionQueue = "transaction.queue";
    public const string NotificationQueue = "notification.queue";

    public const string TransactionDlq = "transaction.dlq";
    public const string NotificationDlq = "notification.dlq";
}
