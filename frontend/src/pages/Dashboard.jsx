import { Link, useNavigate } from 'react-router-dom';
import { Search, PackagePlus, PackageSearch, Sparkles, Bell, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, Skeleton, StatCard, StatGrid } from '../components/ui';
import MatchCard from '../components/MatchCard';
import { stagger, timeAgo } from '../utils/format';

const SectionTitle = ({ id, children, hint, action }) => (
  <div className="mb-4 flex items-baseline justify-between gap-3">
    <div><h2 id={id} className="text-base font-semibold tracking-tight">{children}</h2>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>
    {action}
  </div>
);

// Same shape as the real page so nothing jumps when the data arrives.
const DashboardSkeleton = () => (
  <div aria-busy="true" aria-label="Loading dashboard">
    <Skeleton className="h-28" />
    <div className="mt-12 grid gap-12 lg:grid-cols-5 lg:gap-14">
      <div className="space-y-4 lg:col-span-3"><Skeleton className="h-6 w-56" /><Skeleton className="h-64" /></div>
      <div className="space-y-4 lg:col-span-2"><Skeleton className="h-6 w-40" /><ListSkeleton rows={4} /></div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useFetch(() => api.get('/dashboard'));
  const d = state.data;

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]} 👋`} subtitle="Here's what is happening with your reports today."
        actions={<>
          <ButtonLink to="/report/lost" icon={Search}>Report Lost Item</ButtonLink>
          <ButtonLink to="/report/found" variant="secondary" icon={PackagePlus}>Report Found Item</ButtonLink>
          <ButtonLink to="/browse" variant="ghost" icon={PackageSearch}>Browse Items</ButtonLink>
        </>} />

      {state.loading && !d && <DashboardSkeleton />}
      {state.error && !d && <ErrorState message={state.error} status={state.errorStatus} onRetry={state.reload} />}
      {d && (
        <>
          <div style={stagger(1)} className="enter">
            <StatGrid>
              <StatCard label="My Lost Reports" value={d.lost} onClick={() => navigate('/my-reports')} />
              <StatCard label="My Found Reports" value={d.found} onClick={() => navigate('/my-reports?tab=found')} />
              <StatCard label="Possible Matches" value={d.matchCount} onClick={() => navigate('/matches')} />
              <StatCard label="Active Claims" value={d.activeClaims} onClick={() => navigate('/my-claims')} />
            </StatGrid>
          </div>

          <div style={stagger(2)} className="enter mt-12 grid gap-12 lg:grid-cols-5 lg:gap-14">
            <section className="lg:col-span-3" aria-labelledby="matches-h">
              <SectionTitle id="matches-h" hint={`${d.matchCount} possible ${d.matchCount === 1 ? 'match' : 'matches'} found`}
                action={<Link to="/matches" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">View all</Link>}>
                Potential Matches
              </SectionTitle>
              {d.matches.length === 0 ? (
                <Card><EmptyState icon={Sparkles} title="No matches yet" message="Report a lost item and we will compare it with every found report automatically." action={<ButtonLink to="/report/lost">Report a Lost Item</ButtonLink>} /></Card>
              ) : (
                <div className="space-y-4">{d.matches.slice(0, 2).map((m, i) => <div key={m.lost._id + m.found._id} style={stagger(i, 70, 120)} className="swap"><MatchCard match={m} /></div>)}</div>
              )}
            </section>

            <section className="lg:col-span-2" aria-labelledby="activity-h">
              <SectionTitle id="activity-h">Recent activity</SectionTitle>
              {d.activity.length === 0 ? (
                <Card><EmptyState icon={Activity} title="Nothing yet" message="Your reports, matches and claims will show up here." /></Card>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {d.activity.map((n) => (
                    <li key={n._id}>
                      <Link to={n.link || '/notifications'} className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40">
                        <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{n.message}</span></span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
