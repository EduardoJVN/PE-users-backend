export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface IGoogleOAuthPort {
  getAuthUrl(): string;
  getProfile(code: string): Promise<GoogleProfile>;
}
