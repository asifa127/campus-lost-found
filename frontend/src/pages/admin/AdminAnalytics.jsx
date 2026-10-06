import { useState } from 'react';
import { useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { Async, PageHeader, Segmented, Skeleton, StatCard, StatGrid } from '../../components/ui';
import { CategoryChart, ClaimStatusChart, LocationChart, LostFoundChart, RecoveryChart } from '../../components/Charts';
import { RANGE_LABEL, fmtNumber, stagger } from '../../utils/format';

export default function AdminAnalytics() {
  const [range, setRange] = useState('all');
  const state = useFetch(() => api.get('/admin/analytics', { range }), [range]);
  const when = RANGE_LABEL[range];
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Calculated live from reports and claims. Recovery rate = recovered found items ÷ found items reported."
        actions={<Segmented label="Time range" options={Object.entries(RANGE_LABEL)} value={range} onChange={setRange} />} />
      <Async state={state} skeleton={<Skeleton className="h-56" />}>
        {(d) => (
          <div className={`space-y-8 transition-opacity ${state.loading ? 'opacity-60' : ''}`}>
            <div style={stagger(1)} className="enter">
              <StatGrid>
                <StatCard label="Total Reports" value={fmtNumber(d.cards.totalReports)} hint={when} />
                <StatCard label="Lost Reports" value={fmtNumber(d.cards.lostItems)} hint={when} added={d.last30Days?.lost} />
                <StatCard label="Found Reports" value={fmtNumber(d.cards.foundItems)} hint={when} added={d.last30Days?.found} />
                <StatCard label="Recovered Items" value={fmtNumber(d.cards.recoveredItems)} hint={when} added={d.last30Days?.recovered} />
                <StatCard label="Pending Claims" value={fmtNumber(d.cards.pendingClaims)} hint="Current queue" />
                <StatCard label="Recovery Rate" value={d.cards.successRate} suffix="%" hint="All time" />
                <StatCard label="Average Match Score" value={d.cards.avgMatchScore} suffix="%" hint={`Claims, ${when.toLowerCase()}`} />
              </StatGrid>
            </div>
            <div style={stagger(2)} className="enter grid gap-5 lg:grid-cols-2">
              <LostFoundChart data={d.lostVsFound} /><RecoveryChart data={d.recoveryTrend} range={range} />
              <CategoryChart data={d.categories} /><LocationChart data={d.locations} />
              <ClaimStatusChart data={d.claimStatus} className="lg:col-span-2" />
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}
