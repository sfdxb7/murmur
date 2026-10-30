/**
 * The live title, else the list's, else your opening words. Those words wait
 * while the list is still on its way: shown first, they'd change to its title.
 */
export function nameOf({
  live,
  listed,
  opening,
  listing,
}: {
  live: string
  listed?: string
  opening: string
  listing: boolean
}) {
  if (live || listed) return live || listed!
  return listing ? '' : opening
}
