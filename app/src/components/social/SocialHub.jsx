import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import {
  authenticateReturnService,
  createParty,
  createPartyInvite,
  blockPlayer,
  kickPartyMember,
  joinPublicParty,
  leaveParty,
  listFriends,
  listRecentPlayers,
  listParties,
  loadReturnSession,
  requestFriend,
  removeFriend,
  reportPlayer,
  revokePartyInvite,
  respondFriend,
  returnServiceEnabled,
  searchPlayers,
  setPartyReadiness,
  setFavorite,
  streamPresence,
  transferParty,
  updateParty,
  updatePresence,
} from '../../lib/returnService';
import { trackJourneyEvent } from '../../lib/analytics';
import ShareGameLink from '../shared/ShareGameLink';
import InviteQRCode from '../shared/InviteQRCode';

const tone = {
  online: 'text-oxide-green', 'in-lobby': 'text-compass-bright', 'in-game': 'text-blueprint', away: 'text-exp-text-dim', offline: 'text-exp-text-dim',
};

export default function SocialHub({ compact = false, gameId = null }) {
  const { address, chainId, connect } = useWallet();
  const [session, setSession] = useState(() => loadReturnSession());
  const [parties, setParties] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentPlayers, setRecentPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [form, setForm] = useState({ name: 'Lantern Crew', visibility: 'friends', capacity: 4, preferences: { mode: 'standard', region: 'auto', language: 'en', accessibility: [] } });
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState({ kind: 'idle', message: '' });
  const activeParty = parties[0] || null;
  const me = activeParty?.members.find((member) => member.wallet?.toLowerCase() === address?.toLowerCase());
  const isLeader = activeParty?.owner.wallet?.toLowerCase() === address?.toLowerCase();

  const refresh = useCallback(async (activeSession = session) => {
    if (!activeSession?.token) return;
    const [mine, open, connections, recent] = await Promise.allSettled([
      listParties('mine', '', activeSession.token),
      listParties('discover', '', activeSession.token),
      listFriends(activeSession.token),
      listRecentPlayers(activeSession.token),
    ]);
    if (mine.status === 'fulfilled') setParties(mine.value.parties || []);
    if (open.status === 'fulfilled') setDiscover(open.value.parties || []);
    if (connections.status === 'fulfilled') setFriends(connections.value.friends || []);
    if (recent.status === 'fulfilled') setRecentPlayers(recent.value.players || []);
    const failed = [mine, open, connections, recent].filter((result) => result.status === 'rejected');
    if (failed.length === 4) throw failed[0].reason;
  }, [session]);

  const connectSocial = useCallback(async () => {
    setStatus({ kind: 'working', message: 'Connecting your private crew profile...' });
    try {
      const wallet = address || await connect();
      const activeSession = await authenticateReturnService(wallet, chainId || 11155111);
      setSession(activeSession);
      await refresh(activeSession);
      setStatus({ kind: 'ready', message: 'Crew network restored.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error.message || 'Crew network could not connect.' });
    }
  }, [address, chainId, connect, refresh]);

  useEffect(() => {
    if (!session?.token || !address || session.wallet !== address.toLowerCase()) return;
    refresh(session).catch((error) => setStatus({ kind: 'error', message: error.message }));
  }, [address, refresh, session]);

  useEffect(() => {
    if (!session?.token) return undefined;
    const sendPresence = () => updatePresence({
      state: document.hidden ? 'away' : gameId ? 'in-lobby' : 'online',
      partyId: activeParty?.id || null,
      gameId: gameId ? String(gameId) : null,
    }, session.token).catch(() => {});
    sendPresence();
    const heartbeat = window.setInterval(sendPresence, 45_000);
    document.addEventListener('visibilitychange', sendPresence);
    return () => { window.clearInterval(heartbeat); document.removeEventListener('visibilitychange', sendPresence); };
  }, [activeParty?.id, gameId, session?.token]);

  useEffect(() => {
    if (!session?.token) return undefined;
    const controller = new AbortController();
    let fallback;
    let stopped = false;
    const refreshWhenVisible = () => { if (!document.hidden) refresh(session).catch(() => {}); };
    const scheduleFallback = () => {
      if (stopped) return;
      fallback = window.setTimeout(() => { refreshWhenVisible(); scheduleFallback(); }, document.hidden ? 60_000 : 15_000);
    };
    streamPresence(refreshWhenVisible, session.token, controller.signal).catch(() => {});
    scheduleFallback();
    return () => { stopped = true; controller.abort(); window.clearTimeout(fallback); };
  }, [refresh, session]);

  const run = async (message, operation) => {
    setStatus({ kind: 'working', message });
    try {
      const result = await operation();
      await refresh();
      setStatus({ kind: 'ready', message: 'Crew state updated.' });
      return result;
    } catch (error) {
      setStatus({ kind: 'error', message: error.message || 'The crew update failed safely.' });
      return null;
    }
  };

  const inviteUrl = useMemo(() => invite?.token && typeof window !== 'undefined' ? `${window.location.origin}/invite/${invite.token}` : '', [invite]);
  if (!returnServiceEnabled()) return compact ? null : (
    <section className="rounded border border-exp-border bg-exp-panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Crew network</p>
      <p className="mt-2 font-mono text-xs text-exp-text-dim">Party and friend services become available when the return API is configured.</p>
    </section>
  );

  if (!session?.token || !address || session.wallet !== address.toLowerCase()) return (
    <section className="rounded border border-blueprint/30 bg-exp-panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-blueprint">Private crew network</p>
      <h2 className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-exp-text">Find your people, then keep the party</h2>
      <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">One wallet signature restores parties and friends across devices. Public party and invite previews never expose wallet addresses.</p>
      <button type="button" disabled={status.kind === 'working'} onClick={connectSocial} className="mt-4 min-h-11 rounded border border-blueprint/45 bg-blueprint/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-blueprint disabled:opacity-50">Connect crew network</button>
      {status.message && <p className="mt-2 font-mono text-[11px] text-exp-text-dim" role="status">{status.message}</p>}
    </section>
  );

  const create = () => run('Creating a durable party...', async () => {
    const result = await createParty(form, session.token);
    trackJourneyEvent('party_created', { visibility: form.visibility, party_size: form.capacity });
    return result;
  });
  const makeInvite = () => run('Creating a revocable invitation...', async () => {
    const result = await createPartyInvite(activeParty.id, {}, session.token);
    setInvite(result);
    trackJourneyEvent('party_invite_created', { visibility: activeParty.visibility, party_size: activeParty.capacity });
    return result;
  });
  const find = async (event) => {
    event.preventDefault();
    if (search.trim().length < 2) return;
    const result = await run('Searching by callsign...', () => searchPlayers(search.trim(), session.token));
    if (result) setSearchResults(result.players || []);
  };

  return (
    <section className="rounded border border-blueprint/30 bg-exp-panel" aria-labelledby="crew-network-title" data-testid="social-hub">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-exp-border px-4 py-4 sm:px-5">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-blueprint">Crew network</p><h2 id="crew-network-title" className="mt-1 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{activeParty?.name || 'Create or find a party'}</h2></div>
        {activeParty && <span className="rounded border border-oxide-green/35 bg-oxide-green/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-oxide-green">{activeParty.memberCount}/{activeParty.capacity} crew</span>}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {activeParty ? <>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeParty.members.map((member) => <div key={member.callsign + member.joinedAt} className="flex items-center justify-between gap-2 rounded border border-exp-border bg-exp-dark/35 px-3 py-3">
              <div><p className="font-mono text-xs text-exp-text">{member.callsign}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">{member.role}</p></div>
              <div className="flex items-center gap-2"><span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${member.ready ? 'text-oxide-green' : 'text-exp-text-dim'}`}>{member.ready ? 'Ready' : 'Preparing'}</span>{isLeader && member.wallet && member.wallet.toLowerCase() !== address.toLowerCase() && <><button type="button" onClick={() => run('Transferring leadership...', () => transferParty(activeParty.id, member.wallet, session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-blueprint">Lead</button><button type="button" onClick={() => run('Removing crew member...', () => kickPartyMember(activeParty.id, member.wallet, session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-signal-red">Remove</button></>}</div>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => run('Updating readiness...', () => setPartyReadiness(activeParty.id, !me?.ready, session.token))} className="min-h-11 rounded border border-oxide-green/40 bg-oxide-green/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-oxide-green">{me?.ready ? 'Not ready' : 'Ready up'}</button>
            <button type="button" onClick={makeInvite} className="min-h-11 rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Create invite</button>
            {isLeader && gameId && activeParty.gameId !== String(gameId) && <button type="button" onClick={() => run('Linking this expedition...', () => updateParty(activeParty.id, { expectedVersion: activeParty.version, gameId: String(gameId), status: 'in-game' }, session.token))} className="min-h-11 rounded border border-compass/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Link expedition #{gameId}</button>}
            <button type="button" onClick={() => run('Leaving party...', () => leaveParty(activeParty.id, session.token))} className="min-h-11 rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Leave party</button>
          </div>
          {inviteUrl && <div className="flex flex-wrap items-center gap-4 rounded border border-blueprint/30 bg-blueprint/5 p-3"><InviteQRCode url={inviteUrl} /><div><p className="mb-2 font-mono text-[10px] text-exp-text-dim">Invitation expires {new Date(invite.expiresAt).toLocaleString()}.</p><div className="flex flex-wrap items-center gap-2"><ShareGameLink url={inviteUrl} label="Copy invitation" shareText={`Join ${activeParty.name} in Xenovoya`} /><button type="button" onClick={() => run('Revoking invitation...', async () => { const result = await revokePartyInvite(activeParty.id, invite.id, session.token); setInvite(null); return result; })} className="min-h-11 px-2 font-mono text-[9px] uppercase text-signal-red">Revoke</button></div></div></div>}
        </> : <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Party name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={48} className="mt-1 min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 text-xs normal-case tracking-normal text-exp-text" /></label>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Privacy<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })} className="mt-1 block min-h-11 rounded border border-exp-border bg-exp-dark px-3 text-xs text-exp-text"><option value="friends">Friends</option><option value="private">Private</option><option value="public">Public</option></select></label>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Crew size<select value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} className="mt-1 block min-h-11 rounded border border-exp-border bg-exp-dark px-3 text-xs text-exp-text"><option value="1">Solo</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
            <button type="button" onClick={create} className="self-end min-h-11 rounded border border-compass/45 bg-compass/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Create party</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">Style<select value={form.preferences.mode} onChange={(event) => setForm({ ...form, preferences: { ...form.preferences, mode: event.target.value } })} className="mt-1 block min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 text-xs text-exp-text"><option value="guided">Guided</option><option value="standard">Standard</option><option value="challenge">Challenge</option></select></label>
            <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">Region<select value={form.preferences.region} onChange={(event) => setForm({ ...form, preferences: { ...form.preferences, region: event.target.value } })} className="mt-1 block min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 text-xs text-exp-text"><option value="auto">Auto</option><option value="americas">Americas</option><option value="europe">Europe</option><option value="asia-pacific">Asia Pacific</option></select></label>
            <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">Language<input value={form.preferences.language} onChange={(event) => setForm({ ...form, preferences: { ...form.preferences, language: event.target.value.toLowerCase() } })} maxLength={12} className="mt-1 min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 text-xs normal-case tracking-normal text-exp-text" /></label>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded border border-exp-border bg-exp-dark/30 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim"><input type="checkbox" checked={form.preferences.accessibility.includes('reduced-motion')} onChange={(event) => setForm({ ...form, preferences: { ...form.preferences, accessibility: event.target.checked ? ['reduced-motion'] : [] } })} /> Prefer a reduced-motion crew</label>
          {discover.length > 0 && <div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Joinable parties</p><div className="grid gap-2 sm:grid-cols-2">{discover.slice(0, 6).map((party) => <div key={party.id} className="flex items-center justify-between gap-3 rounded border border-exp-border bg-exp-dark/35 p-3"><div><p className="font-mono text-xs text-exp-text">{party.name}</p><p className="mt-1 font-mono text-[10px] text-exp-text-dim">{party.memberCount}/{party.capacity} explorers - {party.visibility}</p></div><button type="button" onClick={() => run('Joining party...', () => joinPublicParty(party.id, session.token))} className="min-h-11 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-oxide-green">Join</button></div>)}</div></div>}
        </>}

        {!compact && <div className="border-t border-exp-border pt-4">
          <form onSubmit={find} className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find by callsign" aria-label="Find player by callsign" className="min-h-11 min-w-0 flex-1 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text" /><button type="submit" className="min-h-11 rounded border border-exp-border px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text">Find friend</button></form>
          {searchResults.map((player) => <div key={player.wallet} className="mt-2 flex items-center justify-between rounded border border-exp-border px-3 py-2"><span className="font-mono text-xs text-exp-text">{player.callsign}</span><button type="button" onClick={() => run('Sending friend request...', () => requestFriend(player.wallet, session.token))} className="min-h-11 px-3 font-mono text-[10px] uppercase tracking-[0.15em] text-blueprint">Add friend</button></div>)}
          {friends.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{friends.map((friend) => <div key={friend.wallet} className="rounded border border-exp-border bg-exp-dark/30 p-3"><div className="flex items-center justify-between"><span className="font-mono text-xs text-exp-text">{friend.favorite ? 'Favorite: ' : ''}{friend.callsign}</span><span className={`font-mono text-[9px] uppercase ${tone[friend.presence] || tone.offline}`}>{friend.presence || friend.direction}</span></div>{friend.direction === 'incoming' ? <div className="mt-2 flex gap-2"><button type="button" onClick={() => run('Accepting friend...', () => respondFriend(friend.wallet, 'accept', session.token))} className="min-h-11 px-2 font-mono text-[10px] uppercase text-oxide-green">Accept</button><button type="button" onClick={() => run('Declining request...', () => respondFriend(friend.wallet, 'decline', session.token))} className="min-h-11 px-2 font-mono text-[10px] uppercase text-exp-text-dim">Decline</button></div> : friend.direction === 'accepted' && <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => run('Updating favorite...', () => setFavorite(friend.wallet, !friend.favorite, session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-compass-bright">{friend.favorite ? 'Unfavorite' : 'Favorite'}</button><button type="button" onClick={() => run('Removing friend...', () => removeFriend(friend.wallet, session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-exp-text-dim">Remove</button><button type="button" onClick={() => run('Blocking player...', () => blockPlayer(friend.wallet, session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-signal-red">Block</button><button type="button" onClick={() => run('Sending safety report...', () => reportPlayer(friend.wallet, 'other', 'Reported from crew network controls.', session.token))} className="min-h-11 px-2 font-mono text-[9px] uppercase text-signal-red">Report</button></div>}</div>)}</div>}
          {recentPlayers.length > 0 && <div className="mt-4"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Recent explorers</p><div className="mt-2 flex flex-wrap gap-2">{recentPlayers.map((player) => <button key={player.wallet} type="button" onClick={() => run('Sending friend request...', () => requestFriend(player.wallet, session.token))} className="min-h-11 rounded border border-exp-border px-3 font-mono text-[10px] text-exp-text">{player.callsign} - {player.sharedExpeditions} shared</button>)}</div></div>}
        </div>}
        {status.message && <p role="status" className={`font-mono text-[11px] ${status.kind === 'error' ? 'text-signal-red' : 'text-exp-text-dim'}`}>{status.message}</p>}
      </div>
    </section>
  );
}
