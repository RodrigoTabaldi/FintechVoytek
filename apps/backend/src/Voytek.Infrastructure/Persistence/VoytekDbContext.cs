using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Voytek.Domain.Agents;
using Voytek.Domain.Budgets;
using Voytek.Domain.Objectives;
using Voytek.Domain.Policies;
using Voytek.Domain.Authorizations;
using Voytek.Domain.Approvals;
using Voytek.Domain.ShadowMode;
using Voytek.Domain.Ledger;
using Voytek.Domain.Audit;
using Voytek.Domain.Outcomes;
using Voytek.Domain.Identity;
using Voytek.Domain.SaasManagement;
using Voytek.Domain.Tenancy;
using Voytek.Infrastructure.Identity;
using Voytek.SharedKernel.Tenancy;

namespace Voytek.Infrastructure.Persistence;

/// <summary>
/// Unidade de persistência do monólito modular. Os DbSets serão introduzidos junto
/// aos módulos de negócio, evitando um esquema especulativo no bootstrap.
/// </summary>
public sealed class VoytekDbContext(
    DbContextOptions<VoytekDbContext> options,
    ICurrentTenant currentTenant) : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    private readonly ICurrentTenant _currentTenant = currentTenant;
    public Guid CurrentTenantId => _currentTenant.TenantId ?? throw new InvalidOperationException("A tenant context is required.");

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Membership> Memberships => Set<Membership>();

    public DbSet<Agent> Agents => Set<Agent>();

    public DbSet<Objective> Objectives => Set<Objective>();

    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<AuthorizationRequest> AuthorizationRequests => Set<AuthorizationRequest>();
    public DbSet<ApprovalRequest> ApprovalRequests => Set<ApprovalRequest>();
    public DbSet<ShadowAction> ShadowActions => Set<ShadowAction>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<OutcomeRecord> OutcomeRecords => Set<OutcomeRecord>();
    public DbSet<ApiCredential> ApiCredentials => Set<ApiCredential>();
    public DbSet<SaasSubscription> SaasSubscriptions => Set<SaasSubscription>();
    public DbSet<SaasRecommendation> SaasRecommendations => Set<SaasRecommendation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(builder =>
        {
            builder.ToTable("tenants");
            builder.HasKey(tenant => tenant.Id);
            builder.Property(tenant => tenant.Name).HasMaxLength(200).IsRequired();
            builder.Property(tenant => tenant.Slug).HasMaxLength(100).IsRequired();
            builder.Property(tenant => tenant.CreatedAtUtc).IsRequired();
            builder.HasIndex(tenant => tenant.Slug).IsUnique();
        });

        modelBuilder.Entity<Membership>(builder =>
        {
            builder.ToTable("memberships");
            builder.HasKey(membership => membership.Id);
            builder.Property(membership => membership.TenantId).IsRequired();
            builder.Property(membership => membership.UserId).IsRequired();
            builder.Property(membership => membership.Role).HasConversion<string>().HasMaxLength(20).IsRequired();
            builder.Property(membership => membership.CreatedAtUtc).IsRequired();
            builder.HasIndex(membership => new { membership.TenantId, membership.UserId }).IsUnique();
            builder.HasIndex(membership => membership.TenantId);
            builder.HasOne(membership => membership.Tenant)
                .WithMany(tenant => tenant.Memberships)
                .HasForeignKey(membership => membership.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(membership => membership.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasQueryFilter(membership =>
                _currentTenant.TenantId.HasValue && membership.TenantId == _currentTenant.TenantId.Value);
        });

        modelBuilder.Entity<Agent>(builder =>
        {
            builder.ToTable("agents");
            builder.HasKey(agent => agent.Id);
            builder.Property(agent => agent.TenantId).IsRequired();
            builder.Property(agent => agent.Name).HasMaxLength(150).IsRequired();
            builder.Property(agent => agent.Description).HasMaxLength(2_000);
            builder.Property(agent => agent.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            builder.Property(agent => agent.AutonomyLevel).HasConversion<string>().HasMaxLength(20).IsRequired();
            builder.Property(agent => agent.CreatedAtUtc).IsRequired();
            builder.Property(agent => agent.UpdatedAtUtc).IsRequired();
            builder.HasIndex(agent => new { agent.TenantId, agent.Status });
            builder.HasQueryFilter(agent =>
                _currentTenant.TenantId.HasValue && agent.TenantId == _currentTenant.TenantId.Value);
        });

        modelBuilder.Entity<Objective>(builder =>
        {
            builder.ToTable("objectives");
            builder.HasKey(objective => objective.Id);
            builder.Property(objective => objective.TenantId).IsRequired();
            builder.Property(objective => objective.AgentId).IsRequired();
            builder.Property(objective => objective.Name).HasMaxLength(200).IsRequired();
            builder.Property(objective => objective.Description).HasMaxLength(4_000);
            builder.Property(objective => objective.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            builder.Property(objective => objective.StartDate).IsRequired();
            builder.Property(objective => objective.CreatedAtUtc).IsRequired();
            builder.Property(objective => objective.UpdatedAtUtc).IsRequired();
            builder.HasIndex(objective => new { objective.TenantId, objective.AgentId, objective.Status });
            builder.HasOne<Agent>()
                .WithMany()
                .HasForeignKey(objective => objective.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasQueryFilter(objective =>
                _currentTenant.TenantId.HasValue && objective.TenantId == _currentTenant.TenantId.Value);
        });

        modelBuilder.Entity<Budget>(builder =>
        {
            builder.ToTable("budgets");
            builder.HasKey(budget => budget.Id);
            builder.Property(budget => budget.TenantId).IsRequired();
            builder.Property(budget => budget.AgentId).IsRequired();
            builder.Property(budget => budget.Name).HasMaxLength(150).IsRequired();
            builder.Property(budget => budget.TotalAmount).HasPrecision(18, 2).IsRequired();
            builder.Property(budget => budget.ReservedAmount).HasPrecision(18, 2).IsRequired();
            builder.Property(budget => budget.SpentAmount).HasPrecision(18, 2).IsRequired();
            builder.Ignore(budget => budget.AvailableAmount);
            builder.Property(budget => budget.Currency).HasMaxLength(3).IsRequired();
            builder.Property(budget => budget.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            builder.Property(budget => budget.CreatedAtUtc).IsRequired();
            builder.Property(budget => budget.UpdatedAtUtc).IsRequired();
            builder.HasIndex(budget => new { budget.TenantId, budget.AgentId, budget.Status });
            builder.HasOne<Agent>()
                .WithMany()
                .HasForeignKey(budget => budget.AgentId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne<Objective>()
                .WithMany()
                .HasForeignKey(budget => budget.ObjectiveId)
                .OnDelete(DeleteBehavior.Restrict);
            builder.Property<uint>("xmin").HasColumnName("xmin").IsRowVersion();
            builder.HasQueryFilter(budget =>
                _currentTenant.TenantId.HasValue && budget.TenantId == _currentTenant.TenantId.Value);
        });
        modelBuilder.Entity<Policy>(builder => { builder.ToTable("policies"); builder.HasKey(x=>x.Id); builder.Property(x=>x.Name).HasMaxLength(150).IsRequired(); builder.Property(x=>x.ActionType).HasMaxLength(100).IsRequired(); builder.Property(x=>x.MaximumAmount).HasPrecision(18,2); builder.Property(x=>x.ApprovalThreshold).HasPrecision(18,2); builder.HasIndex(x=>new{x.TenantId,x.AgentId,x.ActionType,x.IsActive}); builder.HasQueryFilter(x=>_currentTenant.TenantId.HasValue && x.TenantId==_currentTenant.TenantId.Value); });
        modelBuilder.Entity<AuthorizationRequest>(builder => { builder.ToTable("authorization_requests"); builder.HasKey(x=>x.Id); builder.Property(x=>x.ActionType).HasMaxLength(100).IsRequired(); builder.Property(x=>x.Amount).HasPrecision(18,2); builder.Property(x=>x.Currency).HasMaxLength(3).IsRequired(); builder.Property(x=>x.Purpose).HasMaxLength(2000).IsRequired(); builder.Property(x=>x.IdempotencyKey).HasMaxLength(100).IsRequired(); builder.Property(x=>x.Decision).HasConversion<string>().HasMaxLength(20); builder.Property(x=>x.DecisionReason).HasMaxLength(1000); builder.HasIndex(x=>new{x.TenantId,x.IdempotencyKey}).IsUnique(); builder.HasQueryFilter(x=>_currentTenant.TenantId.HasValue && x.TenantId==_currentTenant.TenantId.Value); });
        modelBuilder.Entity<ApprovalRequest>(b=>{b.ToTable("approval_requests");b.HasKey(x=>x.Id);b.Property(x=>x.Status).HasConversion<string>().HasMaxLength(20);b.HasIndex(x=>new{x.TenantId,x.Status});b.HasOne<AuthorizationRequest>().WithMany().HasForeignKey(x=>x.AuthorizationRequestId).OnDelete(DeleteBehavior.Restrict);b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<ShadowAction>(b=>{b.ToTable("shadow_actions");b.HasKey(x=>x.Id);b.Property(x=>x.Decision).HasConversion<string>().HasMaxLength(20);b.HasIndex(x=>x.TenantId);b.HasOne<AuthorizationRequest>().WithMany().HasForeignKey(x=>x.AuthorizationRequestId).OnDelete(DeleteBehavior.Restrict);b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<LedgerEntry>(b=>{b.ToTable("ledger_entries");b.HasKey(x=>x.Id);b.Property(x=>x.Amount).HasPrecision(18,2);b.Property(x=>x.Currency).HasMaxLength(3);b.Property(x=>x.Type).HasConversion<string>().HasMaxLength(30);b.Property(x=>x.CorrelationId).HasMaxLength(100);b.HasIndex(x=>new{x.TenantId,x.BudgetId,x.CreatedAtUtc});b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<AuditEvent>(b=>{b.ToTable("audit_events");b.HasKey(x=>x.Id);b.Property(x=>x.Action).HasMaxLength(100);b.Property(x=>x.ResourceType).HasMaxLength(100);b.Property(x=>x.CorrelationId).HasMaxLength(100);b.HasIndex(x=>new{x.TenantId,x.CreatedAtUtc});b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<OutcomeRecord>(b=>{b.ToTable("outcome_records");b.HasKey(x=>x.Id);b.Property(x=>x.Metric).HasMaxLength(100);b.Property(x=>x.Value).HasPrecision(18,4);b.Property(x=>x.Unit).HasMaxLength(50);b.Property(x=>x.Description).HasMaxLength(2000);b.HasIndex(x=>new{x.TenantId,x.ObjectiveId,x.CreatedAtUtc});b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<ApiCredential>(b=>{b.ToTable("api_credentials");b.HasKey(x=>x.Id);b.Property(x=>x.Name).HasMaxLength(100);b.Property(x=>x.Prefix).HasMaxLength(16);b.Property(x=>x.SecretHash).HasMaxLength(64);b.HasIndex(x=>new{x.TenantId,x.Prefix}).IsUnique();b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<SaasSubscription>(b=>{b.ToTable("saas_subscriptions");b.HasKey(x=>x.Id);b.Property(x=>x.Provider).HasMaxLength(150);b.Property(x=>x.ProductName).HasMaxLength(150);b.Property(x=>x.MonthlyCost).HasPrecision(18,2);b.Property(x=>x.Currency).HasMaxLength(3);b.Property(x=>x.Status).HasConversion<string>().HasMaxLength(20);b.HasIndex(x=>new{x.TenantId,x.Provider,x.ProductName,x.Status});b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
        modelBuilder.Entity<SaasRecommendation>(b=>{b.ToTable("saas_recommendations");b.HasKey(x=>x.Id);b.Property(x=>x.Type).HasConversion<string>().HasMaxLength(40);b.Property(x=>x.Reason).HasMaxLength(1000);b.HasIndex(x=>new{x.TenantId,x.SubscriptionId,x.Type});b.HasOne<SaasSubscription>().WithMany().HasForeignKey(x=>x.SubscriptionId).OnDelete(DeleteBehavior.Restrict);b.HasQueryFilter(x=>_currentTenant.TenantId.HasValue&&x.TenantId==_currentTenant.TenantId.Value);});
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnforceTenantIsolation();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        EnforceTenantIsolation();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void EnforceTenantIsolation()
    {
        var scopedEntries = ChangeTracker.Entries<ITenantScoped>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted);

        foreach (var entry in scopedEntries)
        {
            var tenantId = _currentTenant.TenantId
                ?? throw new InvalidOperationException("A tenant context is required to modify tenant-scoped data.");

            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = tenantId;
            }

            if (entry.Entity.TenantId != tenantId)
            {
                throw new InvalidOperationException("Tenant-scoped data cannot be modified outside the current tenant.");
            }
        }
    }
}
