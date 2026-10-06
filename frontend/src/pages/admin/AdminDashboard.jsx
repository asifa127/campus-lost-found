import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Flag, Inbox } from 'lucide-react';
import { useFetch } from '../../hooks/hooks';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, PageHeader, Segmented, Skeleton, StatCard, StatGrid } from '../../components/ui';
import { TypeBadge } from '../../components/ItemCard';
import { CategoryChart, ClaimStatusChart, LocationChart, LostFoundChart, RecoveryChart } from '../../components/Charts';
import { RANGE_LABEL, fmtNumber, stagger, timeAgo } from '../../utils/format';

const RANGES = Object.entries(RANGE_LABEL);
const label = (a) => a.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const hours = (h) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h} h`);

// A short queue of things that need a decision, with the action right on the row.
function Queue({ title, count, to, items, empty, children }) {
  return (
    <section className="flex flex-col rounded-md border border-border">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">{title}<Badge className="tabular-nums">{fmtNumber(count)}</Badge></h2>
        <Link to={to} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">View all<ArrowRight className="size-3" aria-hidden /></Link>
      </header>
      {items.length === 0 ? (
        <EmptyState compact icon={Inbox} title={empty} />
      ) : (
        <ul className="divide-y divide-border">{items.map(children)}</ul>
      )}
    </section>
  );
}

// "System overview" panels: a handful of labelled numbers each.
const Overview = ({ title, rows }) => (
  <section className="rounded-md border border-border p-5">
    <h2 className="mb-3 text-sm font-medium">{title}</h2>
    <dl className="divide-y divide-border text-sm">
      {rows.map(([k, v, to]) => (
        <div key={k} className="flex items-center justify-between gap-3 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">{to ?<Link to={to} className="underline-offset-4 hover:underline">{v}</Link> : v}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [range, setRange] = useState('all');
  const state = useFetch(() => api.get('/admin/dashboard', { range }), [range]);
  const d = state.data;
  const when = RANGE_LABEL[range];

  const verify = async (item) => {
    try { await api.put(`/admin/reports/found/${item._id}/verify`); toast.success('Report verified.'); state.reload(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Live campus-wide numbers, calculated from the database."
        actions={<Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />} />
      {state.loading && !d && <div className="space-y-6" aria-busy="true"><Skeleton className="h-40" /><div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-56" /><Skeleton className="h-56" /><Skeleton className="h-56" /></div></div>}
      {state.error && !d && <ErrorState message={state.error} status={state.errorStatus} onRetry={state.reload} />}
      {d && (
        <div className={`space-y-8 transition-opacity ${state.loading ? 'opacity-60' : ''}`}>
          <div style={stagger(1)} className="enter">
            <StatGrid cols={6}>
              <StatCard label="Total Users" value={fmtNumber(d.cards.totalUsers)} hint="All time" added={d.last30Days?.users} onClick={() => navigate('/admin/users')} />
              <StatCard label="Lost Items" value={fmtNumber(d.cards.lostItems)} hint={when} added={d.last30Days?.lost} onClick={() => navigate('/admin/reports?type=lost')} />
              <StatCard label="Found Items" value={fmtNumber(d.cards.foundItems)} hint={when} added={d.last30Days?.found} onClick={() => navigate('/admin/reports?type=found')} />
              <StatCard label="Recovered Items" value={fmtNumber(d.cards.recoveredItems)} hint={when} added={d.last30Days?.recovered} onClick={() => navigate('/admin/reports?type=recovered')} />
              <StatCard label="Pending Claims" value={fmtNumber(d.cards.pendingClaims)} hint="Current queue" onClick={() => navigate('/admin/claims')} />
              <StatCard label="Recovery Rate" value={d.cards.successRate} suffix="%" hint="All time" />
            </StatGrid>
          </div>

          <div style={stagger(2)} className="enter grid gap-5 lg:grid-cols-3">
            <Queue title="Pending claims" count={d.cards.pendingClaims} to="/admin/claims" items={d.attention.pendingClaims} empty="No claims waiting">
              {(c) => (
                <li key={c._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.itemName}</p>
                    <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{c.claimId}</span> · {c.claimant}{c.matchScore ? ` · ${c.matchScore}% match` : ''} · {timeAgo(c.createdAt)}</p>
                  </div>
                  <ButtonLink to={`/claims/${c._id}`} size="xs">Review</ButtonLink>
                </li>
              )}
            </Queue>
            <Queue title="Awaiting verification" count={d.pendingVerification} to="/admin/reports?status=Pending%20Verification" items={d.attention.awaitingVerification} empty="Nothing to verify">
              {(i) => (
                <li key={i._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.itemName}</p>
                    <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{i.reportId}</span> · {i.location} · {timeAgo(i.createdAt)}</p>
                  </div>
                  <Button size="xs" variant="secondary" icon={CheckCircle2} onClick={() => verify(i)}>Verify</Button>
                </li>
              )}
            </Queue>
            <Queue title="Flagged reports" count={d.flagged} to="/admin/reports?flagged=true" items={d.attention.flagged} empty="No flagged reports">
              {(i) => (
                <li key={i._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium"><Flag className="size-3.5 shrink-0 text-destructive" aria-label="Flagged" />{i.itemName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><TypeBadge type={i.type} /> <span className="font-mono">{i.reportId}</span></p>
                  </div>
                  <ButtonLink to={`/items/${i.type}/${i._id}`} size="xs" variant="secondary">Review</ButtonLink>
                </li>
              )}
            </Queue>
          </div>

          <div style={stagger(3)} className="enter">
            <h2 className="mb-3 text-sm font-medium">System overview</h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <Overview title="User statistics" rows={[
                ['Total users', fmtNumber(d.overview.users.total)], ['Students', fmtNumber(d.overview.users.students)], ['Staff', fmtNumber(d.overview.users.staff)],
                ['Admins', fmtNumber(d.overview.users.admins)], ['Blocked', fmtNumber(d.overview.users.blocked)],
                ['Staff requests', fmtNumber(d.overview.users.staffRequests), '/admin/users'], ['New this month', fmtNumber(d.overview.users.newThisMonth)],
              ]} />
              <Overview title="Report statistics" rows={[
                ['Lost reports', fmtNumber(d.overview.reports.lost), '/admin/reports?type=lost'], ['Found reports', fmtNumber(d.overview.reports.found), '/admin/reports?type=found'],
                ['Drafts', fmtNumber(d.overview.reports.drafts)], ['Awaiting verification', fmtNumber(d.overview.reports.pendingVerification)], ['Flagged', fmtNumber(d.overview.reports.flagged)],
              ]} />
              <Overview title="Recovery statistics" rows={[
                ['Items recovered', fmtNumber(d.overview.recovery.recovered)], ['Recovery rate', `${d.overview.recovery.rate}%`],
                ['Avg. match score', `${d.overview.recovery.avgMatchScore}%`], ['Avg. time to resolve a claim', d.overview.claims.total ? hours(d.overview.recovery.avgResolveHours) : '-'],
              ]} />
              <Overview title="Claim statistics" rows={[
                ['Total claims', fmtNumber(d.overview.claims.total)], ['Pending', fmtNumber(d.overview.claims.pending)], ['Under review', fmtNumber(d.overview.claims.underReview)],
                ['Approved', fmtNumber(d.overview.claims.approved)], ['Completed', fmtNumber(d.overview.claims.completed)], ['Rejected', fmtNumber(d.overview.claims.rejected)],
                ['Approval rate', `${d.overview.claims.approvalRate}%`],
              ]} />
            </div>
          </div>

          <div style={stagger(4)} className="enter grid gap-5 lg:grid-cols-2">
            <LostFoundChart data={d.lostVsFound} /><RecoveryChart data={d.recoveryTrend} range={range} />
            <CategoryChart data={d.categories} /><LocationChart data={d.locations} />
          </div>

          <div style={stagger(5)} className="enter grid gap-5 lg:grid-cols-3">
            <ClaimStatusChart data={d.claimStatus} />
            <section className="rounded-md border border-border lg:col-span-2">
              <h2 className="border-b border-border px-5 py-3 text-sm font-medium">Recent system activity</h2>
              {d.activity.length === 0 ? <EmptyState icon={Inbox} title="No activity yet" /> : (
                <ul className="divide-y divide-border">
                  {d.activity.map((a) => (
                    <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0 truncate"><b className="font-medium">{a.user?.name || 'System'}</b> <span className="text-muted-foreground">· {label(a.action)}</span> <span className="font-mono text-xs text-muted-foreground">{a.target}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
