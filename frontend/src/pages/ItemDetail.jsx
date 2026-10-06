import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Bookmark, BookmarkCheck, Flag, MessageSquare, Pencil, Sparkles, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Async, Badge, Button, ButtonLink, ConfirmDialog, Modal, Select, Skeleton, StatusBadge, Textarea } from '../components/ui';
import { ItemImage, TypeBadge } from '../components/ItemCard';
import ClaimModal from '../components/ClaimModal';
import MatchCard from '../components/MatchCard';
import { useAuth } from '../context/AuthContext';
import { useInvalid, useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { ABUSE_REASONS, fmtDate, stagger } from '../utils/format';

const Detail = ({ label, value, mono }) => value ? (
  <div className="border-t border-border py-3">
    <dt className="eyebrow">{label}</dt>
    <dd className={`mt-1 text-sm ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
) : null;

function AbuseModal({ open, onClose, item, type }) {
  const toast = useToast();
  const onInvalid = useInvalid();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const submit = async (v) => {
    try {
      await api.post('/abuse', { ...v, itemType: type, itemId: item._id });
      toast.success('Thanks. An administrator will review this report.');
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report abuse" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={isSubmitting} onClick={handleSubmit(submit, onInvalid)}>Submit report</Button></>}>
      <form className="space-y-5" onSubmit={handleSubmit(submit, onInvalid)} noValidate>
        <Select label="Reason" required placeholder="Select a reason" options={ABUSE_REASONS} error={errors.reason?.message} {...register('reason', { required: 'Please choose a reason' })} />
        <Textarea label="Details (optional)" rows={3} {...register('details')} />
      </form>
    </Modal>
  );
}

export default function ItemDetail() {
  const { type, id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const state = useFetch(() => api.get(`/${type}/${id}`), [type, id]);
  const item = state.data;
  const isStaff = ['staff', 'admin'].includes(user.role);
  const canClaim = type === 'found' && item && !item.isOwner && !['Recovered', 'Closed', 'Draft'].includes(item.status);

  // For claimants: their own possible matches (to prefill the claim) and lost reports (to link).
  const mine = useFetch(async () => {
    if (type !== 'found') return { matches: [], lost: [] };
    const [matches, lost] = await Promise.all([api.get('/matches'), api.get('/lost', { mine: 'true', limit: 50 })]);
    return { matches: matches.filter((m) => m.found._id === id), lost: lost.items.filter((l) => !['Recovered', 'Closed', 'Draft'].includes(l.status)) };
  }, [type, id]);
  const myMatch = mine.data?.matches[0];

  const [claimOpen, setClaimOpen] = useState(false);
  const [abuseOpen, setAbuseOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleSave = async () => {
    const { saved } = await api.post('/users/saved', { itemType: type, itemId: id });
    state.setData((d) => ({ ...d, saved }));
    toast.success(saved ? 'Item saved to your profile.' : 'Item removed from saved items.');
  };
  const act = (fn, msg) => async () => {
    try { await fn(); toast.success(msg); state.reload(); } catch (e) { toast.error(e.message); }
  };
  const verify = act(() => api.put(`/admin/reports/${type}/${id}/verify`), 'Report verified.');
  const remove = async () => {
    await api.del(`/${type}/${id}`);
    toast.success('Report deleted.');
    navigate(user.role === 'admin' ? '/admin/reports' : '/my-reports', { replace: true });
  };
  const contact = () => navigate(`/messages?to=${item.reporter._id}&itemType=${type}&itemId=${id}`);

  return (
    <Async state={state} notFound="This item could not be found." skeleton={<div className="grid gap-10 lg:grid-cols-[5fr_7fr]"><Skeleton className="aspect-[4/5]" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div></div>}>
      {(it) => (
        <div className="space-y-6">
          <nav className="enter text-sm text-muted-foreground" aria-label="Breadcrumb"><Link to="/browse" className="transition-colors hover:text-foreground">Browse</Link> <span aria-hidden>/</span> <span className="text-foreground">{it.itemName}</span></nav>
          <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
            <div style={stagger(1, 80)} className="enter lg:sticky lg:top-20 lg:self-start">
              <div className="aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted"><ItemImage item={it} /></div>
            </div>

            <div style={stagger(2, 80)} className="enter flex min-w-0 flex-col gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2"><TypeBadge type={it.type} /><StatusBadge status={it.status} />
                  {it.flagged && isStaff && <Badge tone="red"><Flag className="size-3" aria-hidden />Flagged</Badge>}</div>
                <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{it.itemName}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{it.category}</p>
                <p className="mt-5 max-w-prose text-pretty leading-relaxed text-muted-foreground">{it.description}</p>
              </div>

              <dl className="grid gap-x-10 sm:grid-cols-2">
                <Detail label="Report ID" value={it.reportId} mono />
                <Detail label="Brand" value={it.brand} />
                <Detail label="Color" value={it.color} />
                <Detail label="Model" value={it.model} />
                <Detail label="Location" value={[...new Set([it.location, it.building, it.floor && `Floor ${it.floor}`].filter(Boolean))].join(' · ')} />
                <Detail label={it.type === 'lost' ? 'Lost Date' : 'Found Date'} value={fmtDate(it.date)} />
                <Detail label={it.type === 'lost' ? 'Lost Time' : 'Found Time'} value={it.time} />
                <Detail label="Location details" value={it.locationDetails} />
                <Detail label="Unique features (private)" value={it.uniqueFeatures} />
                <Detail label="Currently held at" value={it.currentLocation} />
                <Detail label="Reward" value={it.reward} />
                <Detail label="Reported by" value={it.reporter ? `${it.reporter.name}${it.reporter.department ? ` · ${it.reporter.department}` : ''}` : 'Removed user'} />
              </dl>

              {canClaim && myMatch && (
                <section aria-label="Your possible match" className="space-y-3">
                  <h2 className="text-sm font-medium">Possible match with your lost report &quot;{myMatch.lost.itemName}&quot;</h2>
                  <MatchCard match={myMatch} showItems={false} cta={false} />
                </section>
              )}

              {canClaim && (
                <section className="rounded-md border border-border p-6">
                  <h2 className="text-lg font-semibold tracking-tight">Is this your item?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Submit a claim and staff will verify ownership before handing it over.</p>
                  {it.myClaim ? (
                    <Link to="/my-claims" className="mt-5 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"><CheckCircle2 className="size-4" aria-hidden />You already claimed this ({it.myClaim.claimId} · {it.myClaim.status})</Link>
                  ) : (
                    <Button className="mt-5" size="lg" onClick={() => setClaimOpen(true)}>Claim This Item</Button>
                  )}
                </section>
              )}

              <div className="flex flex-wrap gap-2">
                {it.type === 'lost' && it.isOwner && <ButtonLink to={`/matches?lost=${it._id}`} variant="secondary" icon={Sparkles}>View Possible Matches{it.matchCount ? ` (${it.matchCount})` : ''}</ButtonLink>}
                {type === 'found' && myMatch && <ButtonLink to={`/matches?lost=${myMatch.lost._id}`} variant="secondary" icon={Sparkles}>View Possible Matches</ButtonLink>}
                {!it.isOwner && it.reporter && <Button variant="secondary" icon={MessageSquare} onClick={contact}>Contact Reporter</Button>}
                <Button variant="secondary" icon={it.saved ? BookmarkCheck : Bookmark} onClick={toggleSave}>{it.saved ? 'Saved' : 'Save Item'}</Button>
                {isStaff && !['Verified', 'Recovered', 'Closed', 'Claimed'].includes(it.status) && <Button variant="success" icon={ShieldCheck} onClick={verify}>Verify Report</Button>}
                {(it.isOwner || user.role === 'admin') && <ButtonLink to={`/edit/${type}/${id}`} variant="secondary" icon={Pencil}>Edit</ButtonLink>}
                {!it.isOwner && <Button variant="ghost" icon={Flag} onClick={() => setAbuseOpen(true)}>Report Abuse</Button>}
                {(it.isOwner || user.role === 'admin') && <Button variant="ghost" className="text-destructive hover:text-destructive" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}
              </div>
            </div>
          </div>

          {canClaim && claimOpen && (
            <ClaimModal open onClose={() => setClaimOpen(false)} found={it} myLostReports={mine.data?.lost} defaultLostId={myMatch?.lost._id}
              onDone={() => { setClaimOpen(false); navigate('/my-claims'); }} />
          )}
          <AbuseModal open={abuseOpen} onClose={() => setAbuseOpen(false)} item={it} type={type} />
          <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} title="Delete report" message="Are you sure you want to delete this report? This cannot be undone." />
        </div>
      )}
    </Async>
  );
}
