import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const hadToken = Boolean(auth.token());
  if (auth.validToken(state.url)) {
    return true;
  }
  return hadToken
    ? false
    : inject(Router).createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
};
