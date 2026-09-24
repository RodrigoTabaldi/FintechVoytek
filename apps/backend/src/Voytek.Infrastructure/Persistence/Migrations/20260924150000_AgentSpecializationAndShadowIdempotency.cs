using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Voytek.Infrastructure.Persistence.Migrations;

[DbContext(typeof(VoytekDbContext))]
[Migration("20260924150000_AgentSpecializationAndShadowIdempotency")]
public partial class AgentSpecializationAndShadowIdempotency : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Specialization",
            table: "agents",
            type: "character varying(40)",
            maxLength: 40,
            nullable: false,
            defaultValue: "Custom");

        migrationBuilder.AddColumn<bool>(
            name: "ShadowMode",
            table: "authorization_requests",
            type: "boolean",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Specialization",
            table: "agents");

        migrationBuilder.DropColumn(
            name: "ShadowMode",
            table: "authorization_requests");
    }
}
