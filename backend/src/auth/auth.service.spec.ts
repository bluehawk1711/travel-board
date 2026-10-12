import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { MailService } from '../common/mail/mail.service';
import { PG_CONNECTION } from '../db/dbProvider';

describe('AuthService', () => {
  let service: AuthService;

  const mockDb = {
    query: {
      users: { findFirst: jest.fn() },
      refreshTokens: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return undefined;
    }),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PG_CONNECTION, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'test@test.com',
          name: 'Test',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should return tokens on successful registration', async () => {
      // 1st call: uniqueness check → free; 2nd call: issueTokens → getUserById.
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'new-user',
          email: 'test@test.com',
          name: 'Test',
          avatarUrl: null,
        });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'new-user',
              email: 'test@test.com',
              name: 'Test',
              avatarUrl: null,
            },
          ]),
        }),
      });
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.register({
        email: 'test@test.com',
        name: 'Test',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@test.com');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: '$2a$10$invalidhash',
      });

      // bcrypt.compare will return false for wrong password
      await expect(
        service.login({ email: 'test@test.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should always return success to prevent email enumeration', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@test.com');
      expect(result).toEqual({ success: true });
    });

    it('should send reset email for existing user with password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: '$2a$10$hash',
      });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });
      mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@test.com');
      expect(result).toEqual({ success: true });
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should not throw for invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.logout('invalid-token')).resolves.toBeUndefined();
    });
  });
});
