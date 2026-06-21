import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.auth.getRefreshToken()) {
          return this.auth.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.auth.getToken();
              const retryRequest = newToken ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }) : req;
              return next.handle(retryRequest);
            }),
            catchError((innerError) => {
              this.auth.logout();
              return throwError(() => innerError);
            })
          );
        }
        return throwError(() => error);
      })
    );
  }
}
