using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RestaurantManagement.Data;
using RestaurantManagement.Models;
using RestaurantManagement.Services;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5266", "https://localhost:7037")
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

builder.Services.AddDbContext<RestaurantManagementContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DBConnection")));

// Load JWT settings from configuration
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var key = jwtSettings["SecretKey"];
var issuer = jwtSettings["Issuer"];
var audience = jwtSettings["Audience"];
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ActiveUserOnly", policy => policy.RequireAssertion(context =>
    {
        var isActiveClaim = context.User.FindFirst("IsActive")?.Value;
        return bool.TryParse(isActiveClaim, out var isActive) && isActive;
    }));

    options.AddPolicy("SelfOrAdmin", policy => policy.RequireAssertion(context =>
    {
        var isActiveClaim = context.User.FindFirst("IsActive")?.Value;
        if (!bool.TryParse(isActiveClaim, out var isActive) || !isActive)
            return false;

        var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Admin")
            return true;

        return true;
    }));

    options.AddPolicy("AdminOrChef", policy => policy.RequireRole("Admin", "Chef"));

    options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));

    options.AddPolicy("Chef", policy => policy.RequireRole("Chef"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    //Cấu hình Swagger để hiển thị nút Authorize (Bearer)
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Nhập JWT token vào đây (dạng: Bearer {token})",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
{
    {
        new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        },
        new string[] {}
    }
});
});

// Lets the program read EmailsSettings in appsetting.json
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddTransient<IEmailService, EmailService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable CORS
app.UseCors("AllowLocalhost");

// Serve default files (root -> login.html)
var defaultFiles = new DefaultFilesOptions();
defaultFiles.DefaultFileNames.Clear();
defaultFiles.DefaultFileNames.Add("login.html");
app.UseDefaultFiles(defaultFiles); // must come before UseStaticFiles
app.UseStaticFiles();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

// Fallback to login.html for unmatched routes (SPA-like behavior)
app.MapFallbackToFile("login.html");

app.Run();
