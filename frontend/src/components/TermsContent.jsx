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
      'If you buy Premium: the pass you bought, its Razorpay order or subscription ID and the date your Premium access ends. Card, UPI and bank details are entered on Razorpay\'s checkout and never reach or get stored on our servers.',
      'Usage data: pages viewed, clicks, device type, referring site, and campaign tags (UTM), linked to your account while you are signed in.',
    ],
  },
  {
    title: 'Why we use it',
    items: [
      'To run the service: save your progress, keep your resumes, and show your profile.',
      'To show the leaderboard: your username and XP appear there. Your profile is public only if you share your username link.',
      'To process payments and manage Premium: unlock paid features, show when your access ends and handle cancellations.',
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
    title: 'Premium passes',
    items: [
      'Premium unlocks personalized company roadmaps: company-tagged practice problems, cheat sheets, direct question links and progress tracking. It also includes 6 mock interviews with real interviewers per calendar month (India time), which do not carry over. Free features stay free.',
      'Premium is sold as a one-time pass: Monthly (31 days), Yearly (365 days) or Lifetime (for as long as the service runs). The price is shown before you pay. Passes do not renew automatically.',
      'Buying another pass while Premium is active adds its time after your current end date.',
      'Members who subscribed to the earlier monthly Premium subscription keep it until they cancel; it renews monthly on the same card or UPI mandate and ends at the close of the period already paid for if a renewal fails.',
      'Roadmap content is for your personal preparation. Do not share your account or republish Premium content.',
    ],
  },
  {
    title: 'Mock interviews with real interviewers',
    items: [
      'Booking a mock interview as a candidate is free for everyone for requests made until 15 November 2026. Giving interviews as an interviewer is always free.',
      'After that, each booking uses one interview from your allowance: first the 6 a month included with Premium, then a monthly interview plan (5 or 10 interviews per billing month, at the price shown before you pay). Unused interviews do not carry over.',
      'An interview you cancel, or one where the interviewer does not turn up, does not use your allowance. One where you do not turn up does.',
      'Interview plans renew automatically each month until you cancel from your profile; your remaining interviews stay bookable until the end of the month you paid for. Interviewers are volunteers and members; we do not guarantee that a request is accepted, and an unaccepted request can be cancelled at no cost.',
    ],
  },
  {
    title: 'System design practice plans',
    items: [
      'Solo system design practice scores your answer automatically, out of 10, by how much of a strong design it covers. It is a practice aid, not an assessment of your ability or a hiring signal.',
      'Every member gets 3 free scored attempts in total. After that, monthly plans give 12, 18 or 24 scored attempts per billing month at the price shown before you pay. Unused attempts do not carry over.',
      'Plans renew automatically each month until you cancel from your profile; you keep the remaining attempts until the end of the month you paid for. Switching plans starts the new plan straight away and ends the old one.',
      'Your answers (typed or transcribed from speech) and scores are saved so you can review your progress. Voice answers are transcribed by your browser\'s speech recognition service (in Chrome and Edge, the audio is sent to Google or Microsoft for this); we never receive or store audio, only the resulting text.',
      'Practice plans are separate from Premium.',
    ],
  },
  {
    title: 'Returns and refunds',
    items: [
      'Most of the service is free. Premium (personalized company roadmaps) is a one-time pass (Monthly, Yearly or Lifetime) paid in advance through Razorpay at the price shown before you pay.',
      'Passes do not renew, so there is nothing to cancel. Members on the earlier monthly subscription can cancel from their profile; cancelling stops future renewals and keeps Premium until the end of the period already paid for.',
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
