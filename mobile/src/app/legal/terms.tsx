import { LegalDocument, type LegalSection } from '@/components/legal-document';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance of terms',
    paragraphs: [
      'By creating a Travel Board account you agree to these terms. If you do not agree, please do not use the app.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'You are responsible for keeping your login secure and for the activity that happens under your account. You must be at least 13 years old to use Travel Board.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'Travel Board is for planning and sharing trips. Do not use it to post content that is illegal, infringes on someone else’s rights, or is intended to harass or mislead others.',
    ],
    bullets: [
      'Do not upload content you do not have the right to share.',
      'Do not attempt to disrupt or reverse-engineer the service.',
      'Do not use the platform for spam or unsolicited promotion.',
    ],
  },
  {
    heading: 'Your content',
    paragraphs: [
      'You keep ownership of the boards, photos, and messages you create. You give Travel Board a licence to store, display, and sync that content so the product can function for you and the collaborators you invite.',
    ],
  },
  {
    heading: 'Our service',
    paragraphs: [
      'We work hard to keep Travel Board available and accurate, but the service is provided “as is”. We are not liable for indirect or consequential losses arising from your use of the app to the fullest extent permitted by law.',
    ],
  },
  {
    heading: 'Termination',
    paragraphs: [
      'You can delete your account at any time. We may suspend or close accounts that breach these terms. Sections concerning ownership, licences, and liability survive termination.',
    ],
  },
  {
    heading: 'Changes to these terms',
    paragraphs: [
      'We may update these terms as the product evolves. The update date above reflects the latest revision; continued use after a change means you accept the new terms.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      eyebrow="The agreement"
      updated="Last updated October 2026"
      sections={SECTIONS}
    />
  );
}
