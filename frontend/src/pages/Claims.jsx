import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardCheck, PartyPopper, AlertCircle, CheckCircle2, XCircle, Search as SearchIcon, CalendarCheck, HelpCircle, Ban } from 'lucide-react';
import { Async, Badge, Button, ButtonLink, Card, Checkbox, ConfirmDialog, EmptyState, Input, ListSkeleton, Modal, PageHeader, Pagination, ScoreRing, Skeleton, StatusBadge, Table, Textarea, Timeline } from '../components/ui';
import { ItemImage } from '../components/ItemCard';
import { MatchBreakdown } from '../components/MatchCard';
import SafeImage from '../components/SafeImage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { fmtDate, fmtDateTime, stagger, timeAgo, today } from '../utils/format';

export function MyClaims() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const state = useFetch(() => api.get('/claims', { page, limit: 10 }), [page]);
  const columns = [
    { header: 'Claim ID', render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.claimId}</span> },
    { header: 'Item', render: (c) => <span className="font-medium">{c.foundItem?.itemName}</span> },
    { header: 'Claim date', render: (c) => <span className="tabular-nums">{fmtDate(c.createdAt)}</span> },
    { header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { header: 'Last updated', render: (c) => <span className="tabular-nums text-muted-foreground">{timeAgo(c.updatedAt)}</span> },
    { header: '', className: 'text-right', render: (c) => <ButtonLink to={`/claims/${c._id}`} size="sm" variant="secondary">Details</ButtonLink> },
  ];
  return (
    <div>
      <PageHeader title="My Claims" subtitle="Track the progress of every claim you have submitted." />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0}
        empty={<Card><EmptyState icon={ClipboardCheck} title="No claims yet" message="When you spot your item in the found list, submit a claim to start verification."
          action={<Button onClick={() => navigate('/browse?type=found')}>Browse Found Items</Button>} /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>
    </div>
  );
}

// Timeline steps are derived from the claim itself, so they can never drift from the real status.
function buildSteps(c) {
  const reviewed = c.status !== 'Pending';
  const approved = ['Approved', 'Completed'].includes(c.status);
  const flags = [
    true, reviewed, !!c.reviewedBy || approved || c.status === 'Rejected', approved,
    !!c.handover?.status, c.status === 'Completed',
  ];
  const labels = [
    ['Claim Submitted', fmtDateTime(c.createdAt)], ['Under Review'], ['Verification'], ['Approved', c.reviewComments],
    ['Handover', c.handover?.status ? `${c.handover.status}${c.handover.date ? ` · ${fmtDate(c.handover.date)}` : ''}` : undefined], ['Completed'],
  ];
  const firstOpen = flags.indexOf(false);
  const closed = ['Rejected', 'Cancelled'].includes(c.status);
  return labels.map(([label, note], i) => ({ label, note, done: flags[i], current: !closed && i === firstOpen }));
}

const Row = ({ label, children, className }) => children ? (<div className={className}><dt className="eyebrow">{label}</dt><dd className="mt-1 text-sm">{children}</dd></div>) : null;
const Panel = ({ title, children, className = '' }) => (
  <section className={`rounded-md border border-border p-5 ${className}`}><h2 className="mb-4 text-sm font-medium">{title}</h2>{children}</section>
);

function ReasonModal({ open, onClose, title, label, confirmLabel, variant, required = true, onSubmit }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (required && !text.trim()) return;
    setBusy(true);
    try { await onSubmit(text.trim()); setText(''); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={variant} loading={busy} disabled={required && !text.trim()} onClick={submit}>{confirmLabel}</Button></>}>
      <Textarea label={label} value={text} onChange={(e) => setText(e.target.value)} rows={4} required={required} />
    </Modal>
  );
}

function HandoverPanel({ claim, isStaff, reload }) {
  const toast = useToast();
  const [form, setForm] = useState({ date: today(), location: 'Security Office' });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const h = claim.handover;
  const send = async (body, msg) => {
    setBusy(true);
    try { await api.put(`/claims/${claim._id}/handover`, body); toast.success(msg); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Panel title="Item handover">
      {h?.status ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Status"><Badge tone={h.status === 'Completed' ? 'green' : 'amber'}>Handover {h.status}</Badge></Row>
          <Row label="Date">{fmtDate(h.date)}</Row>
          <Row label="Location">{h.location}</Row>
          <Row label="Verified by">{h.verifiedBy?.name}</Row>
          {h.receiverConfirmed && <Row label="Receiver confirmation">Confirmed {fmtDateTime(h.completedAt)}</Row>}
        </dl>
      ) : <p className="text-sm text-muted-foreground">{isStaff ? 'Schedule a time and place for the owner to collect the item.' : 'Staff will schedule a handover soon. You will be notified.'}</p>}

      {isStaff && !h?.status && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Handover date" type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Handover location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="sm:col-span-2"><Button icon={CalendarCheck} loading={busy} disabled={!form.date || !form.location} onClick={() => send({ action: 'schedule', ...form }, 'Handover scheduled.')}>Schedule handover</Button></div>
        </div>
      )}
      {isStaff && h?.status === 'Scheduled' && (
        <div className="mt-5 space-y-4 rounded-md border border-border bg-muted/40 p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm"><Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />The receiver confirmed they collected the item and signed the register</label>
          <Button variant="success" icon={CheckCircle2} loading={busy} disabled={!confirmed} onClick={() => send({ action: 'complete', receiverConfirmed: true }, 'Item recovered. Handover complete.')}>Mark handover complete</Button>
        </div>
      )}
    </Panel>
  );
}

const Notice = ({ icon: Icon, children, strong }) => (
  <div role="status" className={`flex items-start gap-3 rounded-md border p-4 text-sm ${strong ? 'border-foreground' : 'border-border bg-muted/40'}`}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /><div className="space-y-0.5">{children}</div>
  </div>
);

export function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get(`/claims/${id}`), [id]);
  const [dialog, setDialog] = useState(null);
  const [reply, setReply] = useState('');
  const isStaff = ['staff', 'admin'].includes(user.role);

  const run = (action, msg) => async (comments) => {
    try {
      await api.put(`/claims/${id}`, { action, comments });
      toast.success(msg);
      window.dispatchEvent(new Event('clf:refresh-counts'));
      state.reload();
    } catch (e) { toast.error(e.message); throw e; }
  };

  return (
    <Async state={state} notFound="This claim could not be found." skeleton={<div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>}>
      {(c) => {
        const open = ['Pending', 'Under Review'].includes(c.status);
        const mine = c.claimant._id === user._id;
        const found = c.foundItemFull;
        return (
          <div>
            <PageHeader title={`Claim ${c.claimId}`} subtitle={`Submitted ${fmtDateTime(c.createdAt)} by ${c.claimant.name}`} actions={<StatusBadge status={c.status} />} />

            <div className="mb-8 space-y-3">
              {c.status === 'Approved' && (
                <Notice icon={CheckCircle2} strong>
                  <p className="font-semibold">Claim approved</p>
                  <p className="text-muted-foreground">{isStaff ? 'Schedule the handover so the owner can collect the item. It becomes Recovered once the handover is complete.' : 'Staff will arrange the handover. You will be notified when it is scheduled.'}</p>
                </Notice>
              )}
              {c.status === 'Completed' && (
                <Notice icon={PartyPopper} strong>
                  <p className="font-semibold">Item Successfully Recovered 🎉</p>
                  <p className="text-muted-foreground">The item was handed over to its owner.</p>
                </Notice>
              )}
              {c.status === 'Rejected' && <Notice icon={XCircle}><p><b className="font-medium">Claim rejected.</b> {c.reviewComments}</p></Notice>}
              {c.status === 'Cancelled' && <Notice icon={Ban}><p>This claim was cancelled.</p></Notice>}
              {c.infoRequest && open && (
                <Notice icon={AlertCircle} strong>
                  <p className="font-medium">Additional information requested</p>
                  <p className="text-muted-foreground">&ldquo;{c.infoRequest}&rdquo;</p>
                  {mine && (
                    <div className="space-y-2 pt-3">
                      <Textarea aria-label="Your response" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your response..." />
                      <Button disabled={!reply.trim()} onClick={async () => { await run('respond', 'Response sent to staff.')(reply.trim()); setReply(''); }}>Send response</Button>
                    </div>
                  )}
                </Notice>
              )}
            </div>

            <div style={stagger(1)} className="enter grid gap-10 lg:grid-cols-3 lg:gap-14">
              <div className="space-y-6 lg:col-span-2">
                <Panel title="Claimed item">
                  <Link to={`/items/found/${c.foundItem._id}`} className="-m-2 flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-muted/50">
                    <div className="size-20 shrink-0 overflow-hidden rounded-md border border-border"><ItemImage item={{ ...c.foundItem, type: 'found' }} compact /></div>
                    <div className="min-w-0 flex-1"><p className="font-medium">{c.foundItem.itemName}</p>
                      <p className="text-sm text-muted-foreground"><span className="font-mono text-xs">{c.foundItem.reportId}</span> · {c.foundItem.category} · {c.foundItem.location}</p></div>
                    {c.matchScore > 0 && <ScoreRing score={c.matchScore} />}
                  </Link>
                </Panel>

                {c.matchDetail && (
                  <Panel title="Why this item matched">
                    <div className="mb-4 flex items-center gap-4">
                      <ScoreRing score={c.matchDetail.score} size={64} />
                      <div><p className="text-xs font-semibold uppercase tracking-[0.14em]">{c.matchDetail.confidence}</p><p className="text-sm text-muted-foreground">Smart Matching Algorithm, from the lost report and the found report</p></div>
                    </div>
                    <MatchBreakdown breakdown={c.matchDetail.breakdown} score={c.matchDetail.score} />
                  </Panel>
                )}

                <Panel title="Verification answers">
                  <dl className="grid gap-5 sm:grid-cols-2">
                    <Row label="Where was it lost?">{c.answers.lostLocation}</Row>
                    <Row label="When was it lost?">{fmtDate(c.answers.lostDate)}</Row>
                    <Row className="sm:col-span-2" label="Unique identifying feature">{c.answers.uniqueFeature}</Row>
                    <Row className="sm:col-span-2" label="Additional information"><span className="whitespace-pre-line">{c.answers.additional}</span></Row>
                    {c.lostItem && <Row label="Linked lost report">{c.lostItem.reportId} · {c.lostItem.itemName}</Row>}
                  </dl>
                  {c.evidence && (
                    <a href={c.evidence} target="_blank" rel="noreferrer" aria-label="Open the proof image in a new tab" className="relative mt-5 block h-40 w-60 max-w-full overflow-hidden rounded-md border border-border bg-muted">
                      <SafeImage src={c.evidence} alt="Proof of ownership uploaded by the claimant" fallback={<span className="grid size-full place-items-center text-xs text-muted-foreground">Image unavailable</span>} />
                    </a>
                  )}
                </Panel>

                {isStaff && (
                  <Panel title="Staff verification">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-md bg-muted/50 p-4"><p className="eyebrow">Claimant</p>
                        <p className="mt-2 text-sm font-medium">{c.claimant.name}</p>
                        <p className="text-sm text-muted-foreground">{c.claimant.studentId} · {c.claimant.department}{c.claimant.year ? `, ${c.claimant.year}` : ''}</p>
                        <p className="text-sm text-muted-foreground">{c.claimant.email} · {c.claimant.phone}</p></div>
                      <div className="rounded-md bg-muted/50 p-4"><p className="eyebrow">Finder&apos;s private details</p>
                        <p className="mt-2 text-sm">{found?.uniqueFeatures || 'None recorded'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Held at: {found?.currentLocation || '-'}</p></div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">Report history: {c.claimantHistory?.lostReports ?? 0} lost reports, {c.claimantHistory?.claims.length ?? 0} other claims
                      {c.claimantHistory?.claims.length ? ` (${c.claimantHistory.claims.map((x) => `${x.claimId}: ${x.status}`).join(', ')})` : ''}.</p>
                    {open && (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
                        {c.status === 'Pending' && <Button variant="secondary" icon={SearchIcon} onClick={() => run('under_review', 'Claim marked as under review.')('')}>Start review</Button>}
                        <Button variant="success" icon={CheckCircle2} onClick={() => setDialog('approve')}>Approve</Button>
                        <Button variant="secondary" icon={HelpCircle} onClick={() => setDialog('info')}>Request More Information</Button>
                        <Button variant="danger" icon={XCircle} onClick={() => setDialog('reject')}>Reject</Button>
                      </div>
                    )}
                  </Panel>
                )}

                {['Approved', 'Completed'].includes(c.status) && <HandoverPanel claim={c} isStaff={isStaff} reload={state.reload} />}
                {mine && open && <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDialog('cancel')}>Cancel my claim</Button>}
              </div>

              <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                <Panel title="Claim progress"><Timeline steps={buildSteps(c)} /></Panel>
                <Panel title="History">
                  <ul className="space-y-4 text-sm">
                    {[...c.timeline].reverse().map((e, i) => (
                      <li key={i}><p className="font-medium">{e.label}</p>{e.note && <p className="text-muted-foreground">{e.note}</p>}
                        <p className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(e.at)}{e.by?.name ? ` · ${e.by.name}` : ''}</p></li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>

            <ReasonModal open={dialog === 'approve'} onClose={() => setDialog(null)} title="Approve claim" label="Verification notes (optional)" required={false} confirmLabel="Approve claim" variant="success" onSubmit={run('approve', 'Claim approved. Schedule the handover next.')} />
            <ReasonModal open={dialog === 'reject'} onClose={() => setDialog(null)} title="Reject claim" label="Reason for rejection" confirmLabel="Reject claim" variant="danger" onSubmit={run('reject', 'Claim rejected.')} />
            <ReasonModal open={dialog === 'info'} onClose={() => setDialog(null)} title="Request more information" label="What do you need from the claimant?" confirmLabel="Send request" variant="primary" onSubmit={run('request_info', 'Request sent to the claimant.')} />
            <ConfirmDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} onConfirm={() => run('cancel', 'Claim cancelled.')('')} title="Cancel claim" confirmLabel="Cancel claim" message="Are you sure you want to cancel this claim?" />
          </div>
        );
      }}
    </Async>
  );
}
