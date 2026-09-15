using Fraudio.Api.Models;
using Fraudio.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fraudio.Api.Controllers;

[ApiController]
[Route("api/system")]
[Authorize(Roles = "Admin")]
public sealed class SystemController : ControllerBase
{
    private readonly ISystemHealthService _health;

    public SystemController(ISystemHealthService health)
    {
        _health = health;
    }

    [HttpGet("health")]
    public async Task<ActionResult<HealthResponse>> GetHealth(CancellationToken cancellationToken) =>
        Ok(await _health.CheckAsync(cancellationToken));
}
