import { Link } from 'react-router-dom';
import { Search, ArrowRight, ArrowUpRight, ArrowDown, Check, PartyPopper } from 'lucide-react';
import { useFetch, useCatalog, useCountUp } from '../hooks/hooks';
import { api } from '../services/api';
import { Badge, ButtonLink, ScoreRing, Skeleton, CardGridSkeleton } from '../components/ui';
import ItemCard, { ItemImage } from '../components/ItemCard';
import MatchCard, { MatchBreakdown } from '../components/MatchCard';
import { PublicFooter, PublicHeader, WRAP } from '../components/PublicChrome';
import { categoryIcon, fmtNumber, stagger } from '../utils/format';

// Example data for the illustrations on this page. It is clearly labelled "Example" wherever it appears.
const SAMPLE_BREAKDOWN = [
  { key: 'category', label: 'Category', points: 25, max: 25, matched: true, note: 'Electronics' },
  { key: 'name', label: 'Name similarity', points: 11.4, max: 20, matched: true, note: '57% word match' },
  { key: 'color', label: 'Color', points: 15, max: 15, matched: true, note: 'Black' },
  { key: 'brand', label: 'Brand', points: 15, max: 15, matched: true, note: 'Samsung' },
  { key: 'location', label: 'Location', points: 15, max: 15, matched: true, note: 'Library' },
  { key: 'date', label: 'Date proximity', points: 10, max: 10, matched: true, note: '1 day apart' },
];
const SAMPLE_MATCH = {
  lost: { itemName: 'Black Samsung Earbuds', category: 'Electronics' },
  found: { _id: 'example', itemName: 'Samsung Galaxy Buds Pro', category: 'Electronics' },
  score: 91, confidence: 'High Confidence', matchedFields: ['category', 'name', 'color', 'brand', 'location', 'date'], breakdown: SAMPLE_BREAKDOWN,
};
const FACTORS = [['Category', 25], ['Item name', 20], ['Color', 15], ['Brand', 15], ['Location', 15], ['Date', 10]];

const STEPS = [
  { title: 'Lost Item', text: 'Describe what you lost or found in under a minute, with a photo.' },
  { title: 'Smart Matching', text: 'Our smart matcher compares every report and surfaces likely pairs.' },
  { title: 'Claim Verification', text: 'Staff verify ownership using details only the real owner knows.' },
  { title: 'Recovered 🎉', text: 'Collect your item at a scheduled handover. Done!' },
];

// Small illustrations, one per stage of the journey (built from the real UI pieces).
const Mini = ({ children }) => <div aria-hidden className="rounded-md border border-border bg-muted/40 p-3.5">{children}</div>;
const STAGES = [
  () => (
    <Mini>
      <div className="flex items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border"><ItemImage item={SAMPLE_MATCH.lost} compact /></div>
        <div className="min-w-0"><p className="text-sm font-medium leading-tight">Black Samsung Earbuds</p><p className="mt-0.5 text-xs text-muted-foreground">Library · <span className="font-mono text-[11px]">LF-2026-00123</span></p></div>
      </div>
      <div className="mt-3 flex gap-2"><Badge>Lost</Badge><Badge tone="blue">Submitted</Badge></div>
    </Mini>
  ),
  () => (
    <Mini>
      <div className="flex items-center gap-3">
        <ScoreRing score={91} size={56} />
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em]">High Confidence</p><p className="text-xs text-muted-foreground">Samsung Galaxy Buds Pro</p></div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1 text-xs text-muted-foreground">{['Category', 'Color', 'Location', 'Name'].map((f) => <li key={f} className="flex items-center gap-1"><Check className="size-3 text-foreground" strokeWidth={3} />{f}</li>)}</ul>
    </Mini>
  ),
  () => (
    <Mini>
      <ol className="space-y-2 text-xs">
        {['Claim submitted', 'Staff review', 'Ownership verified'].map((l) => (
          <li key={l} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full bg-foreground text-background"><Check className="size-2.5" strokeWidth={3.5} /></span><span className="font-medium">{l}</span></li>
        ))}
      </ol>
      <div className="mt-3"><Badge tone="green">Approved</Badge></div>
    </Mini>
  ),
  () => (
    <Mini>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-foreground"><PartyPopper className="size-5" strokeWidth={1.5} /></span>
        <div><p className="text-sm font-semibold">Item Successfully Recovered 🎉</p><p className="text-xs text-muted-foreground">Handover completed</p></div>
      </div>
      <div className="mt-3"><Badge tone="green">Recovered</Badge></div>
    </Mini>
  ),
];

function Journey() {
  return (
    <ol className="grid gap-6 lg:grid-cols-4 lg:gap-5">
      {STEPS.map((s, i) => {
        const Stage = STAGES[i];
        return (
          <li key={s.title} className="relative flex flex-col rounded-md border border-border bg-background p-5">
            <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{s.text}</p>
            <div className="mt-auto pt-5"><Stage /></div>
            {i < STEPS.length - 1 && (
              <>
                <span aria-hidden className="absolute -right-[18px] top-1/2 z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground lg:grid"><ArrowRight className="size-3.5" /></span>
                <span aria-hidden className="absolute -bottom-[18px] left-1/2 z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground lg:hidden"><ArrowDown className="size-3.5" /></span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Section with a 15rem title rail on the left, same proportions as the filter column on Browse.
const Section = ({ id, title, subtitle, children, tinted }) => (
  <section id={id} className={`scroll-mt-14 border-b border-border py-20 md:py-28 ${tinted ? 'bg-muted/40' : ''}`}>
    <div className={`${WRAP} grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14`}>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-balance text-3xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  </section>
);

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
      <div className={`${WRAP} relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-14`}>
        <div>
          <h1 className="enter text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Lost Something on Campus?</h1>
          <p style={stagger(1, 90)} className="enter mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">Find it faster. Help others recover what they&apos;ve lost.</p>
          <div style={stagger(2, 90)} className="enter mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/report/lost" size="lg" icon={Search}>Report Lost Item</ButtonLink>
            <ButtonLink to="/browse?type=found" size="lg" variant="secondary">Browse Found Items</ButtonLink>
          </div>
          <p style={stagger(3, 90)} className="enter mt-5 text-sm text-muted-foreground">
            Found something? <Link to="/report/found" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">Report a found item</Link>
          </p>
        </div>
        <div style={stagger(2, 90)} className="enter">
          <MatchCard match={SAMPLE_MATCH} cta={false} caption="Example · Smart Matching Algorithm" />
        </div>
      </div>
    </section>
  );
}

// Every number comes from the database (/api/public/stats) and counts up when the page opens.
function Stat({ label, value, suffix = '', loading }) {
  const shown = useCountUp(value);
  return (
    <div className="flex flex-col gap-2 border-r border-border px-6 py-8 odd:pl-0 nth-[n+3]:border-t lg:odd:pl-6 lg:first:pl-0 lg:nth-[n+3]:border-t-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-4xl font-semibold tracking-tight tabular-nums">{loading ? <Skeleton className="h-10 w-20" /> : <>{fmtNumber(shown)}{suffix}</>}</dd>
    </div>
  );
}

function Stats() {
  const { data, loading } = useFetch(() => api.get('/public/stats'));
  return (
    <section aria-label="Statistics" className="border-b border-border">
      <div className={WRAP}>
        <div className="overflow-hidden">
          <dl className="-mr-px grid grid-cols-2 lg:grid-cols-4">
            <Stat label="Items Reported" value={data?.itemsReported} loading={loading} />
            <Stat label="Items Recovered" value={data?.itemsRecovered} loading={loading} />
            <Stat label="Recovery Rate" value={data?.recoveryRate} suffix="%" loading={loading} />
            <Stat label="Average Match Confidence" value={data?.avgMatchConfidence} suffix="%" loading={loading} />
          </dl>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { categories } = useCatalog();
  const recent = useFetch(() => api.get('/public/recent'));
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader sections={[['#how', 'How it works'], ['#categories', 'Categories'], ['#recent', 'Recent items'], ['#matching', 'Smart matching']]} />
      <main id="main">
        <Hero />
        <Stats />

        <section id="how" className="scroll-mt-14 border-b border-border py-20 md:py-28">
          <div className={WRAP}>
            <div className="mb-12 max-w-xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">Four simple steps from lost to recovered.</p>
            </div>
            <Journey />
          </div>
        </section>

        <Section id="categories" title="Browse by category" subtitle="Jump straight to the kind of item you are looking for.">
          <div className="overflow-hidden rounded-md border border-border">
            <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3">
              {categories.map((c) => {
                const Icon = categoryIcon(c.name);
                return (
                  <Link key={c._id} to={`/browse?category=${encodeURIComponent(c.name)}`}
                    className="group flex items-center gap-3 border-b border-r border-border p-5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50">
                    <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                    <span className="flex-1 text-sm font-medium">{c.name}</span>
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </div>
        </Section>

        <section id="recent" className="scroll-mt-14 border-b border-border py-20 md:py-28">
          <div className={WRAP}>
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Recent reports</h2>
                <p className="mt-3 text-muted-foreground">Fresh lost and found reports from around campus.</p>
              </div>
              <Link to="/browse" className="hidden shrink-0 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline sm:inline-flex">Browse all items<ArrowRight className="size-4" aria-hidden /></Link>
            </div>
            {recent.loading ? <CardGridSkeleton count={4} className="grid-cols-2 lg:grid-cols-4" /> : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
                {(recent.data || []).slice(0, 8).map((it, i) => <ItemCard key={it._id} item={it} index={i} />)}
              </div>
            )}
            {recent.error && <p className="text-sm text-muted-foreground">Recent items are unavailable right now.</p>}
            <div className="mt-10 sm:hidden"><ButtonLink to="/browse" variant="secondary" className="w-full">Browse all items</ButtonLink></div>
          </div>
        </section>

        <section id="matching" className="scroll-mt-14 border-b border-border bg-muted/40 py-20 md:py-28">
          <div className={`${WRAP} grid items-start gap-14 lg:grid-cols-2`}>
            <div>
              <p className="eyebrow mb-3 text-foreground">Smart Matching Algorithm</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight">We find the pairs, so you don&apos;t have to search.</h2>
              <p className="mt-4 max-w-lg text-pretty leading-relaxed text-muted-foreground">Every new report is scored against open reports from the other side. The score blends category, item name, color, brand, location and date proximity into a simple percentage.</p>
              <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">It is a transparent scoring formula, not a trained AI model, so every score can be explained.</p>
              <ul className="mt-8 max-w-sm divide-y divide-border border-y border-border">
                {FACTORS.map(([k, v]) => (
                  <li key={k} className="flex items-center gap-4 py-3 text-sm">
                    <span className="w-24">{k}</span>
                    <span className="h-px flex-1 bg-border"><span className="block h-px bg-foreground" style={{ width: `${v * 4}%` }} /></span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">+{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-background">
              <div className="flex items-center gap-4 border-b border-border p-6">
                <ScoreRing score={91} size={80} />
                <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em]">High Confidence</p><p className="mt-1 text-sm font-medium">Black Samsung Earbuds / Samsung Galaxy Buds Pro</p><p className="text-xs text-muted-foreground">Example score breakdown</p></div>
              </div>
              <div className="p-6"><MatchBreakdown breakdown={SAMPLE_BREAKDOWN} score={91} /></div>
              <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center text-xs">
                {[['80-100', 'High Confidence'], ['60-79', 'Possible Match'], ['40-59', 'Low Match']].map(([range, label]) => (
                  <div key={label} className="p-4"><p className="font-medium tabular-nums">{range}</p><p className="mt-0.5 text-muted-foreground">{label}</p></div>
                ))}
              </div>
              <p className="border-t border-border p-4 text-xs text-muted-foreground">Anything under 40 is never recommended.</p>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
