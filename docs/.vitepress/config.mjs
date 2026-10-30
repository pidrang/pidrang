const origin = 'https://pidrang.dev';
const socialCard = `${origin}/assets/social/social-card.png`;

// cleanUrls serves index.md as its folder; the canonical must match the sitemap
function canonicalUrl(relativePath) {
  const clean = relativePath
    .replace(/(^|\/)index\.md$/, '$1')
    .replace(/\.md$/, '');
  return `${origin}/docs/${clean}`;
}

export default {
  base: '/docs/',
  cleanUrls: true,
  title: 'Pidrang',
  description:
    'Documentation for Pidrang, the headless admin framework for Angular.',
  lang: 'en',
  appearance: 'force-dark',
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
      {
        text: 'Reference',
        items: [
          { text: 'Core', link: '/reference/core' },
          { text: 'Components', link: '/reference/components' },
          { text: 'UI layers', link: '/ui-layers/' },
          { text: 'CLI', link: '/reference/cli' },
        ],
      },
      {
        text: 'Maintainers',
        items: [
          { text: 'Design notes', link: '/design-notes' },
          { text: 'Releasing', link: '/releasing' },
          { text: 'Demo artifacts', link: '/demo-artifacts' },
        ],
      },
      { text: 'Demos', link: 'https://pidrang.dev/demos/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Write the pages yourself', link: '/manual-setup' },
          { text: 'Authentication', link: '/authentication' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Data providers', link: '/data-providers' },
        ],
      },
      {
        text: 'UI layers',
        items: [
          { text: 'Overview', link: '/ui-layers/' },
          { text: 'Angular Material', link: '/ui-layers/material' },
          { text: 'Tailwind CSS', link: '/ui-layers/tailwind' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Core', link: '/reference/core' },
          { text: 'Components', link: '/reference/components' },
          { text: 'CLI', link: '/reference/cli' },
        ],
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
  transformHead({ pageData }) {
    if (pageData.relativePath === '404.md') {
      return [];
    }
    const url = canonicalUrl(pageData.relativePath);
    const title = pageData.title || 'Pidrang documentation';
    const description = pageData.description ?? '';
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'Pidrang' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: socialCard }],
      ['meta', { property: 'og:image:alt', content: 'Pidrang social card' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ];
  },
};
