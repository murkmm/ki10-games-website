import { getPermalink, getBlogPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'About',
      href: getPermalink('/about'),
    },
    {
      text: 'Projects',
      href: getPermalink('/projects'),
    },
    {
      text: 'Team',
      href: getPermalink('/team'),
    },
    {
      text: 'Devlog',
      href: getBlogPermalink(),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'), // 👈 This is the new line
    },
  ],
  actions: [], // This is empty to hide the header button
};

export const footerData = {
  links: [], // Kept empty for a cleaner footer
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://x.com/Ki10Games/' },
    { ariaLabel: 'YouTube', icon: 'tabler:brand-youtube', href: 'https://youtube.com/@official.ki10games' },
    { ariaLabel: 'TikTok', icon: 'tabler:brand-tiktok', href: 'https://www.tiktok.com/@ki10.games' },
    { ariaLabel: 'Discord', icon: 'tabler:brand-discord', href: 'https://discord.gg/NqtVzsmj3A' },
    { ariaLabel: 'Steam', icon: 'tabler:brand-steam', href: 'https://steamcommunity.com/groups/Ki10Games' },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Ki10 Games · All rights reserved.
  `,
};
