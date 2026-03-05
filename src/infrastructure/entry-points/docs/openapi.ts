export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PE Users API',
    version: '1.0.0',
    description:
      'Authentication API for the Plataforma Emprendedores users service. Provides JWT-based login, token refresh via HttpOnly cookie, and logout.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
  paths: {
    '/auth/login': {
      post: {
        operationId: 'login',
        summary: 'Authenticate user and obtain tokens',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            headers: {
              'Set-Cookie': {
                description:
                  'HttpOnly refresh token cookie. Format: refreshToken=<value>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/',
                schema: {
                  type: 'string',
                  example:
                    'refreshToken=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AccessTokenResponse',
                },
              },
            },
          },
          '400': {
            description: 'Validation error — missing or malformed fields',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        operationId: 'refreshToken',
        summary: 'Refresh access token using cookie or body token',
        tags: ['Auth'],
        requestBody: {
          required: false,
          description:
            'Optionally provide the refresh token in the body if the HttpOnly cookie is not available.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RefreshRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            headers: {
              'Set-Cookie': {
                description: 'New HttpOnly refresh token cookie replacing the previous one.',
                schema: {
                  type: 'string',
                  example:
                    'refreshToken=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AccessTokenResponse',
                },
              },
            },
          },
          '401': {
            description: 'Refresh token is missing, invalid, or expired',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        operationId: 'logout',
        summary: 'Invalidate the current session and clear the refresh token cookie',
        tags: ['Auth'],
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LogoutRequest',
              },
            },
          },
        },
        responses: {
          '204': {
            description: 'Logged out successfully — no content',
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
          },
          password: {
            type: 'string',
            minLength: 1,
            example: 'secret123',
          },
        },
      },
      RefreshRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description:
              'Refresh token as fallback when the HttpOnly cookie is not available (e.g. mobile clients).',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      LogoutRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Optional refresh token when the cookie is not accessible.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      AccessTokenResponse: {
        type: 'object',
        required: ['accessToken'],
        properties: {
          accessToken: {
            type: 'string',
            description: 'Short-lived JWT access token.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Human-readable error description.',
            example: 'Invalid credentials',
          },
        },
      },
    },
  },
} as const;
