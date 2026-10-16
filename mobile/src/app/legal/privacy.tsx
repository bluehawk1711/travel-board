import { LegalDocument, type LegalSection } from '@/components/legal-document';

const SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    paragraphs: [
      'To run Travel Board we store your account details, the boards you create, and the places you save. When you upload photos or avatars, those images are stored so they can be shown to you and your collaborators.',
    ],
    bullets: [
      'Account: name, email, and optionally a bio and avatar.',
      'Content: boards, sections, items, comments, and chat messages.',
      'Usage: device type and basic events needed to keep the app reliable.',
    ],
  },
  {
    heading: 'How we use your data',
    paragraphs: [
      'Your data powers the product — syncing boards with collaborators in real time, showing your trips in the explore feed, and sending you notifications you have opted into. We do not sell your personal information.',
    ],
  },
  {
    heading: 'Sharing & collaboration',
    paragraphs: [
      'When you add someone to a board or send a chat message, they can see that content. Public boards are visible to anyone using Travel Board; private boards stay visible only to their members.',
    ],
  },
  {
    heading: 'Third-party services',
    paragraphs: [
      'We use a small number of trusted services to operate: a hosted database, a cache and notification layer, Google Places for location data, and Google for sign-in. Each is used only for its purpose and never sells your data.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'You can edit your profile at any time from Settings. To request a copy or permanent deletion of your account and its data, contact support — we action verified requests promptly.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      'If this policy changes in a meaningful way, we will note the update date here and, where appropriate, notify you in the app.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      eyebrow="Your data"
      updated="Last updated October 2026"
      sections={SECTIONS}
    />
  );
}
