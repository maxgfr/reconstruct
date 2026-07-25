import { inject } from "@angular/core";
import type { CanActivateFn } from "@angular/router";
import { SessionService } from "./session.service";

export const authGuard: CanActivateFn = () => inject(SessionService).isLoggedIn();
