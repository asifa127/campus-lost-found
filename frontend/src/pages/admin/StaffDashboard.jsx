import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, FileSearch, Inbox } from 'lucide-react';
import { useFetch } from '../../hooks/hooks';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Button, ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatGrid, StatusBadge } from '../../components/ui';
import { fmtNumber, stagger, timeAgo } from '../../utils/format';

const label = (a) => a.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const Panel = ({ title, hint, action, children, className = '' }) => (
  <section className={`rounded-md border border-border ${className}`}>
    <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
      <div><h2 className="text-sm font-medium">{title}</h2>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {action}
    </header>
    {children}
  </section>
);

export default function StaffDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const state = useFetch(() => api.get('/admin/staff'));
  const d = state.data;

  const verify = async (item) => {
    try { await api.put(`/admin/reports/found/${item._id}/verify`); toast.success('Report verified.'); state.reload(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Staff Dashboard" subtitle="What needs your attention right now."
        actions={<>
          <ButtonLink to="/admin/claims" icon={ClipboardCheck}>Review Claims</ButtonLink>
          <ButtonLink to="/admin/reports" variant="secondary" icon={FileSearch}>Verify Reports</ButtonLink>
        </>} />
      {state.loading && !d && <div className="space-y-6" aria-busy="true"><Skeleton className="h-28" /><div className="grid gap-6 lg:grid-cols-5"><Skeleton className="h-72 lg:col-span-3" /><Skeleton className="h-72 lg:col-span-2" /></div></div>}
      {state.error && !d && <ErrorState message={state.error} status={state.errorStatus} onRetry={state.reload} />}
      {d && (
        <div className="space-y-8">
          <div style={stagger(1)} className="enter">
            <StatGrid>
              <StatCard label="Pending Verification" value={fmtNumber(d.counts.pendingVerification)} hint="Found reports" onClick={() => navigate('/admin/reports?status=Pending%20Verification')} />
              <StatCard label="Pending Claims" value={fmtNumber(d.counts.pendingClaims)} hint="Waiting for a decision" onClick={() => navigate('/admin/claims')} />
              <StatCard label="Approved Claims" value={fmtNumber(d.counts.approvedClaims)} hint="All time" onClick={() => navigate('/admin/claims')} />
              <StatCard label="Handover Pending" value={fmtNumber(d.counts.handoverPending)} hint="Approved, not handed over" onClick={() => navigate('/admin/claims')} />
            </StatGrid>
          </div>

          <div style={stagger(2)} className="enter grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title="Claims Requiring Attention" hint="Oldest first"
              action={<ButtonLink to="/admin/claims" size="xs" variant="ghost">View all</ButtonLink>}>
              {d.claimsNeedingAttention.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No claims need attention" message="New claims and approved claims waiting for handover will appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {d.claimsNeedingAttention.map((c) => (
                    <li key={c._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm font-medium">{c.itemName}</p>
                        <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{c.claimId}</span> · {c.claimant}{c.matchScore ? ` · ${c.matchScore}% match` : ''} · {timeAgo(c.createdAt)}</p>
                      </div>
                      <StatusBadge status={c.status} />
                      <ButtonLink to={`/claims/${c._id}`} size="sm" variant={c.status === 'Approved' ? 'secondary' : 'primary'}>{c.nextAction}</ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Reports Awaiting Verification" hint="Found items to check"
              action={<ButtonLink to="/admin/reports?status=Pending%20Verification" size="xs" variant="ghost">View all</ButtonLink>}>
              {d.awaitingVerification.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Everything is verified" message="New found reports that need checking will appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {d.awaitingVerification.map((i) => (
                    <li key={i._id} className="px-5 py-3.5">
                      <p className="truncate text-sm font-medium">{i.itemName}</p>
                      <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{i.reportId}</span> · {i.location} · by {i.reporter || 'unknown'} · {timeAgo(i.createdAt)}</p>
                      <div className="mt-2.5 flex gap-2">
                        <Button size="xs" icon={CheckCircle2} onClick={() => verify(i)}>Verify</Button>
                        <ButtonLink to={`/items/found/${i._id}`} size="xs" variant="secondary">View</ButtonLink>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div style={stagger(3)} className="enter">
            <Panel title="Recent Activity">
              {d.activity.length === 0 ? <EmptyState compact icon={Inbox} title="No activity yet" /> : (
                <ul className="divide-y divide-border">
                  {d.activity.map((a) => (
                    <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0 truncate"><b className="font-medium">{a.user?.name || 'System'}</b> <span className="text-muted-foreground">· {label(a.action)}</span> <span className="font-mono text-xs text-muted-foreground">{a.target}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
