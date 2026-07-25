using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public IActionResult List() => Ok();

    [HttpGet("{id}")]
    public IActionResult GetById(Guid id) => Ok();

    [HttpPost]
    public IActionResult Create([FromBody] CreateUserRequest body) => Created();

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public IActionResult Delete(Guid id) => NoContent();
}
