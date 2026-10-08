import type { ImageMetadata } from 'astro';

import foxboyLogo from '~/assets/images/friends/foxboy-productions.png';

export interface Friend {
  name: string;
  href: string;
  logo: ImageMetadata;
}

/** Studios and people we know and like. Shown in the "Friends of Ki10 Games" section on the home page. */
export const friends: Friend[] = [
  {
    name: 'FOXBOY Productions',
    href: 'https://www.foxboyproductions.com/',
    logo: foxboyLogo,
  },
];
