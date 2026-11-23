export interface SocialLink {
  title: string;
  ariaLabel: string;
  icon: string;
  href: string;
}

/**
 * Shared studio info used across the homepage, contact page, press kit and footer.
 * Update `currentlyWorkingOn` whenever you want the homepage status note to change.
 */
export const studio = {
  name: 'Ki10 Games',
  legalName: 'Ki10 Games Ltd',
  companyNumber: '15687835',
  companiesHouseUrl: 'https://find-and-update.company-information.service.gov.uk/company/15687835',
  registeredOffice: '41 Torwood Road, Chadderton, Oldham, OL9 0RA, United Kingdom',
  founded: 'April 2024',
  location: 'United Kingdom',
  website: 'ki10games.com',
  contactEmail: 'contact@ki10games.com',
  businessEmail: 'business@ki10games.com',
  discordUrl: 'https://discord.gg/NqtVzsmj3A',
  steamGroupUrl: 'https://steamcommunity.com/groups/Ki10Games',
  currentlyWorkingOn: {
    label: 'In the workshop right now',
    text: 'Main focus right now is Save File 0 for the Game Boy Color, alongside getting Boop n Burn ready for Steam Next Fest in February.',
    updated: 'November 2026',
  },
  socialLinks: [
    { title: 'Discord', ariaLabel: 'Discord', icon: 'tabler:brand-discord', href: 'https://discord.gg/NqtVzsmj3A' },
    { title: 'YouTube', ariaLabel: 'YouTube', icon: 'tabler:brand-youtube', href: 'https://youtube.com/@official.ki10games' },
    { title: 'TikTok', ariaLabel: 'TikTok', icon: 'tabler:brand-tiktok', href: 'https://www.tiktok.com/@ki10.games' },
    { title: 'X (Twitter)', ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://x.com/Ki10Games/' },
    { title: 'Steam', ariaLabel: 'Steam', icon: 'tabler:brand-steam', href: 'https://steamcommunity.com/groups/Ki10Games' },
  ] satisfies SocialLink[],
};
