export interface VerifyEmailCommand {
  token: string; // plaintext token from URL query param
}

export interface VerifyEmailResult {
  message: string;
}
