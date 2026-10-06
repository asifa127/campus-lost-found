import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Async, Badge, Button, ButtonLink, Card, PageHeader } from '../components/ui';
import ItemForm from '../components/ItemForm';
import MatchCard from '../components/MatchCard';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { stagger } from '../utils/format';

function Success({ kind, result }) {
  const navigate = useNavigate();
  const top = result.matches?.[0];
  const isLost = kind === 'lost';
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="enter flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border"><Check className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-xl font-semibold tracking-tight">{isLost ? 'Lost item reported successfully.' : 'Found item reported successfully.'}</h1>
          {!isLost && <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start"><Badge tone="amber">Pending Verification</Badge>Staff will verify your report. Please hand the item to the Security Office.</p>}
        </div>
        <div className="shrink-0">
          <p className="eyebrow">Your report ID</p>
          <p className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-base font-medium">
            {result.item.reportId}
            <button aria-label="Copy report ID" onClick={() => navigator.clipboard?.writeText(result.item.reportId)} className="text-muted-foreground transition-colors hover:text-foreground"><Copy className="size-4" /></button>
          </p>
        </div>
      </Card>

      {isLost && (top ? (
        <section style={stagger(1, 90)} className="enter space-y-4" aria-labelledby="match-h">
          <div>
            <h2 id="match-h" className="text-lg font-semibold tracking-tight">Potential Match — {top.score}%</h2>
            {result.matches.length > 1 && <p className="text-sm text-muted-foreground">+ {result.matches.length - 1} more possible {result.matches.length === 2 ? 'match' : 'matches'}</p>}
          </div>
          <MatchCard match={top} defaultOpen cta={false} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink to={`/items/found/${top.found._id}`} className="flex-1">Open match &amp; claim</ButtonLink>
            <ButtonLink to={`/matches?lost=${result.item._id}`} variant="secondary" className="flex-1">See all matches</ButtonLink>
          </div>
        </section>
      ) : (
        <Card style={stagger(1, 90)} className="enter p-5 text-center text-sm text-muted-foreground">No matching found items yet. We&apos;ll notify you the moment one turns up.</Card>
      ))}

      <div className="flex justify-center gap-2">
        <Button variant="secondary" onClick={() => navigate('/my-reports')}>My Reports</Button>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>Dashboard</Button>
      </div>
    </div>
  );
}

export function ReportItem() {
  const { type } = useParams();
  const [result, setResult] = useState(null);
  if (!['lost', 'found'].includes(type)) return <PageHeader title="Unknown report type" />;
  if (result) return <Success kind={type} result={result} />;
  return (
    <div>
      <PageHeader title={type === 'lost' ? 'Report a Lost Item' : 'Report a Found Item'}
        subtitle={type === 'lost' ? 'Tell us what you lost. We will search found reports for you instantly.' : 'Thank you for helping! Add details so the owner can be found.'} />
      <ItemForm key={type} kind={type} onSubmitted={setResult} />
    </div>
  );
}

export function EditItem() {
  const { type, id } = useParams();
  const { user } = useAuth();
  const state = useFetch(() => api.get(`/${type}/${id}`), [type, id]);
  return (
    <div>
      <PageHeader title="Edit report" subtitle={state.data?.reportId} />
      <Async state={state} isEmpty={(d) => !d.isOwner && user.role !== 'admin'} empty={<Card className="p-8 text-center text-sm text-muted-foreground">You can only edit your own reports.</Card>}>
        {(item) => <ItemForm kind={type} item={item} />}
      </Async>
    </div>
  );
}
