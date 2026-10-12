/**
 * Default data seeder (dev / staging / e2e testing).
 *
 * Usage:
 *   pnpm --dir backend db:seed
 *
 * Creates the `pg_trgm` extension (Drizzle can't express it), then inserts a
 * deterministic demo world: users (all password `password123`), boards with
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

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  // -- Users + per-user settings -------------------------------------------
  for (const user of SEED_USERS) {
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
  console.log(`${SEED_USERS.length} users seeded (password: ${SEED_PASSWORD})`);

  const [maya, leo, nina, omar] = SEED_USERS;

  // -- Boards ---------------------------------------------------------------
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
  console.log(`${boardSeeds.length} boards seeded`);

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
  ];
  for (const like of likeSeeds) {
    await db.insert(likes).values(like).onConflictDoNothing();
  }

  // "Saves" are a dedicated table (see boardSaves in schema.ts).
  const saveSeeds = [
    { boardId: japan.id, userId: leo.id },
    { boardId: boardSeeds[1].id, userId: nina.id },
    { boardId: boardSeeds[2].id, userId: omar.id },
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

  // -- Push tokens ----------------------------------------------------------
  for (const [index, user] of SEED_USERS.entries()) {
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
  for (const user of SEED_USERS) {
    console.log(`  ${user.email} / ${SEED_PASSWORD}`);
  }

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
