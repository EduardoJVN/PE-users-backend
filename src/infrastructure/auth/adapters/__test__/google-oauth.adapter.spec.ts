import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleOAuthAdapter } from '../google-oauth.adapter.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateAuthUrl = vi.fn();
const mockGetToken = vi.fn();
const mockSetCredentials = vi.fn();

// Use a class constructor mock so `new OAuth2Client(...)` works correctly
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class {
      generateAuthUrl = mockGenerateAuthUrl;
      getToken = mockGetToken;
      setCredentials = mockSetCredentials;
    },
  };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GoogleOAuthAdapter', () => {
  let adapter: GoogleOAuthAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GoogleOAuthAdapter(
      'client-id',
      'client-secret',
      'http://localhost:3000/callback',
    );
  });

  describe('getAuthUrl()', () => {
    it('returns the Google OAuth authorization URL', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/auth?client_id=test',
      );

      const url = adapter.getAuthUrl();

      expect(typeof url).toBe('string');
      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?client_id=test');
    });

    it('calls generateAuthUrl with offline access_type and profile+email scopes', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth');

      adapter.getAuthUrl();

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['profile', 'email'],
      });
    });
  });

  describe('getProfile()', () => {
    const mockTokens = { access_token: 'access-token-abc' };

    beforeEach(() => {
      mockGetToken.mockResolvedValue({ tokens: mockTokens });
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          id: 'google-user-123',
          email: 'alice@example.com',
          given_name: 'Alice',
          family_name: 'Smith',
          picture: 'https://example.com/photo.jpg',
        }),
      });
    });

    it('returns a GoogleProfile with mapped fields', async () => {
      const profile = await adapter.getProfile('auth-code-xyz');

      expect(profile.googleId).toBe('google-user-123');
      expect(profile.email).toBe('alice@example.com');
      expect(profile.name).toBe('Alice');
      expect(profile.lastName).toBe('Smith');
      expect(profile.avatarUrl).toBe('https://example.com/photo.jpg');
    });

    it('exchanges the code for tokens', async () => {
      await adapter.getProfile('auth-code-xyz');

      expect(mockGetToken).toHaveBeenCalledWith('auth-code-xyz');
    });

    it('sets credentials after token exchange', async () => {
      await adapter.getProfile('auth-code-xyz');

      expect(mockSetCredentials).toHaveBeenCalledWith(mockTokens);
    });

    it('calls userinfo endpoint with Bearer token', async () => {
      await adapter.getProfile('auth-code-xyz');

      expect(mockFetch).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer access-token-abc' },
      });
    });

    it('uses empty string for lastName when family_name is absent', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          id: 'google-123',
          email: 'bob@example.com',
          given_name: 'Bob',
          // no family_name
          picture: null,
        }),
      });

      const profile = await adapter.getProfile('code');

      expect(profile.lastName).toBe('');
    });

    it('uses null for avatarUrl when picture is absent', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          id: 'google-123',
          email: 'bob@example.com',
          given_name: 'Bob',
          // no picture
        }),
      });

      const profile = await adapter.getProfile('code');

      expect(profile.avatarUrl).toBeNull();
    });

    it('propagates error when getToken throws', async () => {
      mockGetToken.mockRejectedValue(new Error('Invalid code'));

      await expect(adapter.getProfile('bad-code')).rejects.toThrow('Invalid code');
    });

    it('propagates error when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.getProfile('code')).rejects.toThrow('Network error');
    });
  });
});
