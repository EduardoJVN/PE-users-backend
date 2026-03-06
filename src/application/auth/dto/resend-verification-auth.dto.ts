export interface ResendVerificationCommand {
  userId: string;
  rateLimitKey: string; // e.g. 'resend:ip:192.168.1.1' or 'resend:userId:xxx'
}

export interface ResendVerificationResult {
  message: string;
}
