// Set the theme before the page paints so dark mode never flashes white.
;(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('pulse.theme') || '"system"')
    var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
