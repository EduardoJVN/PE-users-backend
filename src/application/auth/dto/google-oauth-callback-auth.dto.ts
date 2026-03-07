export interface GoogleOAuthCallbackCommand {
  code: string;
}

export interface GoogleOAuthCallbackResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}
