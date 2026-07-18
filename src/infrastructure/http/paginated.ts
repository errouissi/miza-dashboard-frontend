/**
 * The one pagination shape the application works in (FTA §7, D-6).
 *
 * The backend does NOT emit one envelope. Villes and Bons return
 * `{data, links, meta}`; Clients and Agents return `{success, data: <paginator>}`.
 * Both normalize to THIS type, and the normalizing happens in each resource's own
 * api/ module — that is the anti-corruption layer, and it is why a backend
 * envelope change is a one-file change rather than a component-tree change.
 *
 * Deliberately NOT included: `links`. Cursor/prev/next URLs are the transport's
 * business; the UI pages by number, and holding backend URLs in component state
 * is how a filter change and a page change end up disagreeing.
 */
export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
};

/** The `{data, links, meta}` envelope, as emitted by the Phase-4A admin lists. */
export type LaravelPageEnvelope<TRow> = {
  data: TRow[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

/**
 * Maps the standard Laravel resource-collection envelope, applying `mapRow` to
 * each row. Resources whose envelope differs map their own — they do not bend
 * this function into a shape it was not built for.
 */
export function fromLaravelPage<TRow, T>(
  envelope: LaravelPageEnvelope<TRow>,
  mapRow: (row: TRow) => T,
): Paginated<T> {
  return {
    items: envelope.data.map(mapRow),
    page: envelope.meta.current_page,
    perPage: envelope.meta.per_page,
    total: envelope.meta.total,
    lastPage: envelope.meta.last_page,
  };
}
