// Terms of use and privacy notice shown at sign-up. Items in [brackets] must be confirmed before launch (deletion and complaint timings).
const SECTIONS = [
  {
    title: 'What we collect',
    items: [
      'Account details you enter: email, name, optional username, password (stored only as a salted hash).',
      'Your location: the country and city you choose, and an approximate location from your IP address when you sign up or log in.',
      'Your activity: questions you read, mark as read, flag or mark important, and your personal notes.',
      'Resume content you write in the resume builder, including the PDFs and LaTeX you generate.',
      'Code you run or submit in the practice editor, and mock-interview bookings (the slot, interview type and any notes you add).',
      'Feedback you send us: your rating, message, optional email and any screenshots you attach.',
      'If you buy Premium: your Razorpay subscription ID, its status and the date your Premium access ends. Card, UPI and bank details are entered on Razorpay\'s checkout and never reach or get stored on our servers.',
      'Usage data: pages viewed, clicks, device type, referring site, and campaign tags (UTM), linked to your account while you are signed in.',
    ],
  },
  {
    title: 'Why we use it',
    items: [
      'To run the service: save your progress, keep your resumes, and show your profile.',
      'To show the leaderboard: your username and XP appear there. Your profile is public only if you share your username link.',
      'To process payments and manage Premium: unlock paid features, show your renewal date and handle cancellations.',
      'To send emails you have opted into: new-question digests, announcements, product updates (for example new roadmaps or features) and occasional requests for feedback. Every email has an unsubscribe link.',
      'To improve the product: usage is analysed in aggregate to understand which features are used.',
    ],
  },
  {
    title: 'Who sees it',
    items: [
      'You, and the site administrators for support and moderation.',
      'Service providers that host the app, send email, and store data, only as needed to run the service.',
      'Razorpay, our payment processor, for Premium payments. Razorpay handles your payment details under its own privacy policy.',
      'Company logos on the site are loaded from Google\'s favicon service, which, like any website you load content from, receives your IP address and browser details.',
      'We do not sell your personal data and we do not use it for third-party advertising.',
    ],
  },
  {
    title: 'Consent',
    items: [
      'We process your personal data only with your consent, which you give by creating an account and accepting these terms.',
      'Email digests and announcements are separate, optional consents. You can withdraw any consent at any time; withdrawing it does not affect past processing.',
    ],
  },
  {
    title: 'Cookies and local storage',
    items: [
      'We use cookies and browser storage that are needed to keep you signed in, remember your theme, and save your reading progress and code drafts on your device.',
      'We also record page views and clicks for analytics (see "What we collect"). We do not use advertising or third-party tracking cookies.',
      'You can clear cookies and site data in your browser settings at any time; you may need to sign in again.',
    ],
  },
  {
    title: 'Terms of use',
    items: [
      'Questions, answers and coding problems are provided for learning and interview preparation. We do not guarantee they are error-free or that they will get you a job.',
      'Do not scrape or copy the content in bulk, share your account, attack or overload the service, or upload anything unlawful.',
      'Content you write (notes, resumes) stays yours. We may suspend accounts that break these terms.',
      'We may change the service or these terms; continued use after a change means you accept it.',
    ],
  },
  {
    title: 'Premium subscription',
    items: [
      'Premium unlocks personalized company roadmaps: company-tagged practice problems, cheat sheets, direct question links and progress tracking. Free features stay free.',
      'Premium renews automatically every month on the same card or UPI mandate until you cancel. The price is shown before you pay; if it changes, we will tell you before your next renewal.',
      'If a renewal payment fails, Premium ends at the close of the period you already paid for.',
      'Roadmap content is for your personal preparation. Do not share your account or republish Premium content.',
    ],
  },
  {
    title: 'Returns and refunds',
    items: [
      'Most of the service is free. Premium (personalized company roadmaps) is a monthly subscription billed in advance through Razorpay at the price shown before you pay.',
      'You can cancel Premium at any time from your profile. Cancelling stops future renewals; you keep Premium until the end of the period you already paid for.',
      'Payments for a period that has already started are not refunded, except where the law requires it or a charge was made in error. For billing problems email us within 7 days of the charge. [Confirm this refund wording before launch.]',
    ],
  },
  {
    title: "Children's data",
    items: [
      'The service is intended for users aged 18 and over. If you are under 18, use it only with a parent or guardian\'s verifiable consent.',
      'We do not knowingly collect data from children, and we do not track or target children with advertising. If we learn we have, we will delete it.',
    ],
  },
  {
    title: 'Data security',
    items: [
      'Passwords are stored only as salted hashes, and data is sent over HTTPS.',
      'Access to personal data is limited to administrators who need it to run the service.',
      'No system is completely secure. If a breach affects your personal data, we will notify you and the relevant authority as the law requires.',
    ],
  },
  {
    title: 'How long we keep it (record retention)',
    items: [
      'Your account and content are kept while your account is active.',
      'Usage logs are kept for 48 months, then deleted or aggregated.',
      'We may keep limited records longer where the law requires, or to resolve disputes and prevent abuse.',
    ],
  },
  {
    title: 'Deleting your data',
    items: [
      'You can ask us to delete your account and personal data, including notes and resumes, at any time using the contact below.',
      'We delete it within [30] days of a verified request, except records we must keep by law. [Confirm the timing.]',
      'Backups are overwritten on their normal cycle.',
    ],
  },
  {
    title: 'Your choices',
    items: [
      'Access, correct or download your data from your profile.',
      'Opt out of emails at any time using the unsubscribe link in an email.',
      'Questions or requests: kaushikghosh199832@gmail.com.',
    ],
  },
  {
    title: 'Grievance officer',
    items: [
      'For complaints about how your data is handled, contact our Grievance Officer: Kaushik Ghosh, kaushikghosh199832@gmail.com, Pandapara Kalibari, Jalpaiguri.',
      'We acknowledge complaints within [72 hours] and aim to resolve them within [15 days].',
    ],
  },
]

export default function TermsContent() {
  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
      <p className="text-xs text-slate-500 dark:text-slate-400">Last updated: 2 November 2026</p>
      <p>By creating an account you agree to these terms and to how we handle your data as described below.</p>
      {SECTIONS.map(sec => (
        <section key={sec.title}>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{sec.title}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {sec.items.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
