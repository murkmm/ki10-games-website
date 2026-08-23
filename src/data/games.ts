import type { ImageMetadata } from 'astro';

import kitGrass from '~/assets/images/kit-grass.jpg';
import kitHighlight from '~/assets/images/kit-highlight.webp';
import kitMapQuest from '~/assets/images/kit-map-quest.jpg';
import kitFinalModel from '~/assets/images/kit-final-model.jpeg';
import kitGarden from '~/assets/images/kit-garden.jpg';
import kitEnemy from '~/assets/images/kit-enemy.jpg';
import bnbShipyard from '~/assets/images/bnb-shipyard.webp';
import bnbWarehouse from '~/assets/images/bnb-warehouse.webp';
import bnbArcade from '~/assets/images/bnb-arcade.webp';
import bnbRuins from '~/assets/images/bnb-ruins.webp';
import bnbColiseum from '~/assets/images/bnb-coliseum.webp';
import skillcheckHero from '~/assets/images/skillcheck-hero.webp';
import skillcheckCard from '~/assets/images/skillcheck-card.webp';
import skillcheckQuestion from '~/assets/images/skillcheck-question.webp';
import skillcheckCollection from '~/assets/images/skillcheck-collection.webp';
import skillcheckCardSelect from '~/assets/images/skillcheck-card-select.webp';

export type GameStatus = 'released' | 'in-development' | 'on-hold';

export interface GameLink {
  label: string;
  href: string;
  icon: string;
  /** Primary links render as filled buttons; the rest render as outlines. */
  isPrimary?: boolean;
}

export interface Game {
  slug: string;
  title: string;
  /** Short genre label, e.g. "Daily trivia". Used on cards and in metadata. */
  genre: string;
  status: GameStatus;
  /** One line. Shown on the card and as the page's meta description. */
  tagline: string;
  /** Two or three sentences. Shown at the top of the game's own page. */
  pitch: string;
  /** Longer body copy, rendered as separate paragraphs. */
  body: string[];
  engine: string;
  platforms: string[];
  /** Free text release line, e.g. "Out now" or "Demo in February 2027". */
  releaseLine: string;
  features: { title: string; description: string; icon: string }[];
  links: GameLink[];
  /** Tailwind gradient used for the art fallback and status accents. */
  gradient: string;
  hero?: ImageMetadata;
  card?: ImageMetadata;
  gallery?: { image: ImageMetadata; caption: string }[];
  /** Tailwind aspect class for gallery shots. Portrait games need their own. */
  galleryRatio?: string;
  /** Set when the game has no real art yet, so the UI can say so honestly. */
  needsArt?: boolean;
  /** Devlog tag slug, used to pull this game's posts onto its page. */
  devlogTag?: string;
}

export const statusLabels: Record<GameStatus, string> = {
  released: 'Out now',
  'in-development': 'In development',
  'on-hold': 'On hold',
};

export const games: Game[] = [
  {
    slug: 'boop-n-burn',
    title: 'Boop n Burn',
    genre: 'Party brawler',
    status: 'in-development',
    tagline: 'The floor is lava, and your mates are the real problem.',
    pitch:
      'Boop n Burn drops a lobby of up to sixteen players into an arena with one rule: don’t touch the lava. Shove, bump and boop everyone else in, survive the round, then do it all again. Usually it’s first to three wins.',
    body: [
      'There’s no health bar and nothing to chip away at. One shove at the wrong moment and you’re gone, watching from the sidelines while the kill feed happily tells everyone exactly who did it to you. Rounds are short and losing is funny, so nobody ever wants to stop at one.',
      'Shoving costs stamina, so going for a push is an actual decision and not just a button you mash. There’s free for all if you want everyone against everyone, and team modes if you’d rather have someone to blame. Matches earn you XP, and levelling up unlocks new gear like staffs and sonic booms (all excellent ways of moving people who’d rather not be moved). So far there are five arenas: a shipping yard at sunset, a warehouse, an arcade, a ruined temple and a desert coliseum.',
    ],
    engine: 'Godot',
    platforms: ['PC', 'Nintendo Switch', 'Xbox Series X|S'],
    releaseLine: 'Demo planned for Steam Next Fest, February 2027',
    features: [
      {
        title: 'Up to sixteen in, one out',
        description:
          'Lobbies go up to sixteen players, there are no respawns, and it’s usually first to three round wins.',
        icon: 'tabler:flame',
      },
      {
        title: 'Shove based combat',
        description:
          'The whole moveset is momentum, and every push costs stamina. Boop someone at the right angle and the lava does the rest for you.',
        icon: 'tabler:arrows-shuffle',
      },
      {
        title: 'Free for all or teams',
        description:
          'Everyone against everyone, or team modes when you’d rather share the blame for who ended up in the lava.',
        icon: 'tabler:users-group',
      },
      {
        title: 'Unlock as you play',
        description:
          'Matches earn XP, and levelling up hands you new gear like staffs and sonic booms for relocating your friends.',
        icon: 'tabler:trophy',
      },
      {
        title: 'Five arenas, one rule',
        description:
          'A shipping yard, a warehouse, an arcade, a ruined temple and a desert coliseum. The lava changes colour, the rule never does.',
        icon: 'tabler:map-2',
      },
    ],
    links: [],
    gradient: 'from-orange-500 via-red-600 to-rose-700',
    hero: bnbShipyard,
    card: bnbRuins,
    gallery: [
      { image: bnbShipyard, caption: 'The shipping yard at sunset. Climb high, or get booped off it.' },
      { image: bnbRuins, caption: 'A ruined temple, with whoever’s winning wearing the crown.' },
      { image: bnbArcade, caption: 'The arcade, where the lava is an alarming shade of pink.' },
      { image: bnbWarehouse, caption: 'A full lobby, one warehouse, and not nearly enough floor.' },
      { image: bnbColiseum, caption: 'The desert coliseum, moments after Dale shoved Jake into the lava. Sorry Jake.' },
    ],
  },
  {
    slug: 'skill-check',
    title: 'Skill Check',
    genre: 'Daily trivia',
    status: 'released',
    tagline: 'A new gaming trivia question every single day.',
    pitch:
      'Skill Check is a daily trivia game about the games you grew up with. One fresh set of questions every day, covering the franchises, studios and deep cuts that gamers actually argue about.',
    body: [
      'It’s built for the two minutes you have with a coffee. Open it, take the day’s questions, and find out whether you really know as much about your favourite franchise as you think you do. Then come back tomorrow for a new set.',
      'Skill Check was our first proper release as a studio. A complete, shipped, playable thing rather than another project living forever in a folder. It’s out now on Android and free to play in any browser.',
    ],
    engine: 'Godot',
    platforms: ['Android', 'Web browser'],
    releaseLine: 'Out now on Android and in your browser',
    features: [
      {
        title: 'A new set every day',
        description:
          'Questions refresh daily, so there’s always a reason to come back, and always a new way to embarrass yourself.',
        icon: 'tabler:calendar-repeat',
      },
      {
        title: 'Franchise deep cuts',
        description:
          'Questions cover the whole history of gaming, from the obvious mascots to things only the people who were there will remember.',
        icon: 'tabler:brain',
      },
      {
        title: 'Two minutes a day',
        description: 'Short by design. Skill Check is meant to fit into a coffee break, not eat your whole evening.',
        icon: 'tabler:clock-play',
      },
      {
        title: 'Nearly 1,600 cartridges',
        description:
          'Every character, level and item you answer correctly on joins a collection for you to master. Free on Android and in the browser.',
        icon: 'tabler:cards',
      },
    ],
    links: [
      {
        label: 'Play in your browser',
        href: 'https://skillcheckgame.com/',
        icon: 'tabler:world',
        isPrimary: true,
      },
      {
        label: 'Get it on Google Play',
        href: 'https://play.google.com/store/apps/details?id=com.ki10games.skillcheck',
        icon: 'tabler:brand-google-play',
      },
    ],
    gradient: 'from-cyan-400 via-cyan-600 to-fuchsia-700',
    hero: skillcheckHero,
    card: skillcheckCard,
    galleryRatio: 'aspect-[453/806]',
    gallery: [
      { image: skillcheckQuestion, caption: 'A question in play. Answer before that bar runs out!' },
      { image: skillcheckCardSelect, caption: 'Cards set the difficulty, and the score you stand to win.' },
      { image: skillcheckCollection, caption: 'Nearly 1,600 cartridges to hunt down and master. No pressure.' },
    ],
  },
  {
    slug: 'kit-knight-in-training',
    title: 'KIT: Knight in Training',
    genre: '3D action adventure',
    status: 'on-hold',
    tagline: 'A kitten with a sword, a world to explore, and a knighthood to earn.',
    pitch:
      'KIT is a 3D action adventure in the spirit of the mascot platformers we grew up on. A vibrant world, a camera that shifts between 3D exploration and 2D side on sections, and a small cat with a very large sword.',
    body: [
      'KIT was our first serious project as a studio, and the subject of our first nine devlogs. We covered everything from the camera system and quest tracking right down to the grass. A lot of it genuinely works and we’re still proud of it.',
      'It’s on hold rather than cancelled. Boop n Burn has our attention for now, but KIT is a world we fully intend to come back to. The devlogs stay up in the meantime, because the process was worth writing down either way.',
    ],
    engine: 'Unity',
    platforms: ['PC'],
    releaseLine: 'Paused, but we plan to come back to it',
    features: [
      {
        title: 'A camera that shifts with you',
        description:
          'Dolly paths, player controlled cameras and full 2D side on sections, all blended so you never notice the joins.',
        icon: 'tabler:video',
      },
      {
        title: 'Paw Prints of Prowess',
        description:
          'A map and quest system built around hunting down collectibles hidden all over a hand built world.',
        icon: 'tabler:map-2',
      },
      {
        title: 'A creature garden',
        description:
          'A companion system where the creatures you meet come home with you. It started life as scope creep and then refused to leave.',
        icon: 'tabler:cat',
      },
      {
        title: 'Nine devlogs deep',
        description: 'Character design, terrain, UI, cameras and plenty of honest mistakes, all written up as we went.',
        icon: 'tabler:notebook',
      },
    ],
    links: [{ label: 'Read the KIT devlogs', href: '/tag/kit', icon: 'tabler:notebook', isPrimary: true }],
    gradient: 'from-sky-400 via-cyan-500 to-blue-600',
    devlogTag: 'kit',
    hero: kitGrass,
    card: kitGrass,
    gallery: [
      { image: kitHighlight, caption: 'Platforming across the floating islands.' },
      { image: kitGrass, caption: 'The grass and terrain pass, made in Blender.' },
      { image: kitMapQuest, caption: 'The map and quest UI, keeping track of the Paw Prints of Prowess.' },
      { image: kitFinalModel, caption: 'KIT’s final character model.' },
      { image: kitEnemy, caption: 'An early enemy design.' },
      { image: kitGarden, caption: 'Blocking out the creature garden.' },
    ],
  },
];

export const getGame = (slug: string) => games.find((game) => game.slug === slug);

/** Released and in-development games first, paused work last. */
export const featuredGames = games.filter((game) => game.status !== 'on-hold');
