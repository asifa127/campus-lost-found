import { Link } from 'react-router-dom';
import { MapPin, Sparkles } from 'lucide-react';
import { Badge, StatusText } from './ui';
import SafeImage from './SafeImage';
import { categoryIcon, fmtDate, stagger } from '../utils/format';

// Fills its parent: the photo, or a quiet category glyph when there is no photo or it fails to load.
export function ItemImage({ item, className, compact }) {
  const Icon = categoryIcon(item.category);
  const placeholder = (
    <div className="relative grid size-full place-items-center bg-muted text-muted-foreground" role="img" aria-label={`${item.category || 'Item'} placeholder`}>
      {compact ? <Icon className="size-5" strokeWidth={1.5} aria-hidden /> : (
        <>
          <span aria-hidden className="dot-grid absolute inset-0 opacity-80" />
          <span className="relative grid size-14 place-items-center rounded-md border border-border bg-background shadow-xs"><Icon className="size-6" strokeWidth={1.5} aria-hidden /></span>
        </>
      )}
    </div>
  );
  return (
    <div className="relative size-full">
      <SafeImage src={item.image} alt={`${item.itemName}, ${item.category || 'item'}`} className={className} fallback={placeholder} />
    </div>
  );
}

export const TypeBadge = ({ type, className }) => <Badge className={className}>{type === 'lost' ? 'Lost' : 'Found'}</Badge>;

// Borderless card: only the image is framed, the text sits on the page. The whole card is one link.
export default function ItemCard({ item, index = 0 }) {
  return (
    <article style={stagger(Math.min(index, 8), 45)} className="swap group relative flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted group-has-[a:focus-visible]:ring-[3px] group-has-[a:focus-visible]:ring-ring/50">
        <ItemImage item={item} className="transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none" />
        <TypeBadge type={item.type} className="absolute start-2.5 top-2.5 bg-background/85 backdrop-blur" />
        {item.matchScore && (
          <Badge className="absolute end-2.5 top-2.5 bg-background/85 tabular-nums backdrop-blur">
            <Sparkles className="size-3" aria-hidden />{item.matchScore}% match
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium text-pretty">
            <Link to={`/items/${item.type}/${item._id}`} className="outline-none after:absolute after:inset-0">{item.itemName}</Link>
          </h3>
          <StatusText status={item.status} />
        </div>
        <span className="text-xs text-muted-foreground">{item.category}{item.color ? ` · ${item.color}` : ''}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden />{item.location}<span aria-hidden>·</span><span className="tabular-nums">{fmtDate(item.date)}</span>
        </span>
      </div>
    </article>
  );
}
