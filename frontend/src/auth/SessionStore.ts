const TOKEN_KEY = 'elarion_token';

export const SessionStore = {
  save(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },

  load(): string | null {
    return sessionStorage.getItem(TOKEN_KEY) || null;
  },

  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};
