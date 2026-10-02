// leave loads href as a new page: nothing of the old one survives, neither
// the access token in memory nor the query cache. Tests swap it for a stub.
export function leave(href: string) {
  window.location.replace(href)
}
