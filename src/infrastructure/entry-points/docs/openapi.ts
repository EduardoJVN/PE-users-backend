export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PE Users API',
    version: '1.0.0',
    description:
      'Authentication API for the Plataforma Emprendedores users service. Provides JWT-based auth, email verification, and password reset.',
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
              schema: { $ref: '#/components/schemas/LoginRequest' },
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
                schema: { $ref: '#/components/schemas/AccessTokenResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error — missing or malformed fields',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
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
              schema: { $ref: '#/components/schemas/RefreshRequest' },
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
                schema: { $ref: '#/components/schemas/AccessTokenResponse' },
              },
            },
          },
          '401': {
            description: 'Refresh token is missing, invalid, or expired',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
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
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LogoutRequest' },
            },
          },
        },
        responses: {
          '204': { description: 'Logged out successfully — no content' },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        operationId: 'register',
        summary: 'Create a new user account',
        description:
          'Registers a new user and sends a verification email. The account remains inactive until the email is verified.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created. A verification email has been sent.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or email already in use',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/verify-email': {
      get: {
        operationId: 'verifyEmail',
        summary: 'Verify email address via token',
        description:
          'Activates the user account using the one-time token sent by email. The token is valid for 24 hours.',
        tags: ['Auth'],
        parameters: [
          {
            name: 'token',
            in: 'query',
            required: true,
            description: 'One-time verification token received by email.',
            schema: { type: 'string', example: 'a3f1c2d4-...' },
          },
        ],
        responses: {
          '200': {
            description: 'Email verified successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageResponse' },
              },
            },
          },
          '400': {
            description: 'Token missing, invalid, expired, or account already verified',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/resend-verification': {
      post: {
        operationId: 'resendVerification',
        summary: 'Resend email verification link',
        description:
          'Sends a new verification email to the user. Rate-limited to 3 requests per hour.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResendVerificationRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Verification email sent (or silently skipped if already verified)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error — userId is not a valid UUID',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded — too many resend attempts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RateLimitResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        operationId: 'forgotPassword',
        summary: 'Request a password reset email',
        description:
          'Sends a password reset link to the provided email. Always returns 200 regardless of whether the account exists (anti-enumeration). Rate-limited to 3 requests per hour.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ForgotPasswordRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Response sent (account existence not disclosed)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error — invalid email format',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded — too many reset requests',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RateLimitResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        operationId: 'resetPassword',
        summary: 'Reset password using a valid reset token',
        description:
          'Sets a new password for the account associated with the reset token. The token is valid for 1 hour and can only be used once.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResetPasswordRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Password reset successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error, token invalid, or token expired',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
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
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 1, example: 'MyP@ss123' },
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
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'name', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          password: {
            type: 'string',
            minLength: 8,
            description:
              'Must contain at least one uppercase letter, one number, and one special character.',
            example: 'MyP@ss123',
          },
          name: { type: 'string', minLength: 1, example: 'Alice' },
          lastName: { type: 'string', minLength: 1, example: 'Smith' },
        },
      },
      RegisterResponse: {
        type: 'object',
        required: ['id', 'email', 'name', 'lastName'],
        properties: {
          id: { type: 'string', format: 'uuid', example: '01932f4a-...' },
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          name: { type: 'string', example: 'Alice' },
          lastName: { type: 'string', example: 'Smith' },
        },
      },
      ResendVerificationRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid', example: '01932f4a-...' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: {
            type: 'string',
            description: 'One-time reset token received by email.',
            example: 'b7e2a1f0-...',
          },
          newPassword: {
            type: 'string',
            minLength: 8,
            description:
              'Must contain at least one uppercase letter, one number, and one special character.',
            example: 'NewP@ss456',
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
      MessageResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Operation completed successfully' },
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
      RateLimitResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Rate limit error message.',
            example: 'Too many attempts. Try again in 3600 seconds.',
          },
        },
      },
    },
  },
} as const;
