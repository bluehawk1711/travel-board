import type { ImageSource } from 'expo-image';

/** Number of slides in the first-run carousel (slides + dots + "n / 4"). */
export const ONBOARDING_SLIDE_COUNT = 4;

/**
 * Hero photography for the first-run onboarding carousel. Bundled from the
 * repo's own stitch designs (`stitch_travel_board_ui/onboarding_*`) so the
 * intro renders instantly and offline — a broken image on first launch is
 * the worst possible first impression.
 */
export const ONBOARDING_IMAGES: Record<string, ImageSource> = {
  // Slide 1 — Discover
  discoverAlps: require('@/assets/images/onboarding/discover-alps.jpg'),
  discoverKyoto: require('@/assets/images/onboarding/discover-kyoto.jpg'),
  discoverCoastal: require('@/assets/images/onboarding/discover-coastal.jpg'),
  // Slide 2 — Collaborate
  collaborateFuji: require('@/assets/images/onboarding/collaborate-fuji.jpg'),
  collaborateTsukiji: require('@/assets/images/onboarding/collaborate-tsukiji.jpg'),
  planner1: require('@/assets/images/onboarding/planner-1.jpg'),
  planner2: require('@/assets/images/onboarding/planner-2.jpg'),
  planner3: require('@/assets/images/onboarding/planner-3.jpg'),
  avatarAlex: require('@/assets/images/onboarding/avatar-alex.jpg'),
  avatarElena: require('@/assets/images/onboarding/avatar-elena.jpg'),
  // Slide 3 — Itinerary
  itineraryFlatlay: require('@/assets/images/onboarding/itinerary-flatlay.jpg'),
  // Slide 4 — Welcome
  welcomeAmalfi: require('@/assets/images/onboarding/welcome-amalfi.jpg'),
  welcomeKyotoFall: require('@/assets/images/onboarding/welcome-kyoto-fall.jpg'),
  welcomeFujiPagoda: require('@/assets/images/onboarding/welcome-fuji-pagoda.jpg'),
  welcomeAvatar1: require('@/assets/images/onboarding/welcome-avatar-1.jpg'),
  welcomeAvatar2: require('@/assets/images/onboarding/welcome-avatar-2.jpg'),
  socialAvatar1: require('@/assets/images/onboarding/social-avatar-1.jpg'),
  socialAvatar2: require('@/assets/images/onboarding/social-avatar-2.jpg'),
};

/**
 * Illustrative card content inside the hero visuals. This is decorative
 * demo content (like seed data), not app messaging — real UI copy lives in
 * `UI_MESSAGES.ONBOARDING` on `@travel-board/shared`.
 */
export const DISCOVER_CARDS = {
  alps: { tag: 'Swiss Alps 🏔️', rating: '4.9', boards: '14 boards' },
  kyoto: { tag: 'Kyoto 🇯🇵', rating: '5.0', boards: '28 boards' },
  coastal: {
    tag: 'Amalfi & Oia 🍋',
    title: 'Coastal Escapes',
    subtitle: 'Curated by 12k travelers',
    avatars: ['M', 'S', '+9'],
  },
  pills: { pinned: '340+ Pinned Spots', visuals: 'Smart Visuals' },
} as const;

export const COLLABORATE_CARDS = {
  session: {
    title: 'Tokyo & Kyoto 2026',
    subtitle: 'Autumn Foliage Journey • 4 Planners',
    overflow: '+',
  },
  collaborators: [
    ONBOARDING_IMAGES.planner1,
    ONBOARDING_IMAGES.planner2,
    ONBOARDING_IMAGES.planner3,
  ],
  pins: [
    {
      image: ONBOARDING_IMAGES.collaborateFuji,
      badge: 'Day 2',
      badgeIcon: 'push-pin',
      title: 'Lake Kawaguchi',
      meta: '$68 / person',
      metaTone: 'golden',
      likes: '4',
    },
    {
      image: ONBOARDING_IMAGES.collaborateTsukiji,
      badge: 'Split 4-ways',
      badgeIcon: 'payments',
      title: 'Tsukiji Street Crawl',
      meta: '10:30 AM',
      metaTone: 'tertiary',
      likes: '3',
    },
  ],
  activity: [
    {
      id: 'notes',
      avatar: ONBOARDING_IMAGES.avatarAlex,
      name: 'Alex',
      action: 'is adding',
      target: 'Tsukiji Market',
      tail: 'notes',
      time: 'Just now',
      live: true,
    },
    {
      id: 'liked',
      avatar: ONBOARDING_IMAGES.avatarElena,
      name: 'Elena',
      action: 'liked',
      target: 'Lake Kawaguchi',
      tail: '',
      time: '',
      live: false,
    },
  ],
} as const;

export const ITINERARY_CARDS = {
  collection: {
    section: '1-Tap Save & Itinerary',
    window: 'Kyoto • Day 2 of 4',
    title: 'Kyoto & Tokyo Highlights',
    placesSaved: '14 Places Saved',
    routesSynced: '3 Day Routes Synced',
    sequence: 'Day 2 Itinerary Sequence',
    savedChip: 'Saved',
  },
  place: {
    image: ONBOARDING_IMAGES.itineraryFlatlay,
    rating: '4.9 (4.8k)',
    category: 'Shrine & Trail',
    name: 'Fushimi Inari Taisha',
    slot: 'Day 2 Slot',
    target: 'Target visit: 09:00 AM • Golden Hour Hike',
    saved: 'Saved to Kyoto Wishlist',
    savedTag: 'Must Visit',
  },
  stopsLabel: '3 stops',
  stops: [
    {
      time: '09:00 AM',
      title: 'Fushimi Inari Shrine',
      note: 'Scenic hiking & 10,000 torii gates',
      tone: 'primary',
    },
    {
      time: '12:30 PM',
      title: 'Nishiki Market Food Tour',
      note: 'Street skewers, matcha, fresh sashimi',
      tone: 'golden',
    },
    {
      time: '15:30 PM',
      title: 'Kinkaku-ji Golden Pavilion',
      note: 'Reflecting pond & stroll gardens',
      tone: 'tertiary',
    },
  ],
  hint: 'Tap or drag stops to re-time route',
} as const;

export const WELCOME_CARDS = {
  back: {
    image: ONBOARDING_IMAGES.welcomeAmalfi,
    label: 'AMALFI COAST • 28 SPOTS',
  },
  middle: {
    image: ONBOARDING_IMAGES.welcomeKyotoFall,
    label: 'Kyoto Memories • Autumn 2024',
    rating: '4.9',
  },
  front: {
    image: ONBOARDING_IMAGES.welcomeFujiPagoda,
    ready: 'Curated & Ready',
    likes: '1.8k',
    status: 'TRIP COMPLETE',
    duration: '14 Days',
    title: 'Japan 2025',
    meta: '42 Photos & itinerary saved',
    overflow: '+4',
    avatars: [
      ONBOARDING_IMAGES.welcomeAvatar1,
      ONBOARDING_IMAGES.welcomeAvatar2,
    ] as ImageSource[],
  },
  proofAvatars: [
    ONBOARDING_IMAGES.socialAvatar1,
    ONBOARDING_IMAGES.socialAvatar2,
  ] as ImageSource[],
};
