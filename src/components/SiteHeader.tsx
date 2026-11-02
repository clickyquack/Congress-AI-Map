export const mainSite = {
  name: 'Political Will AI',
  home: '/',
  map: '/congress-map/',
} as const

type SiteHeaderProps = {
  page: 'home' | 'about'
}

export function SiteHeader({ page }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="shell">
        <a className="wordmark" href={mainSite.home}>
          {mainSite.name}
        </a>
        <nav aria-label="Map">
          <ul>
            <li>
              <a href={mainSite.map} aria-current={page === 'home' ? 'page' : undefined}>
                Map
              </a>
            </li>
            <li>
              <a href="#about" aria-current={page === 'about' ? 'page' : undefined}>
                About
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <p>{mainSite.name}</p>
      </div>
    </footer>
  )
}
