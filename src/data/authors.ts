import type { ImageMetadata } from 'astro';

import markPhoto from '~/assets/images/team-mark.webp';
import scottPhoto from '~/assets/images/team-scott.webp';

export interface Author {
  /** URL segment, e.g. /author/mark */
  slug: string;
  /** Must match the `author` field used in post frontmatter. */
  name: string;
  role: string;
  bio: string;
  focus: string[];
  photo: ImageMetadata;
}

export const authors: Author[] = [
  {
    slug: 'mark',
    name: 'Mark',
    role: 'Design & QA',
    bio: 'Mark is the QA veteran of the two of us, with nearly a decade spent making sure other people’s games are as polished as they are fun. On Ki10 projects he handles game design and systems, and writes most of the devlogs.',
    focus: ['Game design', 'Systems & tools', 'QA and polish', 'Devlogs'],
    photo: markPhoto,
  },
  {
    slug: 'scott',
    name: 'Scott',
    role: 'Art & World Building',
    bio: 'Scott is the lead artist and world builder, and the reason any of this is worth looking at. Characters, environments, logos and UI all come through him first.',
    focus: ['Character & concept art', 'Environment art', '3D modelling', 'Logo & UI design'],
    photo: scottPhoto,
  },
];

/** Frontmatter stores a display name, so look authors up by that. */
export const getAuthorByName = (name?: string) =>
  name ? authors.find((author) => author.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
