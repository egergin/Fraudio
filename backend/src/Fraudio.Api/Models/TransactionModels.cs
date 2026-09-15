using System.ComponentModel.DataAnnotations;

namespace Fraudio.Api.Models;

public sealed class SubmitTransactionRequest
{
    [Required, StringLength(128, MinimumLength = 1)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public decimal Amount { get; set; }

    [Required, StringLength(128, MinimumLength = 1)]
    public string Location { get; set; } = string.Empty;
}

public sealed record SubmitTransactionResponse(Guid TransactionId, string Status);
