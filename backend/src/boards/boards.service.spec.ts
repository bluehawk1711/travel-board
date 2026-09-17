import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CountersService } from '../counters/counters.service';
import { PG_CONNECTION } from '../db/dbProvider';
import { REDIS_CLIENT } from '../common/redis/redis.constants';

describe('BoardsService', () => {
  let service: BoardsService;

  const mockDb = {
    query: {
      boards: { findFirst: jest.fn() },
      boardMembers: { findFirst: jest.fn() },
      boardSections: { findFirst: jest.fn() },
      boardItems: { findFirst: jest.fn() },
      boardSaves: { findFirst: jest.fn() },
    },
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(),
  };

  const mockRedis = {
    incr: jest.fn().mockResolvedValue(1),
    zrem: jest.fn(),
    sadd: jest.fn(),
  };

  const mockCountersService = {
    likeCount: jest.fn().mockResolvedValue(0),
    saveCount: jest.fn().mockResolvedValue(0),
    didUserLike: jest.fn().mockResolvedValue(false),
    toggleLike: jest.fn(),
    toggleSave: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: PG_CONNECTION, useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: CountersService, useValue: mockCountersService },
      ],
    }).compile();

    service = module.get(BoardsService);
  });

  describe('findOne', () => {
    it('should throw NotFoundException for non-existent board', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for private board without membership', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue({
        id: 'board-1',
        visibility: 'PRIVATE',
        ownerId: 'owner-1',
      });
      mockDb.query.boardMembers.findFirst.mockResolvedValue(null);
      mockDb.select.mockResolvedValue([{ count: 0 }]);

      await expect(
        service.findOne('board-1', {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          avatarUrl: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return board with counts', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue({
        id: 'board-1',
        visibility: 'PUBLIC',
        ownerId: 'owner-1',
        title: 'Test Board',
        description: null,
        coverImageUrl: null,
        destination: null,
        boardType: 'FREEFORM',
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 'owner-1', name: 'Owner', avatarUrl: null },
        sections: [],
      });
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await service.findOne('board-1');
      expect(result.id).toBe('board-1');
      expect(result.title).toBe('Test Board');
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException for non-existent board', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          avatarUrl: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner member', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue({
        id: 'board-1',
        ownerId: 'owner-1',
      });
      mockDb.query.boardMembers.findFirst.mockResolvedValue({
        userId: 'user-2',
        role: 'VIEWER',
      });

      await expect(
        service.remove('board-1', {
          id: 'user-2',
          email: 'other@test.com',
          name: 'Other',
          avatarUrl: null,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-member (board stays hidden)', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue({
        id: 'board-1',
        ownerId: 'owner-1',
      });
      mockDb.query.boardMembers.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('board-1', {
          id: 'user-2',
          email: 'other@test.com',
          name: 'Other',
          avatarUrl: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleLike', () => {
    it('should throw NotFoundException for non-visible board', async () => {
      mockDb.query.boards.findFirst.mockResolvedValue(null);

      await expect(
        service.toggleLike('nonexistent', {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          avatarUrl: null,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
