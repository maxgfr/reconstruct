import { Controller, Get, Post, Param } from "@nestjs/common";

@Controller("users")
export class UsersController {
  @Get()
  findAll() {
    return [];
  }

  @Post()
  create() {
    return {};
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return { id };
  }
}
