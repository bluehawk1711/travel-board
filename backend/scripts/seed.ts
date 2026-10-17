/**
 * Default data seeder (dev / staging / e2e testing).
 *
 * Usage:
 *   pnpm --dir backend db:seed
 *
 * Creates the `pg_trgm` extension (Drizzle can't express it), then inserts a
 * deterministic demo world: users (password `password123`; the QA account
 * `test@example.com` uses its email as the password), boards with
 * sections + items, follows, likes, saves, comments, conversations and
 * messages. Idempotent — running it twice is safe (upserts on unique keys).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';

import {
  boardItems,
  boardMembers,
  boardSaves,
  boardSections,
  boards,
  comments,
  conversationMembers,
  conversations,
  follows,
  likes,
  messages,
  pushTokens,
  userSettings,
  users,
} from '../src/db/schema';

/** All seeded accounts share this password — dev convenience only. */
export const SEED_PASSWORD = 'password123';

const BCRYPT_ROUNDS = 10;

interface SeedUser {
  id: string;
  email: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  /** Overrides the shared password (the QA account uses its email). */
  password?: string;
}

const SEED_USERS: SeedUser[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'maya@travelboard.dev',
    name: 'Maya Iyer',
    bio: 'Slow travel, street food, and long train rides.',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'leo@travelboard.dev',
    name: 'Leo Fernandes',
    bio: 'Chasing surf breaks and cheap noodles.',
    avatarUrl: 'https://i.pravatar.cc/300?img=12',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'nina@travelboard.dev',
    name: 'Nina Kowalski',
    bio: 'Museums by day, night markets by night.',
    avatarUrl: 'https://i.pravatar.cc/300?img=32',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'omar@travelboard.dev',
    name: 'Omar Haddad',
    bio: 'Deserts, mountains, and everything between.',
    avatarUrl: 'https://i.pravatar.cc/300?img=68',
  },
  {
    /** QA account — password is the email itself (see header comment). */
    id: '55555555-5555-4555-8555-555555555555',
    email: 'test@example.com',
    name: 'Test Explorer',
    bio: 'Here to click every button. Currently "planning" autumn in Kyoto.',
    avatarUrl: 'https://i.pravatar.cc/300?img=15',
    password: 'test@example.com',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'priya@travelboard.dev',
    name: 'Priya Raman',
    bio: 'Backpacking routes and overnight trains.',
    avatarUrl: 'https://i.pravatar.cc/300?img=45',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    email: 'sofia@travelboard.dev',
    name: 'Sofia Marino',
    bio: 'Coastal towns, long lunches, no itineraries.',
    avatarUrl: 'https://i.pravatar.cc/300?img=26',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    email: 'jonas@travelboard.dev',
    name: 'Jonas Weber',
    bio: 'Hiking huts and very early starts.',
    avatarUrl: 'https://i.pravatar.cc/300?img=52',
  },
  {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'aisha@travelboard.dev',
    name: 'Aisha Bello',
    bio: 'Markets, street art, and whatever locals recommend.',
    avatarUrl: 'https://i.pravatar.cc/300?img=44',
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (backend/.env)');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  // Drizzle cannot express CREATE EXTENSION — the trigram indexes need it.
  await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  console.log('pg_trgm extension ready');

  // Adopt the ids of accounts that already exist (e.g. test@example.com was
  // registered by hand) so every downstream seed row references the real id
  // instead of colliding with `users_email_unique`.
  const { rows: existingUsers } = await pool.query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = ANY($1::text[])',
    [SEED_USERS.map((u) => u.email)],
  );
  const idByEmail = new Map(existingUsers.map((row) => [row.email, row.id]));
  const seedUsers: SeedUser[] = SEED_USERS.map((user) => ({
    ...user,
    id: idByEmail.get(user.email) ?? user.id,
  }));

  const defaultHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  // -- Users + per-user settings -------------------------------------------
  for (const user of seedUsers) {
    const passwordHash = user.password
      ? await bcrypt.hash(user.password, BCRYPT_ROUNDS)
      : defaultHash;
    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        passwordHash,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          name: user.name,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          passwordHash,
        },
      });
    await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
  }
  console.log(`${seedUsers.length} users seeded (password: ${SEED_PASSWORD}, QA account uses its email)`);

  const [maya, leo, nina, omar, test, priya, sofia, jonas, aisha] = seedUsers;

  // -- Boards ---------------------------------------------------------------
  /** YYYY-MM-DD offset from today — drives the "active trip" demo board. */
  const isoDay = (offset: number): string =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  const boardSeeds = [
    {
      id: 'b0000000-0000-4000-8000-000000000001',
      ownerId: maya.id,
      title: '7 Days in Japan - Cherry Blossom Route',
      description:
        'Tokyo to Kyoto by rail, timed for sakura season. Ferries, temples, and one very good bowl of tsukemen.',
      destination: 'Tokyo & Kyoto, Japan',
      coverImageUrl:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
      boardType: 'ITINERARY' as const,
      visibility: 'PUBLIC' as const,
      startDate: '2027-03-28',
      endDate: '2027-04-03',
    },
    {
      id: 'b0000000-0000-4000-8000-000000000002',
      ownerId: leo.id,
      title: 'Lisbon Long Weekend',
      description: 'Pastel de nata, tram 28, and surf an hour south of the city.',
      destination: 'Lisbon, Portugal',
      coverImageUrl:
        'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200',
      boardType: 'ITINERARY' as const,
      visibility: 'PUBLIC' as const,
      startDate: '2027-05-14',
      endDate: '2027-05-17',
    },
    {
      id: 'b0000000-0000-4000-8000-000000000003',
      ownerId: nina.id,
      title: 'Iceland Ring Road - Photo Spots',
      description: 'Waterfalls, black sand, and aurora windows by week.',
      destination: 'Iceland',
      coverImageUrl:
        'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1200',
      boardType: 'FREEFORM' as const,
      visibility: 'PUBLIC' as const,
      startDate: null,
      endDate: null,
    },
    {
      id: 'b0000000-0000-4000-8000-000000000004',
      ownerId: maya.id,
      title: 'Honeymoon Shortlist (private)',
      description: 'Private planning board - please do not share.',
      destination: 'Undecided',
      coverImageUrl: null,
      boardType: 'FREEFORM' as const,
      visibility: 'PRIVATE' as const,
      startDate: null,
      endDate: null,
    },
    {
      // Dates span "today" so the Profile active-trip banner, day progress,
      // and board day tabs always have something live to show.
      id: 'b0000000-0000-4000-8000-000000000005',
      ownerId: test.id,
      title: 'Autumn in Kyoto - Test Trip',
      description: 'The QA sandbox board: collab members, day tabs, and live dates.',
      destination: 'Kyoto, Japan',
      coverImageUrl:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
      boardType: 'ITINERARY' as const,
      visibility: 'PUBLIC' as const,
      startDate: isoDay(-1),
      endDate: isoDay(6),
    },
    {
      id: 'b0000000-0000-4000-8000-000000000006',
      ownerId: priya.id,
      title: '48 Hours in Marrakech',
      description: 'Riads, rooftop dinners, and a day trip to the Atlas foothills.',
      destination: 'Marrakech, Morocco',
      coverImageUrl:
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1200',
      boardType: 'FREEFORM' as const,
      visibility: 'PUBLIC' as const,
      startDate: null,
      endDate: null,
    },
  ];

  for (const board of boardSeeds) {
    await db
      .insert(boards)
      .values(board)
      .onConflictDoUpdate({ target: boards.id, set: board });
    await db
      .insert(boardMembers)
      .values({ boardId: board.id, userId: board.ownerId, role: 'OWNER' })
      .onConflictDoNothing();
  }

  // Shared boards: the QA account collaborates on the demo boards, and the
  // test trip gets collaborators so member counts / chat feel real.
  const sharedMemberSeeds = [
    { boardId: boardSeeds[0].id, userId: test.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[0].id, userId: omar.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[0].id, userId: priya.id, role: 'VIEWER' as const },
    { boardId: boardSeeds[1].id, userId: test.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[1].id, userId: nina.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[2].id, userId: test.id, role: 'VIEWER' as const },
    { boardId: boardSeeds[4].id, userId: leo.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[4].id, userId: nina.id, role: 'EDITOR' as const },
    { boardId: boardSeeds[4].id, userId: sofia.id, role: 'VIEWER' as const },
    { boardId: boardSeeds[5].id, userId: test.id, role: 'EDITOR' as const },
  ];
  for (const member of sharedMemberSeeds) {
    await db.insert(boardMembers).values(member).onConflictDoNothing();
  }
  console.log(`${boardSeeds.length} boards seeded (${sharedMemberSeeds.length} shared memberships)`);

  // -- Sections + items (the Japan itinerary board) -------------------------
  const [japan] = boardSeeds;
  const japanSections = [
    {
      id: 'a0000000-0000-4000-8000-000000000001',
      boardId: japan.id,
      title: 'Day 1 - Arrive Tokyo',
      position: 0,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000002',
      boardId: japan.id,
      title: 'Day 2 - Asakusa & Ueno',
      position: 1,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000003',
      boardId: japan.id,
      title: 'Day 3 - Shinkansen to Kyoto',
      position: 2,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000004',
      boardId: japan.id,
      title: 'Day 4 - Arashiyama',
      position: 3,
    },
  ];

  for (const section of japanSections) {
    await db
      .insert(boardSections)
      .values(section)
      .onConflictDoUpdate({ target: boardSections.id, set: section });
  }

  const extraSections = [
    {
      id: 'a0000000-0000-4000-8000-000000000005',
      boardId: 'b0000000-0000-4000-8000-000000000005',
      title: 'Day 1 - Eastern Kyoto',
      position: 0,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000006',
      boardId: 'b0000000-0000-4000-8000-000000000005',
      title: 'Day 2 - Fushimi Inari & Gion',
      position: 1,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000007',
      boardId: 'b0000000-0000-4000-8000-000000000006',
      title: 'Saved spots',
      position: 0,
    },
  ];
  for (const section of extraSections) {
    await db
      .insert(boardSections)
      .values(section)
      .onConflictDoUpdate({ target: boardSections.id, set: section });
  }

  const itemSeeds = [
    {
      id: 'e0000000-0000-4000-8000-000000000001',
      boardId: japan.id,
      sectionId: japanSections[0].id,
      type: 'PLACE' as const,
      title: 'Senso-ji Temple',
      description: 'Oldest temple in Tokyo - go before 8am.',
      placeId: 'ChIJ8VvSb9eMGGARyGWqpVuXOk0',
      imageUrl:
        'https://images.unsplash.com/photo-1548013146-72479768bada?w=800',
      url: null,
      lat: 35.7148,
      lng: 139.7967,
      date: '2027-03-28',
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000002',
      boardId: japan.id,
      sectionId: japanSections[0].id,
      type: 'RESTAURANT' as const,
      title: 'Fuunji Tsukemen',
      description: 'Dipping noodles in Shinjuku. Expect a queue.',
      placeId: null,
      imageUrl: null,
      url: null,
      lat: 35.6896,
      lng: 139.7006,
      date: '2027-03-28',
      position: 1,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000003',
      boardId: japan.id,
      sectionId: japanSections[1].id,
      type: 'PLACE' as const,
      title: 'Tokyo National Museum',
      description: 'Closed Mondays - check before going.',
      placeId: null,
      imageUrl:
        'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
      url: null,
      lat: 35.7188,
      lng: 139.7765,
      date: '2027-03-29',
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000004',
      boardId: japan.id,
      sectionId: japanSections[2].id,
      type: 'NOTE' as const,
      title: 'Book Nozomi tickets early',
      description:
        'Reserve Hikari seats at least a week ahead in sakura season.',
      placeId: null,
      imageUrl: null,
      url: null,
      lat: null,
      lng: null,
      date: '2027-03-30',
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000005',
      boardId: japan.id,
      sectionId: japanSections[3].id,
      type: 'ACTIVITY' as const,
      title: 'Bamboo Grove at sunrise',
      description: 'Arashiyama - arrive by 7am to have it to yourself.',
      placeId: null,
      imageUrl:
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800',
      url: null,
      lat: 35.017,
      lng: 135.6716,
      date: '2027-03-31',
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000006',
      boardId: japan.id,
      sectionId: japanSections[3].id,
      type: 'LINK' as const,
      title: 'Kyoto transit guide',
      description: 'Bus + subway day passes.',
      placeId: null,
      imageUrl: null,
      url: 'https://www.kyoto.travel/en/plan-your-trip/transportation',
      lat: null,
      lng: null,
      date: null,
      position: 1,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000007',
      boardId: 'b0000000-0000-4000-8000-000000000005',
      sectionId: 'a0000000-0000-4000-8000-000000000005',
      type: 'PLACE' as const,
      title: 'Kiyomizu-dera at opening',
      description: 'Beat the crowds - gates open at 6am.',
      placeId: 'ChIJ1RCVv6mNHhAROw8fTQh-mXk',
      imageUrl:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
      url: null,
      lat: 34.9949,
      lng: 135.785,
      date: isoDay(-1),
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000008',
      boardId: 'b0000000-0000-4000-8000-000000000005',
      sectionId: 'a0000000-0000-4000-8000-000000000005',
      type: 'RESTAURANT' as const,
      title: 'Nishiki Market lunch crawl',
      description: 'Tamagoyaki, pickles, and soy-milk doughnuts.',
      placeId: null,
      imageUrl: null,
      url: null,
      lat: 35.005,
      lng: 135.7649,
      date: isoDay(-1),
      position: 1,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000009',
      boardId: 'b0000000-0000-4000-8000-000000000005',
      sectionId: 'a0000000-0000-4000-8000-000000000006',
      type: 'ACTIVITY' as const,
      title: 'Fushimi Inari before sunrise',
      description: '10,000 torii gates with nobody on them.',
      placeId: 'ChIJ1RCVv6mNHhAROw8fTQh-mXk',
      imageUrl:
        'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=800',
      url: null,
      lat: 34.9671,
      lng: 135.7727,
      date: isoDay(0),
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000010',
      boardId: 'b0000000-0000-4000-8000-000000000006',
      sectionId: 'a0000000-0000-4000-8000-000000000007',
      type: 'RESTAURANT' as const,
      title: 'Jemaa el-Fnaa food stalls',
      description: 'Go after 7pm - the square turns into an open-air dinner.',
      placeId: null,
      imageUrl:
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800',
      url: null,
      lat: 31.6258,
      lng: -7.9891,
      date: null,
      position: 0,
    },
    {
      id: 'e0000000-0000-4000-8000-000000000011',
      boardId: 'b0000000-0000-4000-8000-000000000006',
      sectionId: 'a0000000-0000-4000-8000-000000000007',
      type: 'PLACE' as const,
      title: 'Rooftop mint tea, Medina',
      description: 'Sunset over the Koutoubia - ask for the terrace.',
      placeId: null,
      imageUrl: null,
      url: null,
      lat: 31.631,
      lng: -7.989,
      date: null,
      position: 1,
    },
  ];

  for (const item of itemSeeds) {
    await db.insert(boardItems).values(item).onConflictDoUpdate({
      target: boardItems.id,
      set: item,
    });
  }
  console.log(
    `${japanSections.length} sections and ${itemSeeds.length} items seeded`,
  );

  // -- Social graph ---------------------------------------------------------
  const followSeeds = [
    { followerId: leo.id, targetType: 'USER' as const, targetId: maya.id },
    { followerId: nina.id, targetType: 'USER' as const, targetId: maya.id },
    { followerId: omar.id, targetType: 'USER' as const, targetId: leo.id },
    { followerId: maya.id, targetType: 'USER' as const, targetId: nina.id },
    {
      followerId: leo.id,
      targetType: 'BOARD' as const,
      targetId: japan.id,
    },
    {
      followerId: omar.id,
      targetType: 'BOARD' as const,
      targetId: japan.id,
    },
    // QA account: follows the demo crew, and is followed back (profile stats).
    { followerId: test.id, targetType: 'USER' as const, targetId: maya.id },
    { followerId: test.id, targetType: 'USER' as const, targetId: leo.id },
    { followerId: test.id, targetType: 'USER' as const, targetId: nina.id },
    { followerId: test.id, targetType: 'BOARD' as const, targetId: boardSeeds[1].id },
    { followerId: maya.id, targetType: 'USER' as const, targetId: test.id },
    { followerId: leo.id, targetType: 'USER' as const, targetId: test.id },
    { followerId: priya.id, targetType: 'USER' as const, targetId: test.id },
    { followerId: sofia.id, targetType: 'USER' as const, targetId: test.id },
    { followerId: aisha.id, targetType: 'USER' as const, targetId: test.id },
    { followerId: jonas.id, targetType: 'USER' as const, targetId: priya.id },
  ];
  for (const follow of followSeeds) {
    await db.insert(follows).values(follow).onConflictDoNothing();
  }

  const likeSeeds = [
    { boardId: japan.id, userId: leo.id },
    { boardId: japan.id, userId: nina.id },
    { boardId: japan.id, userId: omar.id },
    { boardId: boardSeeds[1].id, userId: maya.id },
    { boardId: boardSeeds[2].id, userId: maya.id },
    { boardId: boardSeeds[4].id, userId: leo.id },
    { boardId: boardSeeds[4].id, userId: maya.id },
    { boardId: boardSeeds[5].id, userId: maya.id },
    { boardId: boardSeeds[5].id, userId: jonas.id },
    { boardId: boardSeeds[1].id, userId: test.id },
    { boardId: boardSeeds[2].id, userId: test.id },
  ];
  for (const like of likeSeeds) {
    await db.insert(likes).values(like).onConflictDoNothing();
  }

  // "Saves" are a dedicated table (see boardSaves in schema.ts).
  const saveSeeds = [
    { boardId: japan.id, userId: leo.id },
    { boardId: boardSeeds[1].id, userId: nina.id },
    { boardId: boardSeeds[2].id, userId: omar.id },
    // QA account saved tab + a couple of organic saves.
    { boardId: japan.id, userId: test.id },
    { boardId: boardSeeds[2].id, userId: test.id },
    { boardId: boardSeeds[5].id, userId: nina.id },
    { boardId: boardSeeds[4].id, userId: sofia.id },
  ];
  for (const save of saveSeeds) {
    await db.insert(boardSaves).values(save).onConflictDoNothing();
  }

  const commentSeeds = [
    {
      id: 'c0000000-0000-4000-8000-000000000001',
      boardId: japan.id,
      userId: leo.id,
      body: 'The tsukemen recommendation alone made my week. Did you eat at the Shinjuku one or the smaller counter nearby?',
    },
    {
      id: 'c0000000-0000-4000-8000-000000000002',
      boardId: japan.id,
      userId: nina.id,
      body: 'Saving this for sakura season - the timing table at the bottom is exactly what I needed.',
    },
    {
      id: 'c0000000-0000-4000-8000-000000000003',
      boardId: boardSeeds[1].id,
      userId: maya.id,
      body: 'Costa da Caparica is worth the extra train hop. Bring a wetsuit in May.',
    },
    {
      id: 'c0000000-0000-4000-8000-000000000004',
      boardId: boardSeeds[4].id,
      userId: nina.id,
      body: 'Fushimi Inari before sunrise is the move - by 7am it is a queue. Add the full Inari loop to the map pin?',
    },
    {
      id: 'c0000000-0000-4000-8000-000000000005',
      boardId: boardSeeds[5].id,
      userId: aisha.id,
      body: 'Add the tannery viewpoint if you have time - best around 4pm when the light hits the dye pits.',
    },
  ];
  for (const comment of commentSeeds) {
    await db
      .insert(comments)
      .values(comment)
      .onConflictDoUpdate({ target: comments.id, set: comment });
  }
  console.log(
    `${followSeeds.length} follows, ${likeSeeds.length} likes, ${saveSeeds.length} saves, ${commentSeeds.length} comments`,
  );

  // -- Conversations + messages --------------------------------------------
  const conversationSeeds = [
    {
      id: 'd0000000-0000-4000-8000-000000000001',
      type: 'DIRECT' as const,
      boardId: null,
      name: null,
      createdBy: maya.id,
    },
    {
      id: 'd0000000-0000-4000-8000-000000000002',
      type: 'BOARD' as const,
      boardId: japan.id,
      name: null,
      createdBy: maya.id,
    },
    {
      // QA account <-> Maya (direct)
      id: 'd0000000-0000-4000-8000-000000000003',
      type: 'DIRECT' as const,
      boardId: null,
      name: null,
      createdBy: maya.id,
    },
    {
      // QA account <-> Leo (direct)
      id: 'd0000000-0000-4000-8000-000000000004',
      type: 'DIRECT' as const,
      boardId: null,
      name: null,
      createdBy: leo.id,
    },
    {
      // Named group chat (shows under "Groups" alongside board chats).
      id: 'd0000000-0000-4000-8000-000000000005',
      type: 'GROUP' as const,
      boardId: null,
      name: 'Sakura Crew 2027',
      createdBy: maya.id,
    },
    {
      // Lisbon board chat
      id: 'd0000000-0000-4000-8000-000000000006',
      type: 'BOARD' as const,
      boardId: boardSeeds[1].id,
      name: null,
      createdBy: leo.id,
    },
  ];
  for (const conversation of conversationSeeds) {
    await db
      .insert(conversations)
      .values(conversation)
      .onConflictDoUpdate({ target: conversations.id, set: conversation });
  }

  const memberSeeds = [
    { conversationId: conversationSeeds[0].id, userId: maya.id },
    { conversationId: conversationSeeds[0].id, userId: leo.id },
    { conversationId: conversationSeeds[1].id, userId: maya.id },
    { conversationId: conversationSeeds[1].id, userId: leo.id },
    { conversationId: conversationSeeds[1].id, userId: nina.id },
    { conversationId: conversationSeeds[1].id, userId: test.id },
    { conversationId: conversationSeeds[1].id, userId: omar.id },
    { conversationId: conversationSeeds[1].id, userId: priya.id },
    { conversationId: conversationSeeds[2].id, userId: maya.id },
    { conversationId: conversationSeeds[2].id, userId: test.id },
    { conversationId: conversationSeeds[3].id, userId: leo.id },
    { conversationId: conversationSeeds[3].id, userId: test.id },
    { conversationId: conversationSeeds[4].id, userId: maya.id },
    { conversationId: conversationSeeds[4].id, userId: leo.id },
    { conversationId: conversationSeeds[4].id, userId: nina.id },
    { conversationId: conversationSeeds[4].id, userId: priya.id },
    { conversationId: conversationSeeds[4].id, userId: test.id },
    { conversationId: conversationSeeds[5].id, userId: leo.id },
    { conversationId: conversationSeeds[5].id, userId: nina.id },
    { conversationId: conversationSeeds[5].id, userId: test.id },
  ];
  for (const member of memberSeeds) {
    await db
      .insert(conversationMembers)
      .values(member)
      .onConflictDoNothing();
  }

  const messageSeeds = [
    {
      conversationId: conversationSeeds[0].id,
      senderId: leo.id,
      body: 'Are we still on for Lisbon in May?',
    },
    {
      conversationId: conversationSeeds[0].id,
      senderId: maya.id,
      body: 'Yes! I moved the flights to Thursday night - check the board.',
    },
    {
      conversationId: conversationSeeds[1].id,
      senderId: nina.id,
      body: 'Added two photography spots to Day 4.',
    },
    {
      conversationId: conversationSeeds[1].id,
      senderId: maya.id,
      body: 'Perfect. I will reorder the itinerary tonight.',
    },
    {
      conversationId: conversationSeeds[2].id,
      senderId: maya.id,
      body: 'Hey! Welcome aboard 👋 Start with our Japan board - I just added Day 2.',
    },
    {
      conversationId: conversationSeeds[2].id,
      senderId: test.id,
      body: 'Just saw it. The Asakusa timing looks spot on.',
    },
    {
      conversationId: conversationSeeds[3].id,
      senderId: leo.id,
      body: 'Lisbon board is live - rate the Alfama day when you get a sec.',
    },
    {
      conversationId: conversationSeeds[3].id,
      senderId: test.id,
      body: 'Looks great. Add the tram 28 loop and it is perfect.',
    },
    {
      conversationId: conversationSeeds[4].id,
      senderId: nina.id,
      body: 'Sakura forecast is out: peak bloom the last week of March 🌸',
    },
    {
      conversationId: conversationSeeds[4].id,
      senderId: maya.id,
      body: 'Booking flights tonight then.',
    },
    {
      conversationId: conversationSeeds[4].id,
      senderId: leo.id,
      body: 'Count me in - someone add a ramen crawl to Day 1.',
    },
    {
      conversationId: conversationSeeds[4].id,
      senderId: test.id,
      body: 'Fuunji is already pinned. You are welcome.',
    },
    {
      conversationId: conversationSeeds[5].id,
      senderId: leo.id,
      body: 'Swapped the surf day to Saturday - the tide was wrong on Friday.',
    },
    {
      conversationId: conversationSeeds[5].id,
      senderId: nina.id,
      body: 'Perfect, the market run works better on Friday then.',
    },
  ];
  // messages has an identity PK (no natural unique key), so clear the seeded
  // conversations first to keep the script idempotent.
  for (const conversation of conversationSeeds) {
    await db
      .delete(messages)
      .where(eq(messages.conversationId, conversation.id));
  }
  for (const message of messageSeeds) {
    await db.insert(messages).values(message);
  }
  console.log(
    `${conversationSeeds.length} conversations and ${messageSeeds.length} messages seeded`,
  );

  // -- Read receipts + list ordering ----------------------------------------
  // Unread counts come from `conversation_members.last_read_message_id`.
  // Everyone has read everything except the QA account's group chat and the
  // direct thread from Maya, so badge states are visible by hand.
  const { rows: latestRows } = await pool.query<{
    conversationId: string;
    maxId: string;
  }>(
    'SELECT conversation_id AS "conversationId", max(id) AS "maxId" FROM messages GROUP BY conversation_id',
  );
  for (const { conversationId, maxId } of latestRows) {
    await pool.query(
      'UPDATE conversation_members SET last_read_message_id = $1 WHERE conversation_id = $2 AND user_id <> $3',
      [maxId, conversationId, test.id],
    );
  }
  await pool.query(
    `UPDATE conversation_members cm SET last_read_message_id = m.max_id
     FROM (SELECT conversation_id, max(id) AS max_id FROM messages GROUP BY conversation_id) m
     WHERE cm.conversation_id = m.conversation_id AND cm.user_id = $1`,
    [test.id],
  );
  await pool.query(
    `UPDATE conversation_members SET last_read_message_id = NULL
     WHERE user_id = $1 AND conversation_id = ANY($2::uuid[])`,
    [test.id, [conversationSeeds[2].id, conversationSeeds[4].id]],
  );
  // Recency ordering for the conversation list (messages don't touch it).
  await pool.query(
    `UPDATE conversations c SET updated_at = COALESCE(
       (SELECT max(created_at) FROM messages m WHERE m.conversation_id = c.id),
       c.updated_at
     )`,
  );
  console.log('read receipts + conversation ordering updated');

  // -- Push tokens ----------------------------------------------------------
  for (const [index, user] of seedUsers.entries()) {
    await db
      .insert(pushTokens)
      .values({
        userId: user.id,
        token: `ExponentPushToken[seed-${index + 1}]`,
        platform: 'EXPO',
      })
      .onConflictDoNothing();
  }

  // -- Verify ---------------------------------------------------------------
  console.log('');
  console.log('Seed complete.');
  console.log(`  users=${SEED_USERS.length}`);
  console.log(`  boards=${boardSeeds.length}`);
  console.log('');
  console.log('Sign in with any of:');
  for (const user of seedUsers) {
    console.log(`  ${user.email} / ${user.password ?? SEED_PASSWORD}`);
  }
  console.log('');
  console.log('QA quick start (test@example.com):');
  console.log('  - member of the Japan + Lisbon boards (shared editing)');
  console.log('  - unread chats: "Sakura Crew 2027" + the thread from Maya');
  console.log('  - Profile shows an active trip (Day 2 of 8) + Saved boards');

  await pool.end();
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string })?.code,
        detail: (error as { detail?: string })?.detail,
        cause: (error as { cause?: unknown })?.cause,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
