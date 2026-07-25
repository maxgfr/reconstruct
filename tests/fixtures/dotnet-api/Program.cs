using Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddControllers();
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

var todos = app.MapGroup("/api/todos");
todos.MapGet("/", ListTodos);
todos.MapPost("/", CreateTodo).RequireAuthorization();
todos.MapDelete("/{id}", DeleteTodo).RequireAuthorization();

app.Run();
