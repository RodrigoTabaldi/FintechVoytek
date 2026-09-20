using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Voytek.Domain.Tenancy;
using Voytek.Infrastructure.Identity;

namespace Voytek.Api.Identity;

public sealed class JwtTokenService(IConfiguration configuration)
{
    private const string TenantIdClaimType = "tenant_id";

    public string Create(ApplicationUser user, Guid? tenantId = null, MembershipRole? membershipRole = null)
    {
        var signingKey = configuration["Jwt:SigningKey"]
            ?? throw new InvalidOperationException("Jwt:SigningKey must be configured.");
        var issuer = configuration["Jwt:Issuer"] ?? "voytek";
        var audience = configuration["Jwt:Audience"] ?? "voytek-api";
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())
        };

        if (tenantId is not null)
        {
            claims.Add(new Claim(TenantIdClaimType, tenantId.Value.ToString()));
        }

        if (membershipRole is not null)
        {
            claims.Add(new Claim(ClaimTypes.Role, membershipRole.Value.ToString()));
        }

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
