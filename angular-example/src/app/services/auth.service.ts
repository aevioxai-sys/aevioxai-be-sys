import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface AuthUser { id: string; email: string; name?: string; role?: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessTokenKey = 'access_token';
  private refreshTokenKey = 'refresh_token';
  private userKey = 'auth_user';

  constructor(private http: HttpClient) {}

  signup(name: string, email: string, password: string, role = 'user') {
    return this.http.post('/api/auth/signup', { name, email, password, role }).pipe(
      tap((res: any) => this.storeResponse(res))
    );
  }

  login(email: string, password: string) {
    return this.http.post('/api/auth/login', { email, password }).pipe(
      tap((res: any) => this.storeResponse(res))
    );
  }

  refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    return this.http.post('/api/auth/refresh-token', { refreshToken }).pipe(
      tap((res: any) => this.storeResponse(res))
    );
  }

  private storeResponse(res: any) {
    if (!res) return;
    if (res.accessToken) localStorage.setItem(this.accessTokenKey, res.accessToken);
    if (res.refreshToken) localStorage.setItem(this.refreshTokenKey, res.refreshToken);
    if (res.user) localStorage.setItem(this.userKey, JSON.stringify(res.user));
  }

  logout() {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRole(): string | null {
    const u = this.getUser();
    return u ? u.role || null : null;
  }

  decodeToken(): any | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }
}
