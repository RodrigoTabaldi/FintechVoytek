namespace Voytek.Api.Identity;

public sealed record RegisterRequest(string Email, string Password, string OrganizationName, string OrganizationSlug);

public sealed record LoginRequest(string Email, string Password);

public sealed record SelectTenantRequest(Guid TenantId);

public sealed record TenantMembershipResponse(Guid TenantId, string Role);

public sealed record AuthenticationResponse(
    string AccessToken,
    Guid UserId,
    IReadOnlyList<TenantMembershipResponse> Memberships);
