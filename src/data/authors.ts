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
    role: 'Design, Programming & QA',
    bio: 'Mark is the games industry veteran of the team, with 10+ years of experience in QA at studios like Supermassive Games, Creative Assembly and Unity. At Ki10 he handles design, programming and testing, and writes most of the devlogs.',
    focus: ['Game design', 'Programming', 'QA & polish', 'Devlogs'],
    photo: markPhoto,
  },
  {
    slug: 'scott',
    name: 'Scott',
    role: 'Art & World Building',
    bio: 'Scott is our resident artist and brings his wonderfully unique art style to our games. He’s been playing games since he was young and always dreamt of making them — now he’s pitching in wherever he can to give everything we build its own distinct look.',
    focus: ['Character & concept art', 'Environment art', '3D modelling', 'Logo & UI design'],
    photo: scottPhoto,
  },
];

/** Frontmatter stores a display name, so look authors up by that. */
export const getAuthorByName = (name?: string) =>
  name ? authors.find((author) => author.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
