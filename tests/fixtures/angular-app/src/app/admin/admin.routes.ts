import type { Routes } from "@angular/router";

export const adminRoutes: Routes = [
  { path: "users", component: AdminUsersComponent },
  { path: "settings", component: AdminSettingsComponent },
];
