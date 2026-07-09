import type { AuthSession } from "./types";

const AUTH_STORAGE_KEY = "mindbridge.auth";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function createBasicToken(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

export function readAuthSession(): AuthSession | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
