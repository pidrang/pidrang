export default {
  base: '/docs/',
  cleanUrls: true,
  title: 'Pidrang',
  description:
    'Documentation for Pidrang, the headless admin framework for Angular.',
  lang: 'en-US',
  appearance: 'dark',
  outDir: 'dist',
  ignoreDeadLinks: true,
  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: '/assets/logo/favicon-32.png',
      },
    ],
    ['meta', { name: 'theme-color', content: '#060b12' }],
    [
      'link',
      { rel: 'preload', as: 'style', href: '/docs/custom.css' },
    ],
    ['link', { rel: 'stylesheet', href: '/docs/custom.css' }],
  ],
  themeConfig: {
    logo: 'https://pidrang.dev/assets/logo/mark-light-500.png',
    siteTitle: 'Pidrang docs',
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Data providers', link: '/data-providers' },
      {
        text: 'Maintainers',
        items: [
          { text: 'Design notes', link: '/design-notes' },
          { text: 'Releasing', link: '/releasing' },
          { text: 'Demo artifacts', link: '/demo-artifacts' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Data providers', link: '/data-providers' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'CLI', link: '/reference/cli' }],
      },
      {
        text: 'Maintainers',
        items: [
          { text: 'Design notes', link: '/design-notes' },
          { text: 'Releasing', link: '/releasing' },
          { text: 'Demo artifacts', link: '/demo-artifacts' },
        ],
      },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/pidrang/pidrang/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [],
    footer: {
      message:
        'MIT licensed. Inspired by Refine. Not affiliated with Angular or Refine.',
      copyright: 'Pidrang',
    },
  },
};
