using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Voytek.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SaasManagementFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "saas_subscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Provider = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    MonthlyCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PurchasedSeats = table.Column<int>(type: "integer", nullable: false),
                    ActiveUsers = table.Column<int>(type: "integer", nullable: false),
                    RenewalDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_saas_subscriptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "saas_recommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_saas_recommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_saas_recommendations_saas_subscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalTable: "saas_subscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_saas_recommendations_SubscriptionId",
                table: "saas_recommendations",
                column: "SubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_saas_recommendations_TenantId_SubscriptionId_Type",
                table: "saas_recommendations",
                columns: new[] { "TenantId", "SubscriptionId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_saas_subscriptions_TenantId_Provider_ProductName_Status",
                table: "saas_subscriptions",
                columns: new[] { "TenantId", "Provider", "ProductName", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "saas_recommendations");

            migrationBuilder.DropTable(
                name: "saas_subscriptions");
        }
    }
}
