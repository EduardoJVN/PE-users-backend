import { OAuth2Client } from 'google-auth-library';
import type { IGoogleOAuthPort, GoogleProfile } from '@domain/auth/ports/google-oauth.port.js';

export class GoogleOAuthAdapter implements IGoogleOAuthPort {
  private readonly client: OAuth2Client;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  getAuthUrl(): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
    });
  }

  async getProfile(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);

    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const data = (await res.json()) as {
      id: string;
      email: string;
      given_name: string;
      family_name?: string;
      picture?: string;
    };

    return {
      googleId: data.id,
      email: data.email,
      name: data.given_name,
      lastName: data.family_name ?? '',
      avatarUrl: data.picture ?? null,
    };
  }
}
