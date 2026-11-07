import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import databaseConfig, { databasePoolOptions } from '../../../src/config/database.config';
import { PrismaService } from '../../../src/prisma/prisma.service';

type ConnectedAdapter = Awaited<ReturnType<PrismaPg['connect']>>;
const mockConnections: ConnectedAdapter[] = [];

// Replace the query engine, but use the installed adapter and real pg pools.
// This exercises pool ownership/disposal without connecting to a database.
jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    private connection?: ConnectedAdapter;

    constructor(private readonly options: { adapter: PrismaPg }) {}

    async $connect() {
      this.connection = await this.options.adapter.connect();
      mockConnections.push(this.connection);
    }

    async $disconnect() {
      await this.connection?.dispose();
      this.connection = undefined;
    }
  },
}));

const ORIGINAL_URL = process.env.DATABASE_URL;
const ORIGINAL_MAX = process.env.DB_POOL_MAX;
const TEST_URL = 'postgresql://test:test@127.0.0.1:1/pool-test';

beforeEach(() => {
  process.env.DATABASE_URL = TEST_URL;
  delete process.env.DB_POOL_MAX;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  // Fail immediately if a future change tries to open a socket in these tests.
  jest.spyOn(Pool.prototype, 'connect').mockImplementation(() => {
    throw new Error('These pool lifecycle tests must not open database connections.');
  });
});

afterEach(async () => {
  for (const connection of mockConnections) {
    if (!connection.underlyingDriver().ended) await connection.dispose();
  }
  mockConnections.length = 0;
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_MAX === undefined) delete process.env.DB_POOL_MAX;
  else process.env.DB_POOL_MAX = ORIGINAL_MAX;
  jest.restoreAllMocks();
});

describe('database connection budget', () => {
  it.each([undefined, '', '   '])('defaults an unset or blank limit (%s) to five', (limit) => {
    expect(databasePoolOptions({ DATABASE_URL: TEST_URL, DB_POOL_MAX: limit }).max).toBe(5);
  });

  it.each(['0', '-1', '1.5', 'not-a-number', 'Infinity', '9007199254740992'])(
    'rejects invalid limits (%s) before a pool can be created',
    (limit) => {
      process.env.DB_POOL_MAX = limit;
      expect(() => new PrismaService()).toThrow('DB_POOL_MAX must be a positive integer.');
      expect(mockConnections).toHaveLength(0);
    },
  );

  it.each<[string | undefined, number]>([
    [undefined, 5],
    [' 3 ', 3],
  ])('applies limit %s to the actual runtime pool and exported configuration', async (limit, expected) => {
    if (limit !== undefined) process.env.DB_POOL_MAX = limit;
    const service = new PrismaService();
    await service.onModuleInit();

    const pool = mockConnections[0].underlyingDriver();
    expect(pool.options.max).toBe(expected);
    expect(databaseConfig().poolMax).toBe(expected);
    expect(pool.options.connectionString).toBe(TEST_URL);
    expect(pool.options.connectionTimeoutMillis).toBe(10_000);
    expect(pool.options.idleTimeoutMillis).toBe(60_000);
    expect(pool.options.keepAlive).toBe(true);
    expect(pool.totalCount).toBe(0);
    expect(Pool.prototype.connect).not.toHaveBeenCalled();
  });

  it('closes the owned pg pool when Nest destroys PrismaService', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    const pool = mockConnections[0].underlyingDriver();
    const end = jest.spyOn(pool, 'end');

    expect(pool.ended).toBe(false);
    await service.onModuleDestroy();

    expect(end).toHaveBeenCalledTimes(1);
    expect(pool.ended).toBe(true);
    expect(Pool.prototype.connect).not.toHaveBeenCalled();
  });
});
