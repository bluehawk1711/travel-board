import { Test, TestingModule } from '@nestjs/testing';
import { CountersService } from './counters.service';
import { PG_CONNECTION } from '../db/dbProvider';
import { REDIS_CLIENT } from '../common/redis/redis.constants';

describe('CountersService', () => {
  let service: CountersService;

  const mockDb = {
    query: {
      likes: { findFirst: jest.fn() },
      boardSaves: { findFirst: jest.fn() },
    },
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };

  const mockRedis = {
    scard: jest.fn(),
    sismember: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    zincrby: jest.fn(),
    zrange: jest.fn(),
    smembers: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountersService,
        { provide: PG_CONNECTION, useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(CountersService);
  });

  describe('likeCount', () => {
    it('should return Redis SCARD count', async () => {
      mockRedis.scard.mockResolvedValue(5);

      const count = await service.likeCount('board-1');
      expect(count).toBe(5);
      expect(mockRedis.scard).toHaveBeenCalledWith('likes:board:board-1');
    });

    it('should fallback to Postgres on Redis failure', async () => {
      mockRedis.scard.mockRejectedValue(new Error('Redis down'));
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const count = await service.likeCount('board-1');
      expect(count).toBe(3);
    });
  });

  describe('didUserLike', () => {
    it('should return true if user liked the board', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await service.didUserLike('board-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false if user did not like', async () => {
      mockRedis.sismember.mockResolvedValue(0);

      const result = await service.didUserLike('board-1', 'user-1');
      expect(result).toBe(false);
    });

    it('should fallback to Postgres on Redis failure', async () => {
      mockRedis.sismember.mockRejectedValue(new Error('Redis down'));
      mockDb.query.likes.findFirst.mockResolvedValue({
        boardId: 'board-1',
        userId: 'user-1',
      });

      const result = await service.didUserLike('board-1', 'user-1');
      expect(result).toBe(true);
    });
  });

  describe('toggleLike', () => {
    it('should add like when not existing', async () => {
      mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          query: { likes: { findFirst: jest.fn().mockResolvedValue(null) } },
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
          }),
        };
        return fn(tx);
      });
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.zincrby.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(1);
      mockDb.select.mockResolvedValue([{ count: 1 }]);

      const result = await service.toggleLike('board-1', 'user-1');
      expect(result.liked).toBe(true);
      expect(result.likeCount).toBe(1);
    });

    it('should remove like when existing', async () => {
      mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          query: {
            likes: {
              findFirst: jest
                .fn()
                .mockResolvedValue({ boardId: 'board-1', userId: 'user-1' }),
            },
          },
          delete: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        };
        return fn(tx);
      });
      mockRedis.srem.mockResolvedValue(1);
      mockRedis.zincrby.mockResolvedValue(0);
      mockRedis.scard.mockResolvedValue(0);
      mockDb.select.mockResolvedValue([{ count: 0 }]);

      const result = await service.toggleLike('board-1', 'user-1');
      expect(result.liked).toBe(false);
    });
  });

  describe('trendingBoardIds', () => {
    it('should return empty array on Redis failure', async () => {
      mockRedis.zrange.mockRejectedValue(new Error('Redis down'));

      const ids = await service.trendingBoardIds();
      expect(ids).toEqual([]);
    });
  });
});
