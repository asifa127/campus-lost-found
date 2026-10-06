import { useSearchParams } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { Async, Button, ButtonLink, Card, EmptyState, ListSkeleton, PageHeader } from '../components/ui';
import MatchCard from '../components/MatchCard';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { stagger } from '../utils/format';

export default function Matches() {
  const [params, setParams] = useSearchParams();
  const lostId = params.get('lost');
  const state = useFetch(() => api.get(lostId ? `/matches/${lostId}` : '/matches'), [lostId]);
  return (
    <div>
      <PageHeader title="Potential Matches" subtitle="Found items our smart matcher thinks could be yours. Anything under 40% is hidden."
        actions={lostId && <Button variant="secondary" icon={X} onClick={() => setParams({})}>Show all matches</Button>} />
      <Async state={state} skeleton={<ListSkeleton rows={3} />} isEmpty={(d) => d.length === 0}
        empty={<Card><EmptyState icon={Sparkles} title="No potential matches yet" message="We check every new found report against your lost reports and notify you when something looks right."
          action={<ButtonLink to="/report/lost">Report a Lost Item</ButtonLink>} /></Card>}>
        {(matches) => <div className="space-y-4">{matches.map((m, i) => <div key={m.lost._id + m.found._id} style={stagger(Math.min(i, 8), 50)} className="swap"><MatchCard match={m} defaultOpen={i === 0} /></div>)}</div>}
      </Async>
    </div>
  );
}
