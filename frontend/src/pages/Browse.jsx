import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useDebounce, useFetch, useCatalog } from '../hooks/hooks';
import { api } from '../services/api';
import { Async, Badge, Button, ButtonLink, Card, CardGridSkeleton, EmptyState, Modal, Pagination, PageHeader, SearchBar, Select, Tabs } from '../components/ui';
import ItemCard from '../components/ItemCard';
import FilterPanel from '../components/FilterPanel';
import { fmtDate, stagger } from '../utils/format';

const TABS = [['all', 'All'], ['lost', 'Lost'], ['found', 'Found'], ['recovered', 'Recovered']];
const SORTS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['relevant', 'Most relevant'], ['match', 'Highest match']];
const LIST_KEYS = ['category', 'color'];

// The URL is the source of truth for every filter, so results are shareable and the back button works.
export default function Browse() {
  const [params, setParams] = useSearchParams();
  const { categories, locations } = useCatalog();
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState(params.get('q') || '');
  const debounced = useDebounce(text);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      const value = Array.isArray(v) ? v.join(',') : v;
      if (value) next.set(k, value); else next.delete(k);
    });
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get('q') || '') !== debounced) set({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const values = {
    category: params.get('category')?.split(',') || [], color: params.get('color')?.split(',') || [],
    location: params.get('location') || '', building: params.get('building') || '', status: params.get('status') || '',
    dateFrom: params.get('dateFrom') || '', dateTo: params.get('dateTo') || '',
  };
  const type = params.get('type') || 'all';
  const key = params.toString();
  const state = useFetch(() => api.get('/items', { ...Object.fromEntries(params), limit: 12 }), [key]);

  // one chip per active filter value
  const chips = [
    ...LIST_KEYS.flatMap((k) => values[k].map((v) => ({ key: `${k}-${v}`, label: v, remove: () => set({ [k]: values[k].filter((x) => x !== v) }) }))),
    ...['location', 'building', 'status'].filter((k) => values[k]).map((k) => ({ key: k, label: values[k], remove: () => set({ [k]: '' }) })),
    ...(values.dateFrom ? [{ key: 'dateFrom', label: `From ${fmtDate(values.dateFrom)}`, remove: () => set({ dateFrom: '' }) }] : []),
    ...(values.dateTo ? [{ key: 'dateTo', label: `To ${fmtDate(values.dateTo)}`, remove: () => set({ dateTo: '' }) }] : []),
  ];
  const clearFilters = () => set(Object.fromEntries(['category', 'color', 'location', 'building', 'status', 'dateFrom', 'dateTo'].map((k) => [k, ''])));
  const clearAll = () => { setText(''); setParams({}, { replace: true }); };
  const panel = <FilterPanel values={values} onChange={set} facets={state.data?.facets?.category} categories={categories} locations={locations} />;
  const total = state.data?.total ?? 0;

  return (
    <div>
      <PageHeader title="Browse Items" subtitle="Search every lost and found report on campus." />
      <div className="enter mb-8" style={stagger(1)}>
        <SearchBar value={text} onChange={setText} placeholder="Search by item name, brand, location..." />
      </div>

      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <aside aria-label="Filters" style={stagger(2)} className="enter hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100svh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-2 scroll-thin">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-medium">Filters</span>
            <Button variant="ghost" size="xs" className="text-muted-foreground" disabled={chips.length === 0} onClick={clearFilters}>Clear all</Button>
          </div>
          <div className="pt-6">{panel}</div>
        </aside>

        <div style={stagger(3)} className="enter flex min-w-0 flex-col gap-6">
          <Tabs tabs={TABS} value={type} onChange={(v) => set({ type: v === 'all' ? '' : v })} />

          <div className="flex flex-col gap-4 border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setSheet(true)}>
                  Filters{chips.length > 0 && <span className="tabular-nums">({chips.length})</span>}
                </Button>
                <p aria-live="polite" className="text-sm tabular-nums text-muted-foreground">{state.data ? `${total} ${total === 1 ? 'item' : 'items'} found` : 'Loading...'}</p>
              </div>
              <Select aria-label="Sort by" options={SORTS} value={params.get('sort') || 'newest'} onChange={(e) => set({ sort: e.target.value })} className="min-w-44" />
            </div>
            {chips.length > 0 && (
              <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <li key={c.key} className="swap">
                    <Badge className="h-7 gap-1 pe-1 ps-2.5 font-normal">
                      {c.label}
                      <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove}
                        className="grid size-5 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" /></button>
                    </Badge>
                  </li>
                ))}
                <li><Button variant="link" size="xs" className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>Clear all</Button></li>
              </ul>
            )}
          </div>

          <Async state={state} skeleton={<CardGridSkeleton />} isEmpty={(d) => d.items.length === 0}
            empty={<Card><EmptyState icon={PackageSearch} title="No items found" message="Try a different search or clear your filters. Can't find it? Report it so others can help."
              action={<div className="flex gap-2"><Button variant="secondary" onClick={clearAll}>Clear filters</Button><ButtonLink to="/report/lost">Report a Lost Item</ButtonLink></div>} /></Card>}>
            {(d) => (
              <>
                <div key={key} className={`grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity sm:grid-cols-3 sm:gap-x-6 ${state.loading ? 'opacity-60' : ''}`}>
                  {d.items.map((it, i) => <ItemCard key={it.type + it._id} item={it} index={i} />)}
                </div>
                <Pagination page={d.page} pages={d.pages} onChange={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}
          </Async>
        </div>
      </div>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Filters"
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" onClick={clearFilters} disabled={chips.length === 0}>Clear all</Button>
            <Button className="flex-1 tabular-nums" onClick={() => setSheet(false)}>{total === 0 ? 'No matches' : `Show ${total} ${total === 1 ? 'item' : 'items'}`}</Button>
          </div>
        }>
        {panel}
      </Modal>
    </div>
  );
}
