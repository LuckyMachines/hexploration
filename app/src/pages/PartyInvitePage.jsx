import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { acceptPartyInvite, authenticateReturnService, loadReturnSession, previewPartyInvite } from '../lib/returnService';
import { trackJourneyEvent } from '../lib/analytics';

export default function PartyInvitePage() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const { address, chainId, connect } = useWallet();
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState({ kind: 'loading', message: 'Checking invitation...' });

  useEffect(() => {
    previewPartyInvite(inviteToken).then((value) => { setPreview(value); setStatus({ kind: 'ready', message: '' }); trackJourneyEvent('party_invite_opened', { party_size: value.capacity }); }).catch(() => setStatus({ kind: 'error', message: 'This invitation is expired, revoked, full, or unavailable.' }));
  }, [inviteToken]);

  const accept = async () => {
    setStatus({ kind: 'loading', message: 'Reserving your place...' });
    try {
      const wallet = address || await connect();
      let session = loadReturnSession();
      if (!session || session.wallet !== wallet.toLowerCase()) session = await authenticateReturnService(wallet, chainId || 11155111);
      const result = await acceptPartyInvite(inviteToken, session.token);
      trackJourneyEvent('party_joined', { party_size: result.party?.capacity || preview.capacity });
      setStatus({ kind: 'ready', message: `You joined ${result.party?.name || preview.name}.` });
      window.setTimeout(() => navigate(result.party?.gameId ? `/game/${result.party.gameId}` : '/#live-expedition'), 700);
    } catch (error) {
      setStatus({ kind: 'error', message: error.message || 'The invitation could not be accepted.' });
    }
  };

  return <main className="mx-auto flex min-h-[70svh] w-full max-w-3xl items-center px-4 py-12">
    <section className="w-full rounded border border-blueprint/40 bg-exp-panel p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-blueprint">Crew invitation</p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.12em] text-exp-text">{preview?.name || 'Finding your crew'}</h1>
      {preview && <>
        <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">{preview.inviterCallsign} invited you to a {preview.capacity}-explorer party. {preview.memberCount} place{preview.memberCount === 1 ? ' is' : 's are'} currently filled.</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Expires {new Date(preview.expiresAt).toLocaleString()}</p>
        <button type="button" disabled={status.kind === 'loading'} onClick={accept} className="mt-6 min-h-11 rounded border border-compass/50 bg-compass/10 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-compass-bright disabled:opacity-50">Join this party</button>
      </>}
      {status.message && <p role="status" className={`mt-4 font-mono text-xs ${status.kind === 'error' ? 'text-signal-red' : 'text-exp-text-dim'}`}>{status.message}</p>}
      <Link to="/#live-expedition" className="mt-5 inline-flex min-h-11 items-center font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Return to expedition board</Link>
    </section>
  </main>;
}
