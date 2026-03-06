import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../register-user.use-case.js';
import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { IEmailVerificationTokenRepository } from '@domain/auth/ports/email-verification-token.repository.port.js';
import type { IPasswordHasher } from '@domain/auth/ports/password-hasher.port.js';
import type { IEmailSender } from '@domain/ports/email-sender.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import { User } from '@domain/user/entities/user.entity.js';
import { EmailVerificationToken } from '@domain/auth/entities/email-verification-token.entity.js';
import { EmailAlreadyExistsError } from '@domain/auth/errors/email-already-exists.error.js';
import { PasswordTooWeakError } from '@domain/auth/errors/password-too-weak.error.js';
import type { RegisterUserCommand } from '@application/auth/dto/register-user-auth.dto.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

class MockUserRepository implements IUserRepository {
  private store: User[] = [];

  async findAll(): Promise<User[]> {
    return [...this.store];
  }

  async findById(id: string): Promise<User | null> {
    return this.store.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.store.find((u) => u.email === email) ?? null;
  }

  async save(entity: User): Promise<void> {
    this.store.push(entity);
  }

  async update(entity: User): Promise<void> {
    const i = this.store.findIndex((u) => u.id === entity.id);
    if (i >= 0) this.store[i] = entity;
  }

  async delete(id: string): Promise<void> {
    this.store = this.store.filter((u) => u.id !== id);
  }

  seed(user: User): void {
    this.store.push(user);
  }
}

class MockEvtRepository implements IEmailVerificationTokenRepository {
  saved: EmailVerificationToken[] = [];

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.saved.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async save(entity: EmailVerificationToken): Promise<void> {
    this.saved.push(entity);
  }

  async delete(userId: string): Promise<void> {
    this.saved = this.saved.filter((t) => t.userId !== userId);
  }
}

class MockPasswordHasher implements IPasswordHasher {
  hash = vi.fn(async (plain: string): Promise<string> => `hashed:${plain}`);
  compare = vi.fn(async (_plain: string, _hash: string): Promise<boolean> => true);
}

class MockEmailSender implements IEmailSender {
  sendVerificationEmail = vi.fn(async (): Promise<void> => undefined);
  sendPasswordResetEmail = vi.fn(async (): Promise<void> => undefined);
}

class MockLogger implements ILogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_PASSWORD = 'ValidPass1!';

function makeCommand(overrides?: Partial<RegisterUserCommand>): RegisterUserCommand {
  return {
    id: 'ignored-id',
    email: overrides?.email ?? 'user@example.com',
    password: overrides?.password ?? VALID_PASSWORD,
    name: overrides?.name ?? 'John',
    lastName: overrides?.lastName ?? 'Doe',
  };
}

function makeExistingUser(email: string): User {
  return User.reconstitute(
    'existing-user-id',
    email,
    'hashed:pass',
    'Existing',
    'User',
    null,
    1,
    1,
    1,
    false,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    null,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepo: MockUserRepository;
  let evtRepo: MockEvtRepository;
  let passwordHasher: MockPasswordHasher;
  let emailSender: MockEmailSender;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    evtRepo = new MockEvtRepository();
    passwordHasher = new MockPasswordHasher();
    emailSender = new MockEmailSender();
    logger = new MockLogger();
    useCase = new RegisterUserUseCase(
      userRepo,
      evtRepo,
      passwordHasher,
      emailSender,
      logger,
      'http://localhost:3000/auth/verify-email',
      24 * 60 * 60 * 1000,
    );
  });

  it('creates user, saves token, sends verification email, and returns result', async () => {
    const command = makeCommand();

    const result = await useCase.execute(command);

    // Result shape
    expect(result.email).toBe('user@example.com');
    expect(result.name).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);

    // User was saved
    const savedUser = await userRepo.findByEmail('user@example.com');
    expect(savedUser).not.toBeNull();

    // Token was saved
    expect(evtRepo.saved).toHaveLength(1);
    expect(evtRepo.saved[0].userId).toBe(result.id);
    expect(evtRepo.saved[0].type).toBe('VERIFY');

    // Email was sent with correct to and verificationUrl containing the token
    expect(emailSender.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const [callArgs] = emailSender.sendVerificationEmail.mock.calls;
    const params = callArgs?.[0] as { to: string; verificationUrl: string };
    expect(params.to).toBe('user@example.com');
    expect(params.verificationUrl).toContain('http://localhost:3000/auth/verify-email?token=');

    // Logger was called
    expect(logger.info).toHaveBeenCalledWith('User registered', { userId: result.id });
  });

  it('throws EmailAlreadyExistsError when email already exists', async () => {
    userRepo.seed(makeExistingUser('user@example.com'));

    await expect(useCase.execute(makeCommand())).rejects.toThrow(EmailAlreadyExistsError);
  });

  it('throws PasswordTooWeakError when password is shorter than 8 characters', async () => {
    await expect(useCase.execute(makeCommand({ password: 'Ab1!' }))).rejects.toThrow(
      PasswordTooWeakError,
    );
  });

  it('throws PasswordTooWeakError when password has no uppercase letter', async () => {
    await expect(useCase.execute(makeCommand({ password: 'validpass1!' }))).rejects.toThrow(
      PasswordTooWeakError,
    );
  });

  it('throws PasswordTooWeakError when password has no number', async () => {
    await expect(useCase.execute(makeCommand({ password: 'ValidPass!' }))).rejects.toThrow(
      PasswordTooWeakError,
    );
  });

  it('throws PasswordTooWeakError when password has no special character', async () => {
    await expect(useCase.execute(makeCommand({ password: 'ValidPass1' }))).rejects.toThrow(
      PasswordTooWeakError,
    );
  });

  it('propagates error if userRepo.save() throws', async () => {
    const saveError = new Error('DB write failed');
    vi.spyOn(userRepo, 'save').mockRejectedValue(saveError);

    await expect(useCase.execute(makeCommand())).rejects.toThrow('DB write failed');
  });

  it('propagates error if emailSender.sendVerificationEmail() throws', async () => {
    const emailError = new Error('SMTP unavailable');
    emailSender.sendVerificationEmail.mockRejectedValue(emailError);

    await expect(useCase.execute(makeCommand())).rejects.toThrow('SMTP unavailable');
  });
});
