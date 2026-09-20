using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Voytek.Api.Agents;
using Voytek.Api.Budgets;
using Voytek.Api.Identity;
using Voytek.Api.Objectives;
using Voytek.Api.Policies;
using Voytek.Api.Outcomes;
using Voytek.Api.SaasManagement;
using Voytek.Domain.Authorizations;
using Voytek.Domain.Policies;
using Voytek.Infrastructure.Authorizations;
using Voytek.Infrastructure.AI;
using Voytek.Application.AI;
using Voytek.Application.Notifications;
using Voytek.Application.Storage;
using Voytek.Infrastructure.Notifications;
using Voytek.Infrastructure.Storage;
using Voytek.Domain.Agents;
using Voytek.Domain.Budgets;
using Voytek.Domain.Objectives;
using Voytek.Domain.Tenancy;
using Voytek.Infrastructure.Identity;
using Voytek.Infrastructure.Persistence;
using Voytek.SharedKernel.Tenancy;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    LoadLocalEnvironmentFile(builder.Configuration, builder.Environment.ContentRootPath);
}

var connectionString = builder.Configuration.GetConnectionString("VoytekDatabase")
    ?? throw new InvalidOperationException(
        "A connection string 'ConnectionStrings__VoytekDatabase' must be configured.");

builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ICurrentTenant>(serviceProvider => serviceProvider.GetRequiredService<TenantContext>());
builder.Services.AddDbContext<VoytekDbContext>(options => options.UseNpgsql(connectionString));
var redisConnection = builder.Configuration["Redis:Configuration"];
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options => options.Configuration = redisConnection);
}
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
})
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<VoytekDbContext>();

var jwtSigningKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey must be configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "voytek";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "voytek-api";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("frontend", policy => policy
    .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddHttpClient("agent-search", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Voytek/1.0 agent-search");
});
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<AgentSearchService>();
builder.Services.AddScoped<AuthorizationDecisionService>();
builder.Services.Configure<LlmOptions>(builder.Configuration.GetSection(LlmOptions.SectionName));
builder.Services.PostConfigure<LlmOptions>(options => options.ApiKey = builder.Configuration["OPENAI_API_KEY"]);
if (string.Equals(builder.Configuration["AI:Provider"], "openai", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddHttpClient<OpenAiLlmProvider>(client =>
    {
        client.BaseAddress = new Uri("https://api.openai.com/v1/");
        client.Timeout = TimeSpan.FromSeconds(builder.Configuration.GetValue("AI:TimeoutSeconds", 30));
    });
    builder.Services.AddScoped<ILLMProvider>(serviceProvider => serviceProvider.GetRequiredService<OpenAiLlmProvider>());
}
else
{
    builder.Services.AddSingleton<ILLMProvider, DisabledLlmProvider>();
}
builder.Services.AddSingleton<INotificationService, DisabledNotificationService>();
builder.Services.AddSingleton<IObjectStorage, DisabledObjectStorage>();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("ai-proposals", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddHealthChecks()
    .AddDbContextCheck<VoytekDbContext>("postgresql");

var app = builder.Build();

await using (var migrationScope = app.Services.CreateAsyncScope())
{
    var dbContext = migrationScope.ServiceProvider.GetRequiredService<VoytekDbContext>();
    var connection = dbContext.Database.GetDbConnection();
    await connection.OpenAsync();
    await using var migrationLock = connection.CreateCommand();
    migrationLock.CommandText = "SELECT pg_advisory_lock(741932);";
    await migrationLock.ExecuteNonQueryAsync();
    try
    {
        await dbContext.Database.MigrateAsync();
    }
    finally
    {
        migrationLock.CommandText = "SELECT pg_advisory_unlock(741932);";
        await migrationLock.ExecuteNonQueryAsync();
        await connection.CloseAsync();
    }
}

app.UseForwardedHeaders();
app.UseCors("frontend");
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault() ?? Guid.NewGuid().ToString("N");
    context.TraceIdentifier = correlationId;
    context.Response.Headers["X-Correlation-ID"] = correlationId;
    await next();
});
app.UseRateLimiter();
app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (!context.User.Identity?.IsAuthenticated == true && context.Request.Headers.TryGetValue("X-Voytek-Api-Key", out var apiKey))
    {
        var rawKey = apiKey.ToString();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawKey)));
        var dbContext = context.RequestServices.GetRequiredService<VoytekDbContext>();
        var credential = await dbContext.ApiCredentials.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.SecretHash == hash && item.RevokedAtUtc == null, context.RequestAborted);
        if (credential is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        context.RequestServices.GetRequiredService<TenantContext>().SetTenant(credential.TenantId);
    }

    var tenantIdClaim = context.User.FindFirstValue("tenant_id");
    if (Guid.TryParse(tenantIdClaim, out var tenantId))
    {
        context.RequestServices.GetRequiredService<TenantContext>().SetTenant(tenantId);
    }

    await next();
});
app.UseAuthorization();

app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false
});
app.MapHealthChecks("/health/ready");

var auth = app.MapGroup("/api/v1/auth");

auth.MapPost("/register", async (
    RegisterRequest request,
    UserManager<ApplicationUser> userManager,
    VoytekDbContext dbContext,
    TenantContext tenantContext,
    JwtTokenService tokenService,
    CancellationToken cancellationToken) =>
{
    if (!IsValidRegistration(request, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
    var user = new ApplicationUser
    {
        Id = Guid.NewGuid(),
        UserName = request.Email.Trim(),
        Email = request.Email.Trim()
    };
    var createUserResult = await userManager.CreateAsync(user, request.Password);
    if (!createUserResult.Succeeded)
    {
        return Results.ValidationProblem(ToValidationErrors(createUserResult.Errors));
    }

    var tenant = new Tenant(
        Guid.NewGuid(),
        request.OrganizationName,
        request.OrganizationSlug,
        DateTimeOffset.UtcNow);
    dbContext.Tenants.Add(tenant);
    tenantContext.SetTenant(tenant.Id);
    dbContext.Memberships.Add(new Membership(
        Guid.NewGuid(),
        tenant.Id,
        user.Id,
        MembershipRole.Owner,
        DateTimeOffset.UtcNow));
    await dbContext.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);

    return Results.Created(
        $"/api/v1/tenants/{tenant.Id}",
        new AuthenticationResponse(
            tokenService.Create(user, tenant.Id, MembershipRole.Owner),
            user.Id,
            [new TenantMembershipResponse(tenant.Id, MembershipRole.Owner.ToString())]));
});

auth.MapPost("/login", async (
    LoginRequest request,
    UserManager<ApplicationUser> userManager,
    VoytekDbContext dbContext,
    JwtTokenService tokenService) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["credentials"] = ["Email and password are required."]
        });
    }

    var user = await userManager.FindByEmailAsync(request.Email.Trim());
    if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
    {
        return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid credentials.");
    }

    var memberships = await dbContext.Memberships
        .IgnoreQueryFilters()
        .Where(membership => membership.UserId == user.Id)
        .Select(membership => new TenantMembershipResponse(
            membership.TenantId,
            membership.Role.ToString()))
        .ToListAsync();

    return Results.Ok(new AuthenticationResponse(tokenService.Create(user), user.Id, memberships));
});

auth.MapPost("/select-tenant", async (
    SelectTenantRequest request,
    ClaimsPrincipal principal,
    UserManager<ApplicationUser> userManager,
    VoytekDbContext dbContext,
    JwtTokenService tokenService) =>
{
    var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!Guid.TryParse(userId, out var parsedUserId))
    {
        return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid authentication token.");
    }

    var membership = await dbContext.Memberships
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(item => item.UserId == parsedUserId && item.TenantId == request.TenantId);
    if (membership is null)
    {
        return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "You are not a member of this tenant.");
    }

    var user = await userManager.FindByIdAsync(parsedUserId.ToString());
    return user is null
        ? Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "User no longer exists.")
        : Results.Ok(new AuthenticationResponse(
            tokenService.Create(user, membership.TenantId, membership.Role),
            user.Id,
            [new TenantMembershipResponse(membership.TenantId, membership.Role.ToString())]));
}).RequireAuthorization();

var agents = app.MapGroup("/api/v1/agents")
    .RequireAuthorization(policy => policy.RequireClaim("tenant_id"));
app.MapGet("/api/v1/agent-templates", () => Results.Ok(AgentSearchService.ListTemplates()))
    .RequireAuthorization();
var agentManagers = agents.MapGroup(string.Empty)
    .RequireAuthorization(policy => policy.RequireRole(
        MembershipRole.Owner.ToString(),
        MembershipRole.Admin.ToString(),
        MembershipRole.Manager.ToString()));

agents.MapGet(string.Empty, async (VoytekDbContext dbContext) =>
{
    var entries = await dbContext.Agents
        .OrderBy(agent => agent.Name)
        .ToListAsync();
    return Results.Ok(entries.Select(ToAgentResponse));
});

agents.MapGet("/{agentId:guid}", async (Guid agentId, VoytekDbContext dbContext) =>
{
    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == agentId);
    return agent is null ? Results.NotFound() : Results.Ok(ToAgentResponse(agent));
});

agents.MapPost("/{agentId:guid}/run", async (
    Guid agentId,
    AgentRunRequest request,
    VoytekDbContext dbContext,
    AgentSearchService searchService,
    CancellationToken cancellationToken) =>
{
    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == agentId, cancellationToken);
    if (agent is null) return Results.NotFound();
    if (agent.Status != AgentStatus.Active || agent.KillSwitchActivatedAtUtc is not null)
    {
        return Results.Conflict(new { message = "Only active agents without an enabled kill switch can run." });
    }

    try
    {
        return Results.Ok(await searchService.RunAsync(agent.Id, request, cancellationToken));
    }
    catch (ArgumentException exception)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["templateId"] = [exception.Message] });
    }
});

agentManagers.MapPost(string.Empty, async (
    CreateAgentRequest request,
    TenantContext tenantContext,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (!IsValidAgent(request.Name, request.Description, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    var now = DateTimeOffset.UtcNow;
    var agent = new Agent(
        Guid.NewGuid(),
        tenantContext.TenantId!.Value,
        request.Name,
        request.Description,
        request.AutonomyLevel,
        now);
    dbContext.Agents.Add(agent);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/v1/agents/{agent.Id}", ToAgentResponse(agent));
});

agentManagers.MapPut("/{agentId:guid}", async (
    Guid agentId,
    UpdateAgentRequest request,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (!IsValidAgent(request.Name, request.Description, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == agentId);
    if (agent is null)
    {
        return Results.NotFound();
    }

    agent.Update(request.Name, request.Description, request.AutonomyLevel, DateTimeOffset.UtcNow);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(ToAgentResponse(agent));
});

agentManagers.MapPost("/{agentId:guid}/activate", (Guid agentId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeAgentState(agentId, dbContext, cancellationToken, agent => agent.Activate(DateTimeOffset.UtcNow)));
agentManagers.MapPost("/{agentId:guid}/suspend", (Guid agentId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeAgentState(agentId, dbContext, cancellationToken, agent => agent.Suspend(DateTimeOffset.UtcNow)));
agentManagers.MapPost("/{agentId:guid}/disable", (Guid agentId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeAgentState(agentId, dbContext, cancellationToken, agent => agent.Disable(DateTimeOffset.UtcNow)));
agentManagers.MapPost("/{agentId:guid}/kill-switch/activate", (Guid agentId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeAgentState(agentId, dbContext, cancellationToken, agent => agent.ActivateKillSwitch(DateTimeOffset.UtcNow)));
agentManagers.MapPost("/{agentId:guid}/kill-switch/deactivate", (Guid agentId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeAgentState(agentId, dbContext, cancellationToken, agent => agent.DeactivateKillSwitch(DateTimeOffset.UtcNow)));
agentManagers.MapPost("/{agentId:guid}/proposals", async (
    Guid agentId,
    GenerateAgentProposalRequest request,
    TenantContext tenantContext,
    VoytekDbContext dbContext,
    ILLMProvider llmProvider,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Instruction) || request.Instruction.Length > 4_000)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["instruction"] = ["Instruction is required and must not exceed 4,000 characters."]
        });
    }

    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == agentId, cancellationToken);
    if (agent is null)
    {
        return Results.NotFound();
    }

    if (agent.Status != AgentStatus.Active || agent.KillSwitchActivatedAtUtc is not null)
    {
        return Results.Conflict(new { message = "Only active agents without an enabled kill switch can generate proposals." });
    }

    var proposal = await llmProvider.ProposeAsync(
        new LlmProposalRequest(tenantContext.TenantId!.Value, agent.Id, request.Instruction.Trim(), httpContext.TraceIdentifier),
        cancellationToken);
    return Results.Ok(proposal);
}).RequireRateLimiting("ai-proposals");

var objectives = app.MapGroup("/api/v1/objectives")
    .RequireAuthorization(policy => policy.RequireClaim("tenant_id"));
var objectiveManagers = objectives.MapGroup(string.Empty)
    .RequireAuthorization(policy => policy.RequireRole(
        MembershipRole.Owner.ToString(),
        MembershipRole.Admin.ToString(),
        MembershipRole.Manager.ToString()));

objectives.MapGet(string.Empty, async (VoytekDbContext dbContext) =>
{
    var entries = await dbContext.Objectives
        .OrderBy(objective => objective.Name)
        .ToListAsync();
    return Results.Ok(entries.Select(ToObjectiveResponse));
});

objectives.MapGet("/{objectiveId:guid}", async (Guid objectiveId, VoytekDbContext dbContext) =>
{
    var objective = await dbContext.Objectives.SingleOrDefaultAsync(item => item.Id == objectiveId);
    return objective is null ? Results.NotFound() : Results.Ok(ToObjectiveResponse(objective));
});

objectiveManagers.MapPost(string.Empty, async (
    CreateObjectiveRequest request,
    TenantContext tenantContext,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (!IsValidObjective(request.Name, request.Description, request.StartDate, request.EndDate, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == request.AgentId, cancellationToken);
    if (agent is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["agentId"] = ["Agent was not found in the current tenant."]
        });
    }

    var now = DateTimeOffset.UtcNow;
    var objective = new Objective(
        Guid.NewGuid(),
        tenantContext.TenantId!.Value,
        agent.Id,
        request.Name,
        request.Description,
        request.StartDate,
        request.EndDate,
        now);
    dbContext.Objectives.Add(objective);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Created($"/api/v1/objectives/{objective.Id}", ToObjectiveResponse(objective));
});

objectiveManagers.MapPut("/{objectiveId:guid}", async (
    Guid objectiveId,
    UpdateObjectiveRequest request,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (!IsValidObjective(request.Name, request.Description, request.StartDate, request.EndDate, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    var objective = await dbContext.Objectives.SingleOrDefaultAsync(item => item.Id == objectiveId, cancellationToken);
    if (objective is null)
    {
        return Results.NotFound();
    }

    objective.Update(request.Name, request.Description, request.StartDate, request.EndDate, DateTimeOffset.UtcNow);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(ToObjectiveResponse(objective));
});

objectiveManagers.MapPost("/{objectiveId:guid}/activate", (Guid objectiveId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeObjectiveState(objectiveId, dbContext, cancellationToken, objective => objective.Activate(DateTimeOffset.UtcNow), true));
objectiveManagers.MapPost("/{objectiveId:guid}/complete", (Guid objectiveId, VoytekDbContext dbContext, CancellationToken cancellationToken) =>
    ChangeObjectiveState(objectiveId, dbContext, cancellationToken, objective => objective.Complete(DateTimeOffset.UtcNow), false));

var budgets = app.MapGroup("/api/v1/budgets")
    .RequireAuthorization(policy => policy.RequireClaim("tenant_id"));
var budgetManagers = budgets.MapGroup(string.Empty)
    .RequireAuthorization(policy => policy.RequireRole(
        MembershipRole.Owner.ToString(),
        MembershipRole.Admin.ToString(),
        MembershipRole.Manager.ToString()));

budgets.MapGet(string.Empty, async (VoytekDbContext dbContext) =>
{
    var entries = await dbContext.Budgets
        .OrderBy(budget => budget.Name)
        .ToListAsync();
    return Results.Ok(entries.Select(ToBudgetResponse));
});

budgets.MapGet("/{budgetId:guid}", async (Guid budgetId, VoytekDbContext dbContext) =>
{
    var budget = await dbContext.Budgets.SingleOrDefaultAsync(item => item.Id == budgetId);
    return budget is null ? Results.NotFound() : Results.Ok(ToBudgetResponse(budget));
});

budgetManagers.MapPost(string.Empty, async (
    CreateBudgetRequest request,
    TenantContext tenantContext,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (!IsValidBudget(request, out var errors))
    {
        return Results.ValidationProblem(errors);
    }

    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == request.AgentId, cancellationToken);
    if (agent is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["agentId"] = ["Agent was not found in the current tenant."]
        });
    }

    if (request.ObjectiveId is not null)
    {
        var objective = await dbContext.Objectives.SingleOrDefaultAsync(
            item => item.Id == request.ObjectiveId.Value,
            cancellationToken);
        if (objective is null || objective.AgentId != agent.Id)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["objectiveId"] = ["Objective was not found for the specified agent in the current tenant."]
            });
        }
    }

    var now = DateTimeOffset.UtcNow;
    var budget = new Budget(
        Guid.NewGuid(),
        tenantContext.TenantId!.Value,
        agent.Id,
        request.ObjectiveId,
        request.Name,
        request.TotalAmount,
        request.Currency,
        now);
    dbContext.Budgets.Add(budget);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Created($"/api/v1/budgets/{budget.Id}", ToBudgetResponse(budget));
});

budgetManagers.MapPost("/{budgetId:guid}/close", async (
    Guid budgetId,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var budget = await dbContext.Budgets.SingleOrDefaultAsync(item => item.Id == budgetId, cancellationToken);
    if (budget is null)
    {
        return Results.NotFound();
    }

    try
    {
        budget.Close(DateTimeOffset.UtcNow);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToBudgetResponse(budget));
    }
    catch (InvalidOperationException exception)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["budget"] = [exception.Message]
        });
    }
});

var policies = app.MapGroup("/api/v1/policies").RequireAuthorization(p => p.RequireClaim("tenant_id"));
var policyManagers = policies.MapGroup(string.Empty).RequireAuthorization(p => p.RequireRole(MembershipRole.Owner.ToString(), MembershipRole.Admin.ToString(), MembershipRole.Manager.ToString()));
policies.MapGet(string.Empty, async (VoytekDbContext db) => Results.Ok(await db.Policies.OrderBy(x => x.Name).ToListAsync()));
policyManagers.MapPost(string.Empty, async (CreatePolicyRequest request, TenantContext tenant, VoytekDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ActionType)) return Results.ValidationProblem(new Dictionary<string,string[]> { ["policy"]=["Name and action type are required."] });
    var agent=await db.Agents.SingleOrDefaultAsync(x=>x.Id==request.AgentId,ct); if(agent is null) return Results.NotFound();
    try { var policy=new Policy(Guid.NewGuid(),tenant.TenantId!.Value,agent.Id,request.Name,request.ActionType,request.MaximumAmount,request.ApprovalThreshold,DateTimeOffset.UtcNow); db.Policies.Add(policy); await db.SaveChangesAsync(ct); return Results.Created($"/api/v1/policies/{policy.Id}",policy); } catch(ArgumentException e) { return Results.ValidationProblem(new Dictionary<string,string[]> { ["policy"]=[e.Message] }); }
});
policyManagers.MapPost("/{policyId:guid}/deactivate", async(Guid policyId,VoytekDbContext db,CancellationToken ct)=> { var policy=await db.Policies.SingleOrDefaultAsync(x=>x.Id==policyId,ct); if(policy is null)return Results.NotFound(); policy.Deactivate(DateTimeOffset.UtcNow); await db.SaveChangesAsync(ct); return Results.Ok(policy); });

var authorizations = app.MapGroup("/api/v1/authorizations").RequireAuthorization(p => p.RequireClaim("tenant_id"));
authorizations.MapPost(string.Empty, async (AuthorizationRequestDto request, AuthorizationDecisionService service, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.ActionType) || string.IsNullOrWhiteSpace(request.Currency) || string.IsNullOrWhiteSpace(request.Purpose) || string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.Amount <= 0) return Results.ValidationProblem(new Dictionary<string,string[]> { ["request"]=["Action type, currency, purpose, idempotency key and positive amount are required."] });
    var result=await service.EvaluateAsync(new AuthorizationEvaluationInput(request.AgentId,request.ObjectiveId,request.BudgetId,request.ActionType,request.Amount,request.Currency,request.Purpose,request.IdempotencyKey,request.ShadowMode),ct);
    return Results.Ok(new { result.Id, Decision=result.Decision.ToString(), result.DecisionReason, result.DecidedAtUtc });
});

var approvals = app.MapGroup("/api/v1/approvals").RequireAuthorization(p => p.RequireClaim("tenant_id"));
approvals.MapGet(string.Empty, async (VoytekDbContext db) => Results.Ok(await db.ApprovalRequests.OrderBy(x=>x.CreatedAtUtc).ToListAsync()));
approvals.MapPost("/{approvalId:guid}/approve", async (Guid approvalId, ClaimsPrincipal principal, VoytekDbContext db, CancellationToken ct) =>
{
    var approval=await db.ApprovalRequests.SingleOrDefaultAsync(x=>x.Id==approvalId,ct); if(approval is null)return Results.NotFound();
    if(!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier),out var userId))return Results.Unauthorized();
    var authorization=await db.AuthorizationRequests.SingleOrDefaultAsync(x=>x.Id==approval.AuthorizationRequestId,ct); if(authorization is null)return Results.NotFound();
    var budget=await db.Budgets.SingleOrDefaultAsync(x=>x.Id==authorization.BudgetId,ct); if(budget is null || authorization.Amount>budget.AvailableAmount)return Results.ValidationProblem(new Dictionary<string,string[]> { ["budget"]=["Budget no longer has sufficient available amount."] });
    try { var now=DateTimeOffset.UtcNow; budget.Reserve(authorization.Amount,now); approval.Approve(userId,now); db.LedgerEntries.Add(new Voytek.Domain.Ledger.LedgerEntry(Guid.NewGuid(),approval.TenantId,authorization.AgentId,authorization.ObjectiveId,budget.Id,authorization.Id,authorization.Amount,budget.Currency,Voytek.Domain.Ledger.LedgerEntryType.BudgetReserved,approval.Id.ToString(),now)); db.AuditEvents.Add(new Voytek.Domain.Audit.AuditEvent(Guid.NewGuid(),approval.TenantId,userId,"approval.approved","ApprovalRequest",approval.Id,approval.Id.ToString(),now)); await db.SaveChangesAsync(ct); return Results.Ok(approval); } catch(InvalidOperationException e) { return Results.ValidationProblem(new Dictionary<string,string[]> { ["approval"]=[e.Message] }); }
}).RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString(),MembershipRole.Manager.ToString()));
approvals.MapPost("/{approvalId:guid}/reject", async (Guid approvalId, ClaimsPrincipal principal, VoytekDbContext db, CancellationToken ct) =>
{
    var approval=await db.ApprovalRequests.SingleOrDefaultAsync(x=>x.Id==approvalId,ct); if(approval is null)return Results.NotFound();
    if(!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier),out var userId))return Results.Unauthorized();
    try { var now=DateTimeOffset.UtcNow; approval.Reject(userId,now); db.AuditEvents.Add(new Voytek.Domain.Audit.AuditEvent(Guid.NewGuid(),approval.TenantId,userId,"approval.rejected","ApprovalRequest",approval.Id,approval.Id.ToString(),now)); await db.SaveChangesAsync(ct); return Results.Ok(approval); } catch(InvalidOperationException e) { return Results.ValidationProblem(new Dictionary<string,string[]> { ["approval"]=[e.Message] }); }
}).RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString(),MembershipRole.Manager.ToString()));

var shadow = app.MapGroup("/api/v1/shadow").RequireAuthorization(p=>p.RequireClaim("tenant_id"));
shadow.MapGet(string.Empty, async (VoytekDbContext db) => Results.Ok(await db.ShadowActions.OrderByDescending(x=>x.CreatedAtUtc).ToListAsync()));
app.MapGroup("/api/v1/ledger").RequireAuthorization(p=>p.RequireClaim("tenant_id"))
    .MapGet(string.Empty, async (VoytekDbContext db) => Results.Ok(await db.LedgerEntries.OrderByDescending(x=>x.CreatedAtUtc).ToListAsync()));
app.MapGroup("/api/v1/audit").RequireAuthorization(p=>p.RequireClaim("tenant_id"))
    .MapGet(string.Empty, async (VoytekDbContext db) => Results.Ok(await db.AuditEvents.OrderByDescending(x=>x.CreatedAtUtc).ToListAsync()));
var saas=app.MapGroup("/api/v1/saas-subscriptions").RequireAuthorization(p=>p.RequireClaim("tenant_id"));
saas.MapGet(string.Empty,async(VoytekDbContext db)=>Results.Ok(await db.SaasSubscriptions.OrderBy(x=>x.ProductName).ToListAsync()));
saas.MapPost(string.Empty,async(CreateSaasSubscriptionRequest request,TenantContext tenant,VoytekDbContext db,CancellationToken ct)=>{if(string.IsNullOrWhiteSpace(request.Provider)||string.IsNullOrWhiteSpace(request.ProductName)||request.MonthlyCost<0||request.PurchasedSeats<0||request.ActiveUsers<0||request.ActiveUsers>request.PurchasedSeats)return Results.ValidationProblem(new Dictionary<string,string[]> { ["subscription"]=["Invalid subscription data."] });try{var subscription=new Voytek.Domain.SaasManagement.SaasSubscription(Guid.NewGuid(),tenant.TenantId!.Value,request.AgentId,request.Provider,request.ProductName,request.MonthlyCost,request.Currency,request.PurchasedSeats,request.ActiveUsers,request.RenewalDate,DateTimeOffset.UtcNow);db.SaasSubscriptions.Add(subscription);await db.SaveChangesAsync(ct);return Results.Created($"/api/v1/saas-subscriptions/{subscription.Id}",subscription);}catch(ArgumentException e){return Results.ValidationProblem(new Dictionary<string,string[]> { ["subscription"]=[e.Message] });}}).RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString(),MembershipRole.Manager.ToString()));
saas.MapPost("/analyze",async(TenantContext tenant,VoytekDbContext db,CancellationToken ct)=>{var now=DateOnly.FromDateTime(DateTime.UtcNow);var subscriptions=await db.SaasSubscriptions.Where(x=>x.Status==Voytek.Domain.SaasManagement.SaasSubscriptionStatus.Active).ToListAsync(ct);foreach(var item in subscriptions){if(item.ActiveUsers==0)db.SaasRecommendations.Add(new Voytek.Domain.SaasManagement.SaasRecommendation(Guid.NewGuid(),tenant.TenantId!.Value,item.Id,Voytek.Domain.SaasManagement.SaasRecommendationType.ReviewUnusedSubscription,"No active users were reported.",DateTimeOffset.UtcNow));if(item.RenewalDate is not null&&item.RenewalDate<=now.AddDays(30))db.SaasRecommendations.Add(new Voytek.Domain.SaasManagement.SaasRecommendation(Guid.NewGuid(),tenant.TenantId!.Value,item.Id,Voytek.Domain.SaasManagement.SaasRecommendationType.ReviewUpcomingRenewal,"Renewal is due within 30 days.",DateTimeOffset.UtcNow));}await db.SaveChangesAsync(ct);return Results.Ok(await db.SaasRecommendations.OrderByDescending(x=>x.CreatedAtUtc).ToListAsync(ct));}).RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString(),MembershipRole.Manager.ToString()));
var credentials=app.MapGroup("/api/v1/api-credentials").RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString()));
credentials.MapPost("/{name}",async(string name,TenantContext tenant,VoytekDbContext db,CancellationToken ct)=>{if(string.IsNullOrWhiteSpace(name))return Results.ValidationProblem(new Dictionary<string,string[]> { ["name"]=["Name is required."] });var secret=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var prefix=secret[..12];var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));var credential=new Voytek.Domain.Identity.ApiCredential(Guid.NewGuid(),tenant.TenantId!.Value,name.Trim(),prefix,hash,DateTimeOffset.UtcNow);db.ApiCredentials.Add(credential);await db.SaveChangesAsync(ct);return Results.Created($"/api/v1/api-credentials/{credential.Id}",new {credential.Id,credential.Name,credential.Prefix,Secret=secret});});
credentials.MapGet(string.Empty,async(VoytekDbContext db)=>Results.Ok(await db.ApiCredentials.Select(x=>new{x.Id,x.Name,x.Prefix,x.CreatedAtUtc,x.RevokedAtUtc}).ToListAsync()));
credentials.MapPost("/{id:guid}/revoke",async(Guid id,VoytekDbContext db,CancellationToken ct)=>{var credential=await db.ApiCredentials.SingleOrDefaultAsync(x=>x.Id==id,ct);if(credential is null)return Results.NotFound();credential.Revoke(DateTimeOffset.UtcNow);await db.SaveChangesAsync(ct);return Results.NoContent();});
var outcomes=app.MapGroup("/api/v1/outcomes").RequireAuthorization(p=>p.RequireClaim("tenant_id"));
outcomes.MapGet(string.Empty,async(VoytekDbContext db)=>Results.Ok(await db.OutcomeRecords.OrderByDescending(x=>x.CreatedAtUtc).ToListAsync()));
outcomes.MapPost(string.Empty,async(CreateOutcomeRequest request,TenantContext tenant,VoytekDbContext db,CancellationToken ct)=>{if(string.IsNullOrWhiteSpace(request.Metric)||string.IsNullOrWhiteSpace(request.Unit))return Results.ValidationProblem(new Dictionary<string,string[]> { ["outcome"]=["Metric and unit are required."] });var objective=await db.Objectives.SingleOrDefaultAsync(x=>x.Id==request.ObjectiveId,ct);if(objective is null||objective.AgentId!=request.AgentId)return Results.ValidationProblem(new Dictionary<string,string[]> { ["objectiveId"]=["Objective does not belong to the agent in this tenant."] });var outcome=new Voytek.Domain.Outcomes.OutcomeRecord(Guid.NewGuid(),tenant.TenantId!.Value,request.AgentId,request.ObjectiveId,request.AuthorizationId,request.Metric.Trim(),request.Value,request.Unit.Trim(),request.Description?.Trim(),DateTimeOffset.UtcNow);db.OutcomeRecords.Add(outcome);await db.SaveChangesAsync(ct);return Results.Created($"/api/v1/outcomes/{outcome.Id}",outcome);}).RequireAuthorization(p=>p.RequireRole(MembershipRole.Owner.ToString(),MembershipRole.Admin.ToString(),MembershipRole.Manager.ToString()));

app.Run();

static bool IsValidRegistration(RegisterRequest request, out Dictionary<string, string[]> errors)
{
    errors = new Dictionary<string, string[]>();
    if (!new EmailAddressAttribute().IsValid(request.Email))
    {
        errors["email"] = ["A valid email address is required."];
    }

    if (string.IsNullOrWhiteSpace(request.Password))
    {
        errors["password"] = ["Password is required."];
    }

    if (string.IsNullOrWhiteSpace(request.OrganizationName) || request.OrganizationName.Trim().Length > 200)
    {
        errors["organizationName"] = ["Organization name must contain between 1 and 200 characters."];
    }

    var slug = request.OrganizationSlug?.Trim() ?? string.Empty;
    if (slug.Length is < 1 or > 100 || !System.Text.RegularExpressions.Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
    {
        errors["organizationSlug"] = ["Organization slug must use lowercase letters, numbers, and single hyphens."];
    }

    return errors.Count == 0;
}

static Dictionary<string, string[]> ToValidationErrors(IEnumerable<IdentityError> identityErrors) =>
    identityErrors
        .GroupBy(error => error.Code)
        .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray());

static void LoadLocalEnvironmentFile(ConfigurationManager configuration, string contentRoot)
{
    for (var directory = new DirectoryInfo(contentRoot); directory is not null; directory = directory.Parent)
    {
        var path = Path.Combine(directory.FullName, ".env");
        if (!File.Exists(path))
        {
            continue;
        }

        foreach (var line in File.ReadLines(path))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0 || trimmed.StartsWith('#'))
            {
                continue;
            }

            var separator = trimmed.IndexOf('=');
            if (separator <= 0)
            {
                continue;
            }

            var environmentKey = trimmed[..separator].Trim();
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(environmentKey)))
            {
                continue;
            }

            var configurationKey = environmentKey.Replace("__", ":", StringComparison.Ordinal);
            configuration[configurationKey] = trimmed[(separator + 1)..].Trim();
        }

        return;
    }
}

static bool IsValidAgent(string name, string? description, out Dictionary<string, string[]> errors)
{
    errors = new Dictionary<string, string[]>();
    if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 150)
    {
        errors["name"] = ["Agent name must contain between 1 and 150 characters."];
    }

    if (description?.Length > 2_000)
    {
        errors["description"] = ["Agent description cannot exceed 2,000 characters."];
    }

    return errors.Count == 0;
}

static AgentResponse ToAgentResponse(Agent agent) => new(
    agent.Id,
    agent.Name,
    agent.Description,
    agent.Status.ToString(),
    agent.AutonomyLevel.ToString(),
    agent.CreatedAtUtc,
    agent.UpdatedAtUtc,
    agent.KillSwitchActivatedAtUtc);

static async Task<IResult> ChangeAgentState(
    Guid agentId,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken,
    Action<Agent> change)
{
    var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == agentId, cancellationToken);
    if (agent is null)
    {
        return Results.NotFound();
    }

    try
    {
        change(agent);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToAgentResponse(agent));
    }
    catch (InvalidOperationException exception)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["agent"] = [exception.Message]
        });
    }
}

static bool IsValidObjective(
    string name,
    string? description,
    DateOnly startDate,
    DateOnly? endDate,
    out Dictionary<string, string[]> errors)
{
    errors = new Dictionary<string, string[]>();
    if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 200)
    {
        errors["name"] = ["Objective name must contain between 1 and 200 characters."];
    }

    if (description?.Length > 4_000)
    {
        errors["description"] = ["Objective description cannot exceed 4,000 characters."];
    }

    if (endDate is not null && endDate < startDate)
    {
        errors["endDate"] = ["End date cannot be before start date."];
    }

    return errors.Count == 0;
}

static ObjectiveResponse ToObjectiveResponse(Objective objective) => new(
    objective.Id,
    objective.AgentId,
    objective.Name,
    objective.Description,
    objective.Status.ToString(),
    objective.StartDate,
    objective.EndDate,
    objective.CreatedAtUtc,
    objective.UpdatedAtUtc);

static async Task<IResult> ChangeObjectiveState(
    Guid objectiveId,
    VoytekDbContext dbContext,
    CancellationToken cancellationToken,
    Action<Objective> change,
    bool requireActiveAgent)
{
    var objective = await dbContext.Objectives.SingleOrDefaultAsync(item => item.Id == objectiveId, cancellationToken);
    if (objective is null)
    {
        return Results.NotFound();
    }

    if (requireActiveAgent)
    {
        var agent = await dbContext.Agents.SingleOrDefaultAsync(item => item.Id == objective.AgentId, cancellationToken);
        if (agent is null || agent.Status != AgentStatus.Active || agent.KillSwitchActivatedAtUtc is not null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["agent"] = ["An objective can only be activated for an active agent without an active kill switch."]
            });
        }
    }

    try
    {
        change(objective);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToObjectiveResponse(objective));
    }
    catch (InvalidOperationException exception)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["objective"] = [exception.Message]
        });
    }
}

static bool IsValidBudget(CreateBudgetRequest request, out Dictionary<string, string[]> errors)
{
    errors = new Dictionary<string, string[]>();
    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 150)
    {
        errors["name"] = ["Budget name must contain between 1 and 150 characters."];
    }

    if (request.TotalAmount <= 0 || decimal.Round(request.TotalAmount, 2) != request.TotalAmount)
    {
        errors["totalAmount"] = ["Budget total must be positive with at most two decimal places."];
    }

    var currency = request.Currency?.Trim();
    if (currency is null || currency.Length != 3 || !currency.All(char.IsAsciiLetter))
    {
        errors["currency"] = ["Currency must be a three-letter ISO code."];
    }

    return errors.Count == 0;
}

static BudgetResponse ToBudgetResponse(Budget budget) => new(
    budget.Id,
    budget.AgentId,
    budget.ObjectiveId,
    budget.Name,
    budget.TotalAmount,
    budget.ReservedAmount,
    budget.SpentAmount,
    budget.AvailableAmount,
    budget.Currency,
    budget.Status.ToString(),
    budget.CreatedAtUtc,
    budget.UpdatedAtUtc);
