using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Fraudio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AutoFixPendingChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ApplicationUsers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));

            migrationBuilder.DeleteData(
                table: "ApplicationUsers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "ApplicationUsers",
                columns: new[] { "Id", "CreatedAt", "Email", "PasswordHash", "Role", "Username" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "admin@example.com", "PBKDF2$210000$262/sjL+RuD3J9qJErRjvw==$/TW82kPfRXF71aeyFv2+EG70QWz0YQYw6eNOM2dhSIE=", "Admin", "admin" },
                    { new Guid("22222222-2222-2222-2222-222222222222"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "analyst@example.com", "PBKDF2$210000$s5A0QBkY4alJwGYZ3gpcfg==$4fnCKcvUCTcyz0OMzhSKAw1pFbgQV9ylH5ZMXMHBLJc=", "Analyst", "analyst" }
                });
        }
    }
}
