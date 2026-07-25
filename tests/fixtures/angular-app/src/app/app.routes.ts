import type { Routes } from "@angular/router";
import { authGuard } from "./auth.guard";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "todos/:id", component: TodoDetailComponent, canActivate: [authGuard] },
  { path: "admin", loadChildren: () => import("./admin/admin.routes").then((m) => m.adminRoutes) },
  { path: "**", redirectTo: "" },
];
