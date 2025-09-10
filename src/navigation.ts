import { getPermalink, getBlogPermalink } from './utils/permalinks';
export const headerData = {
	links: [
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
		{ ariaLabel: 'X (Twitter)', icon: 'tabler:brand-x', href: '#' },
		{ ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
		{ ariaLabel: 'Github', icon: 'tabler:brand-github', href: '#' },
	],
	footNote: `
    &copy; ${new Date().getFullYear()} Ki10 Games · All rights reserved.
  `,
};