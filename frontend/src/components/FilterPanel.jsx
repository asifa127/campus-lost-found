import { Checkbox, Input, Select, Swatches } from './ui';
import { BUILDINGS, COLOR_OPTIONS, ITEM_STATUSES } from '../utils/format';

const Group = ({ title, children }) => (
  <div role="group" aria-label={title} className="flex flex-col gap-3 py-6 first:pt-0 last:pb-0">
    <h3 className="eyebrow">{title}</h3>
    {children}
  </div>
);

// values use the URL parameter names: category[], color[], location, building, status, dateFrom, dateTo.
export default function FilterPanel({ values, onChange, facets = {}, categories = [], locations = [] }) {
  return (
    <div data-slot="filter-panel" className="flex flex-col divide-y divide-border">
      <Group title="Category">
        {categories.map((c) => {
          const count = facets[c.name] || 0;
          const checked = values.category.includes(c.name);
          const disabled = count === 0 && !checked;
          return (
            <label key={c._id} className={`flex items-center gap-2.5 text-sm ${disabled ? 'text-muted-foreground' : 'cursor-pointer'}`}>
              <Checkbox checked={checked} disabled={disabled}
                onChange={() => onChange({ category: checked ? values.category.filter((v) => v !== c.name) : [...values.category, c.name] })} />
              {c.name}
              <span className="ms-auto text-xs tabular-nums text-muted-foreground">{count}</span>
            </label>
          );
        })}
      </Group>

      <Group title="Colour">
        <Swatches options={COLOR_OPTIONS} value={values.color} onChange={(color) => onChange({ color })} />
      </Group>

      <Group title="Location">
        <Select aria-label="Location" placeholder="Any location" options={locations.map((l) => l.name)} value={values.location} onChange={(e) => onChange({ location: e.target.value })} />
        <Select aria-label="Building" placeholder="Any building" options={BUILDINGS} value={values.building} onChange={(e) => onChange({ building: e.target.value })} />
      </Group>

      <Group title="Status">
        <Select aria-label="Status" placeholder="Any status" options={ITEM_STATUSES.filter((s) => s !== 'Draft')} value={values.status} onChange={(e) => onChange({ status: e.target.value })} />
      </Group>

      <Group title="Date">
        <Input label="From date" type="date" value={values.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
        <Input label="To date" type="date" value={values.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
      </Group>
    </div>
  );
}
