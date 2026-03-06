export interface ResetPasswordCommand {
  token: string; // plaintext token from URL/body
  newPassword: string;
}

export interface ResetPasswordResult {
  message: string;
}
