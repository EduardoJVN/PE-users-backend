export interface RefreshTokenCommand {
  refreshToken: string; // plaintext token from cookie
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string; // new plaintext token
}
