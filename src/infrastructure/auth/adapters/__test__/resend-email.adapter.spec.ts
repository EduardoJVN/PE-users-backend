import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ id: 'mock-email-id' });

vi.mock('resend', () => {
  class Resend {
    emails = { send: mockSend };
    constructor(_apiKey: string) {}
  }
  return { Resend };
});

import { ResendEmailAdapter } from '@infra/auth/adapters/resend-email.adapter.js';

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ id: 'mock-email-id' });
    adapter = new ResendEmailAdapter('test-api-key', 'no-reply@example.com');
  });

  describe('sendVerificationEmail', () => {
    it('calls client.emails.send with correct from, to, and subject', async () => {
      await adapter.sendVerificationEmail({
        to: 'user@example.com',
        verificationUrl: 'https://app.example.com/verify?token=abc123',
      });

      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'no-reply@example.com',
          to: 'user@example.com',
          subject: 'Verify your email address',
        }),
      );
    });

    it('includes the verificationUrl in the html body', async () => {
      const verificationUrl = 'https://app.example.com/verify?token=abc123';

      await adapter.sendVerificationEmail({ to: 'user@example.com', verificationUrl });

      const call = mockSend.mock.calls[0][0] as { html: string };
      expect(call.html).toContain(verificationUrl);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('calls client.emails.send with correct from, to, and subject', async () => {
      await adapter.sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://app.example.com/reset?token=xyz789',
      });

      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'no-reply@example.com',
          to: 'user@example.com',
          subject: 'Reset your password',
        }),
      );
    });

    it('includes the resetUrl in the html body', async () => {
      const resetUrl = 'https://app.example.com/reset?token=xyz789';

      await adapter.sendPasswordResetEmail({ to: 'user@example.com', resetUrl });

      const call = mockSend.mock.calls[0][0] as { html: string };
      expect(call.html).toContain(resetUrl);
    });
  });

  describe('error propagation', () => {
    it('propagates error when client.emails.send throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('Resend API failure'));

      await expect(
        adapter.sendVerificationEmail({
          to: 'user@example.com',
          verificationUrl: 'https://app.example.com/verify?token=abc',
        }),
      ).rejects.toThrow('Resend API failure');
    });
  });
});
