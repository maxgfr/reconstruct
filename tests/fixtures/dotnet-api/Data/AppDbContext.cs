using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Todo> Todos => Set<Todo>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<Todo>().HasOne(t => t.Owner).WithMany().HasForeignKey(t => t.OwnerId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public UserRole Role { get; set; }
}

public class Todo
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public Guid OwnerId { get; set; }
    public User? Owner { get; set; }
}

public enum UserRole { Member, Admin }
