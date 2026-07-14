import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Before you connect a wallet',
    body: 'The player keeps expedition return history, interface preferences, and random analytics identifiers in this browser. You can clear site data in your browser at any time. No wallet is required for the starter expedition.',
  },
  {
    title: 'Privacy-safe measurement',
    body: 'The self-hosted Plausible service receives page routes and an allowlisted set of journey milestones. Events use random installation and session journey IDs. The player rejects wallet addresses, email addresses, signatures, tokens, URLs, and unregistered properties before an event can be sent.',
  },
  {
    title: 'When you choose cross-device history',
    body: 'After a wallet signature, the return service stores the wallet-linked callsign, role, notification preferences, versioned return state, player annotations, and privacy-safe retention events. Session tokens are stored only in this browser; the service retains only cryptographic hashes.',
  },
  {
    title: 'Export and deletion',
    body: 'Once cross-device history is connected, the return panel can download a JSON export or erase wallet-linked off-chain profile data. Deletion invalidates sessions, erases profile and return state, and removes player annotations. Retained aggregate events are detached from the wallet.',
  },
  {
    title: 'What cannot be erased',
    body: 'Public blockchain transactions and chain-derived expedition history are not controlled by the return service and cannot be deleted from the network. The export identifies this boundary so it is visible before deletion.',
  },
];

export default function PrivacyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">Data and privacy</p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.14em] text-exp-text sm:text-4xl">Know what the expedition remembers</h1>
      <p className="mt-4 max-w-3xl font-mono text-sm leading-relaxed text-exp-text-dim">
        Xenovoya separates local play, optional wallet-linked cloud history, privacy-safe measurement, and public on-chain records. Cross-device storage is opt-in and appears only after a meaningful player choice.
      </p>
      <div className="mt-8 space-y-3">
        {sections.map((section) => (
          <article key={section.title} className="rounded border border-exp-border bg-exp-panel/80 p-5">
            <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{section.title}</h2>
            <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">{section.body}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 rounded border border-compass/35 bg-compass/5 p-5">
        <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-compass-bright">Use your controls</h2>
        <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">
          Return to the home expedition panel to remove the local cloud session, download your off-chain export, clear local history, or confirm permanent deletion of cloud profile data.
        </p>
        <Link to="/#return-loop" className="mt-4 inline-flex rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Open return controls</Link>
      </div>
    </section>
  );
}
