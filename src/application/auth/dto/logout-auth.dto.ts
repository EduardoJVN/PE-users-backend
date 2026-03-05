export interface LogoutCommand {
  refreshToken: string;
  accessToken?: string; // optional — for best-effort blacklisting
}
// No LogoutResult — execute() returns Promise<void>
