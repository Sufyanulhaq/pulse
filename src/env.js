/** Build time switches. VITE_DEMO=1 builds the free static demo that runs without a server. */
export const DEMO = import.meta.env.VITE_DEMO === '1'

/** Where the site is served from, for example / or /pulse/ on GitHub Pages. */
export const BASE = import.meta.env.BASE_URL || '/'

export const asset = (path) => `${BASE}${path.replace(/^\//, '')}`

export const REPO_URL = 'https://github.com/Sufyanulhaq/pulse'
