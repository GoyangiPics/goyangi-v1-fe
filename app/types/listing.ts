/** Page-change payload emitted by ListingPaginator (same shape the old
 * PrimeVue Paginator emitted: `first`/`rows` offsets plus 0-based `page`). */
export type PageState = {
  first: number
  rows: number
  page: number
  pageCount?: number
}
