import { getPermalink, getBlogPermalink } from './utils/permalinks';
import { studio } from './data/studio';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      // Route stays /projects so existing links and shares keep working.
      text: 'Games',
      href: getPermalink('/projects'),
    },
    {
      text: 'Devlog',
      href: getBlogPermalink(),
    },
    {
      text: 'QA Services',
      href: getPermalink('/qa-services'),
    },
    {
      text: 'About',
      href: getPermalink('/about'),
    },
    {
      text: 'Team',
      href: getPermalink('/team'),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [],
};

export const footerData = {
  links: [
    {
      title: 'Games',
      links: [
        { text: 'Save File 0', href: getPermalink('/projects/save-file-0') },
        { text: 'Boop n Burn', href: getPermalink('/projects/boop-n-burn') },
        { text: 'The One Bullet Job', href: getPermalink('/projects/the-one-bullet-job') },
        { text: 'Skill Check', href: getPermalink('/projects/skill-check') },
        { text: 'KIT: Knight in Training', href: getPermalink('/projects/kit-knight-in-training') },
      ],
    },
    {
      title: 'Studio',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Team', href: getPermalink('/team') },
        { text: 'Devlog', href: getBlogPermalink() },
        { text: 'QA Services', href: getPermalink('/qa-services') },
        { text: 'Press kit', href: getPermalink('/press') },
        { text: 'Press coverage', href: getPermalink('/press-coverage') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
    { text: 'RSS', href: getPermalink('/rss.xml') },
  ],
  socialLinks: [
    ...studio.socialLinks.map(({ ariaLabel, icon, href }) => ({ ariaLabel, icon, href })),
    { ariaLabel: 'RSS Feed', icon: 'tabler:rss', href: getPermalink('/rss.xml') },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} ${studio.legalName} · Company No. ${studio.companyNumber} · Registered in England and Wales · Registered office: ${studio.registeredOffice} · <a href="${studio.companiesHouseUrl}" target="_blank" rel="noopener noreferrer" class="underline hover:text-secondary">Company register</a> · <a href="mailto:${studio.businessEmail}" class="underline hover:text-secondary">Business enquiries</a> · All rights reserved.
  `,
};
