import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  lastName: z.string().min(1),
});

export const ResendVerificationSchema = z.object({
  userId: z.string().uuid(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export const GoogleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});
