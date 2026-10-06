import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, Minus, X } from 'lucide-react';
import { ButtonLink, ScoreRing, cx } from './ui';
import { ItemImage } from './ItemCard';
import { FIELD_LABELS, fmtPoints } from '../utils/format';

// 0-100 bar with the three confidence thresholds marked: 40 (low), 60 (possible), 80 (high).
function ConfidenceMeter({ score }) {
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-muted" role="img" aria-label={`Match strength ${score} out of 100`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-700 ease-out" style={{ width: `${score}%` }} />
        {[40, 60, 80].map((t) => <span key={t} aria-hidden className="absolute -top-1 h-3.5 w-px bg-input" style={{ left: `${t}%` }} />)}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] tabular-nums text-muted-foreground" aria-hidden>
        {[40, 60, 80].map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t}%` }}>{t}</span>)}
      </div>
      <p className="text-[11px] text-muted-foreground">80-100 High Confidence · 60-79 Possible Match · 40-59 Low Match</p>
    </div>
  );
}

// "Why did this match?": every factor of the Smart Matching Algorithm with the points it earned.
export function MatchBreakdown({ breakdown, score }) {
  return (
    <div>
      <ul aria-label="Score breakdown" className="divide-y divide-border">
        {breakdown.map((r) => {
          const Icon = r.matched ? Check : r.points > 0 ? Minus : X;
          return (
            <li key={r.key} className="flex items-center gap-3 py-2.5 text-sm">
              <Icon className={cx('size-4 shrink-0', r.matched ? 'text-foreground' : 'text-muted-foreground')} strokeWidth={r.matched ? 2.5 : 1.75} aria-hidden />
              <span className="w-32 shrink-0 font-medium">{r.label}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {r.matched ? 'Matched' : r.points > 0 ? 'Partial' : 'No match'} · {r.note}
              </span>
              <span className="hidden h-1 w-14 shrink-0 rounded-full bg-muted sm:block" aria-hidden>
                <span className="block h-full rounded-full bg-foreground" style={{ width: `${(r.points / r.max) * 100}%` }} />
              </span>
              <span className="w-12 shrink-0 text-right font-medium tabular-nums">{fmtPoints(r.points)}</span>
              <span className="sr-only"> out of {r.max}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 flex items-center justify-between border-t border-foreground pt-3 text-sm font-semibold">
        <span>Total score</span><span className="tabular-nums">{score} / 100</span>
      </p>
    </div>
  );
}

const Side = ({ item, label }) => (
  <div className="flex min-w-0 items-center gap-3">
    <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border"><ItemImage item={item} compact /></div>
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="truncate text-sm font-medium">{item.itemName}</p>
    </div>
  </div>
);

// The headline of the project: a potential match with its confidence, the attributes that matched
// and (on request) the factor-by-factor explanation. `showItems={false}` hides the two item rows
// when the surrounding page already shows them. The layout follows the card's own width (container
// queries), so it works in a narrow hero column and in a full-width list.
export default function MatchCard({ match, defaultOpen = false, showItems = true, cta = true, caption = 'Smart Matching Algorithm' }) {
  const { lost, found, score, confidence, matchedFields, breakdown } = match;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="@container rounded-md border border-border transition-colors hover:border-input">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="eyebrow text-foreground">Potential match</span>
        <span className="text-right text-xs text-muted-foreground">{caption}</span>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={score} size={96} />
          <div className="min-w-0 flex-1">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]">{confidence}</p>
            <ConfidenceMeter score={score} />
          </div>
        </div>

        {showItems && (
          <div className="grid items-center gap-3 border-t border-border pt-5 @lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Side item={lost} label="Your lost item" />
            <ArrowLeftRight className="hidden size-4 text-muted-foreground @lg:block" aria-hidden />
            <Side item={found} label="Found item" />
          </div>
        )}

        <ul className="grid gap-x-6 gap-y-2 border-t border-border pt-5 @sm:grid-cols-2 @2xl:grid-cols-3" aria-label="Matched attributes">
          {matchedFields.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm"><Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />{FIELD_LABELS[f]}</li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40">
          <ChevronDown className={cx('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
          Why this matched
          <span className="font-normal text-muted-foreground">· {score}% score, factor by factor</span>
        </button>
        {open && <div className="swap px-5 pb-5"><MatchBreakdown breakdown={breakdown} score={score} /></div>}
      </div>

      {cta && (
        <footer className="flex justify-end border-t border-border px-5 py-3">
          <ButtonLink to={`/items/found/${found._id}`} size="sm">Review Match<ArrowRight className="size-4" aria-hidden /></ButtonLink>
        </footer>
      )}
    </article>
  );
}
