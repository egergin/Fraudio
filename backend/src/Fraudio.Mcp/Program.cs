using Fraudio.Mcp;

var builder = WebApplication.CreateBuilder(args);

var mcpSection = builder.Configuration.GetSection(McpOptions.SectionName);
builder.Services.Configure<McpOptions>(mcpSection);
var mcpOptions = mcpSection.Get<McpOptions>() ?? new McpOptions();
mcpOptions.Validate();

builder.Services.AddHttpClient<BackendClient>(client => client.Timeout = TimeSpan.FromSeconds(10));

builder.Services
    .AddMcpServer()
    .WithHttpTransport(o => o.Stateless = true)
    .WithTools<FraudTools>();

var app = builder.Build();

app.MapMcp("/mcp");

app.Run();
