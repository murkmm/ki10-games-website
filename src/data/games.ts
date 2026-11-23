import type { ImageMetadata } from 'astro';

import kitGrass from '~/assets/images/kit-grass.jpg';
import kitGodotVista from '~/assets/images/kit-godot-vista.webp';
import kitGodotVillage from '~/assets/images/kit-godot-village.webp';
import kitGodotLeap from '~/assets/images/kit-godot-leap.webp';
import kitGodotCard from '~/assets/images/kit-godot-card.webp';
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
import skillcheckMenu from '~/assets/images/skillcheck-menu.webp';
import objHero from '~/assets/images/obj-hero.webp';
import objCard from '~/assets/images/obj-card.webp';
import objHome from '~/assets/images/obj-home.webp';
import objPlayVault from '~/assets/images/obj-play-vault.webp';
import objPlayShot from '~/assets/images/obj-play-shot.webp';
import objPlayLasers from '~/assets/images/obj-play-lasers.webp';
import objPlayVents from '~/assets/images/obj-play-vents.webp';
import objPlayWatch from '~/assets/images/obj-play-watch.webp';
import objResult from '~/assets/images/obj-result.webp';
import objOutfit from '~/assets/images/obj-outfit-preview.webp';
import sf0Hero from '~/assets/images/sf0-hero.png';
import sf0Card from '~/assets/images/sf0-card.png';
import sf0ShotOccupant from '~/assets/images/sf0-shot-occupant.png';
import sf0ShotRevolverNote from '~/assets/images/sf0-shot-revolver-note.png';
import sf0ShotCopierPhoto from '~/assets/images/sf0-shot-copier-photo.png';
import sf0ShotLocker from '~/assets/images/sf0-shot-locker.png';

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
  /** Per-game accent colours used on the game's own page and card hover. */
  accentLight: string;
  accentDark: string;
  hero?: ImageMetadata;
  /** Set when the hero art already has the game's logo on its left. */
  heroHasLogo?: boolean;
  card?: ImageMetadata;
  /** Optional self-hosted MP4 trailer (preferred over YouTube when available — works everywhere, zero cookies). */
  trailerVideo?: { src: string; poster?: string; youtubeUrl?: string };
  /** Optional YouTube video ID for a trailer embed on the game page. */
  youtubeTrailerId?: string;
  /** Optional caption shown beneath the trailer embed. */
  trailerCaption?: string;
  /** Optional Steam store URL (shows a dedicated wishlist button when set). */
  steamUrl?: string;
  /** Each shot is an image, or a looping clip from /public/videos (give the name without an extension). */
  gallery?: ({ image: ImageMetadata; caption: string } | { video: string; caption: string })[];
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
    slug: 'save-file-0',
    title: 'Save File 0',
    genre: 'Survival horror',
    status: 'in-development',
    tagline: 'First-person survival horror for the Game Boy Color, coming to a real cartridge.',
    pitch:
      'You’re covering the night QA shift at Oriole Software. The new build has a save bug nobody can reproduce, so you make a save, and the save index lists a second file that shouldn’t exist. Load it, and you’re back in the same office. You’re just not alone in it any more.',
    body: [
      'Save File 0 isn’t a game made to look like a Game Boy game. It’s a real Game Boy Color ROM, written in C and assembly, that runs on the original console. A raycaster draws the office in first person, and it’s built to hold 30 frames per second on the Game Boy Color’s double speed mode.',
      'Each save file is its own copy of the building, and when you load one you arrive exactly where you’re standing. Your save is the quiet office where you patch yourself up. FILE 0 is the same office, but wrong, and something in there can’t be killed. A shot only staggers it, so you break its line of sight, find a locker and keep very still.',
      'Save File 0 is heading for a proper physical Game Boy Color cartridge release — complete with box, manual, and on-cartridge saves — alongside a digital ROM. Join our updates list below and we’ll share demo news and release details as soon as we can.',
    ],
    engine: 'GBDK (C and assembly)',
    platforms: ['Game Boy Color'],
    releaseLine: 'In development · Physical Game Boy Color release coming',
    features: [
      {
        title: 'Two saves, one office',
        description:
          'Switch between your save and FILE 0 wherever you’re standing. A door opened in one stays open in the other.',
        icon: 'tabler:files',
      },
      {
        title: 'Something you can’t kill',
        description: 'A shot buys you a few seconds. After that it’s lockers, line of sight and running.',
        icon: 'tabler:ghost-2',
      },
      {
        title: 'Real Game Boy Color hardware',
        description: 'A native ROM with a first-person raycaster, built to run at 30 frames per second on the console.',
        icon: 'tabler:device-gamepad',
      },
      {
        title: 'A real cartridge',
        description: 'Saves are kept on the cartridge itself, and the cartridge has a few tricks a download can’t do.',
        icon: 'tabler:device-floppy',
      },
    ],
    links: [
      { label: 'Watch the trailer', href: 'https://youtu.be/nbiv6W50Lho', icon: 'tabler:brand-youtube', isPrimary: true },
      { label: 'Get updates', href: '#save-file-0-updates', icon: 'tabler:mail' },
      { label: 'Read the announcement', href: '/devlog-13-save-file-0', icon: 'tabler:notebook' },
    ],
    gradient: 'from-emerald-400 via-green-800 to-zinc-950',
    accentLight: '#157a46',
    accentDark: '#5ee88d',
    hero: sf0Hero,
    card: sf0Card,
    trailerVideo: {
      src: '/videos/sf0-teaser.mp4',
      poster: '/videos/sf0-teaser-poster.png',
      youtubeUrl: 'https://youtu.be/nbiv6W50Lho',
    },
    trailerCaption: 'Save File 0 teaser trailer — captured from the real Game Boy Color ROM. Contains brief flashing.',
    galleryRatio: 'aspect-[10/9]',
    gallery: [
      { video: 'sf0-save-index-file0', caption: 'The save index. You didn’t make the second one.' },
      { video: 'sf0-two-saves-one-office', caption: 'Same desk, different save.' },
      { video: 'sf0-occupant-doorway', caption: 'The Occupant. It can’t be killed.' },
      { video: 'sf0-crawler', caption: 'A crawler, and one point-blank shot.' },
      { image: sf0ShotOccupant, caption: 'Too close.' },
      { image: sf0ShotRevolverNote, caption: 'Mara’s revolver, and the note she left under it.' },
      { image: sf0ShotCopierPhoto, caption: 'The copier printed this on its own.' },
      { image: sf0ShotLocker, caption: 'The view from inside a locker.' },
    ],
    devlogTag: 'save-file-0',
  },
  {
    slug: 'boop-n-burn',
    title: 'Boop n Burn',
    genre: 'Party brawler',
    status: 'in-development',
    tagline: 'The floor is lava, and your mates are the real problem.',
    pitch:
      'Boop n Burn drops a lobby of up to sixteen players into an arena with one rule: don’t touch the lava. Shove, bump and boop everyone else in, survive the round, then do it all again. Usually it’s first to three wins.',
    body: [
      'In Boop n Burn there’s no health bar — just one well-timed shove into the lava and you’re out for the round. Rounds are short, snappy and loud, built for proper party-game chaos with friends.',
      'Shoving uses stamina, so you can’t just mash the button without thinking. You can jump into free-for-all or squad up in team modes, earn XP from matches, and unlock new gear like staffs and sonic booms to knock players further. Right now there are five arenas to fight over: a sunset shipping yard, a warehouse, a neon arcade, a ruined temple and a desert coliseum.',
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
        title: 'Shove-based combat',
        description:
          'The whole moveset is momentum, and every push costs stamina. Catch someone at the right angle and the lava does the rest.',
        icon: 'tabler:arrows-shuffle',
      },
      {
        title: 'Free-for-all or teams',
        description:
          'Play every player for themselves, or split into teams and try to coordinate who’s going in the lava next.',
        icon: 'tabler:users-group',
      },
      {
        title: 'Unlock as you play',
        description: 'Earn XP from every match to unlock new gear like staffs and sonic booms for bigger knockbacks.',
        icon: 'tabler:trophy',
      },
      {
        title: 'Five arenas to fight over',
        description:
          'Fight across a shipping yard, warehouse, arcade, ruined temple and desert coliseum — each with its own layout and hazards.',
        icon: 'tabler:map-2',
      },
    ],
    links: [{ label: 'Get demo updates', href: '/contact#newsletter', icon: 'tabler:mail', isPrimary: true }],
    gradient: 'from-orange-500 via-red-600 to-rose-700',
    accentLight: '#c84210',
    accentDark: '#ff7a3d',
    devlogTag: 'boop-n-burn',
    hero: bnbShipyard,
    card: bnbRuins,
    trailerVideo: {
      src: '/videos/bnb-trailer.mp4',
      poster: bnbShipyard.src,
    },
    trailerCaption: 'Boop n Burn cinematic trailer — shoving, climbing and surviving the rising lava.',
    gallery: [
      { image: bnbShipyard, caption: 'Fighting for the high ground in the sunset shipping yard.' },
      { image: bnbRuins, caption: 'The ruined temple arena — whoever’s leading the match wears the crown.' },
      { image: bnbArcade, caption: 'The neon arcade arena with glowing pink lava below.' },
      { image: bnbWarehouse, caption: 'A packed lobby scrambling for space inside the warehouse.' },
      { image: bnbColiseum, caption: 'Shoving matches across the desert coliseum pillars.' },
    ],
  },
  {
    slug: 'the-one-bullet-job',
    title: 'The One Bullet Job',
    genre: 'Heist puzzle',
    status: 'released',
    tagline: 'Get in. Get the cash. Get out.',
    pitch:
      'The One Bullet Job is a turn-based heist puzzle for your phone. Every job is a small room: steal the cash, slip past the guards and escape with the loot before your moves run out. You usually get one bullet, so make it count.',
    body: [
      'The game is played on a grid, one turn at a time. Dash up to three tiles, wait for a patrol to pass, or spend your bullet on the guard who’s in the way. Then the guards take their turn. They follow fixed routes and their sightlines are drawn right on the board, so if you get caught, you could have seen it coming.',
      'Grab one bag of cash to open the exit and earn a star. Take every bag for two, and do it within par for three. Undo is free and retries are instant, so having another go only takes a tap.',
      'There are 120 jobs across 20 chapters, and each chapter adds a new trick: shutters you open by shooting a relay, guards who only see what’s in front of them, sentries who turn every round, laser gates and air vents. Every job is checked by a solver before it goes in, so every single one can be beaten. On top of that there’s a fresh heist every day, and a crew of masks and outfits you earn just by playing.',
    ],
    engine: 'Godot',
    platforms: ['Android'],
    releaseLine: 'Out now on Android',
    features: [
      {
        title: 'One bullet. Make it count.',
        description:
          'Most jobs give you a single shot. Use it on the guard in your way, or save it for the one you can’t get around.',
        icon: 'tabler:target-arrow',
      },
      {
        title: 'Read the patrols',
        description:
          'Every guard walks a fixed patrol route with their sightlines shown right on the grid, so you can plan your whole escape ahead of time.',
        icon: 'tabler:eye',
      },
      {
        title: 'Three stars a job',
        description: 'Escape with some cash, escape with all of it, then do it within par.',
        icon: 'tabler:star',
      },
      {
        title: '120 jobs, 20 chapters',
        description:
          'Relays and shutters, directional guards, turning sentries, laser gates, vents and keycards, introduced one at a time.',
        icon: 'tabler:puzzle',
      },
      {
        title: 'A new heist every day',
        description: 'A daily job alongside the campaign, so there’s always something new to break into.',
        icon: 'tabler:calendar-event',
      },
      {
        title: '20 masks, 10 outfits',
        description: 'Unlock masks by clearing chapters and buy outfits using stars you earn playing — no paid cosmetics.',
        icon: 'tabler:mask',
      },
    ],
    links: [
      {
        label: 'Get it on Google Play',
        href: 'https://play.google.com/store/apps/details?id=com.ki10games.onebulletjob',
        icon: 'tabler:brand-google-play',
        isPrimary: true,
      },
    ],
    gradient: 'from-amber-300 via-yellow-600 to-stone-900',
    accentLight: '#b4690e',
    accentDark: '#f5b82e',
    hero: objHero,
    heroHasLogo: true,
    card: objCard,
    youtubeTrailerId: 'w3m4GHdkFXY',
    trailerCaption: 'The One Bullet Job launch trailer — every move recorded in-game.',
    galleryRatio: 'aspect-[9/16]',
    gallery: [
      { image: objHome, caption: 'Pick up where you left off, or jump into the daily heist.' },
      { image: objPlayVault, caption: 'Plan every move — the cyan tiles show where you can dash.' },
      { image: objPlayShot, caption: 'Spending your single bullet to clear a guard out of the way.' },
      { image: objPlayLasers, caption: 'Laser gates switch on and off each turn, so timing matters.' },
      { image: objPlayVents, caption: 'Air vents let you slip behind guards on the far side of the room.' },
      { image: objPlayWatch, caption: 'Every guard follows a fixed patrol route you can read and plan around.' },
      { image: objResult, caption: 'A three-star clear — all cash grabbed within the move par.' },
      { image: objOutfit, caption: 'The Don outfit from the crew wardrobe, unlocked with stars.' },
    ],
    devlogTag: 'the-one-bullet-job',
  },
  {
    slug: 'skill-check',
    title: 'Skill Check',
    genre: 'Daily trivia',
    status: 'released',
    tagline: 'A fresh run of gaming trivia every single day.',
    pitch:
      'Skill Check is a daily trivia game about the games you grew up with. Every day brings a new themed run, from Age of Empires II to The Sims, covering the franchises, studios and deep cuts that gamers actually argue about.',
    body: [
      'It’s built for the few minutes you have with a coffee. Pick your cards, answer the questions they unlock, and find out whether you really know as much about your favourite franchise as you think you do. Stack a matching set for a big score bonus, chase a better rank than yesterday, then come back tomorrow for a new run.',
      'Skill Check was our first proper release as a studio. It’s out now on Android and free to play in any browser.',
    ],
    engine: 'Godot',
    platforms: ['Android', 'Web browser'],
    releaseLine: 'Out now on Android and in your browser',
    features: [
      {
        title: 'A new run every day',
        description: 'Every day has its own theme, so there’s always a reason to come back.',
        icon: 'tabler:calendar-repeat',
      },
      {
        title: 'Play your cards',
        description:
          'The cards you pick set both the difficulty and the score on offer. Stack a matching set and the bonus gets big fast.',
        icon: 'tabler:cards',
      },
      {
        title: 'Franchise deep cuts',
        description:
          'Questions span decades of games, mixing well-known classics with deep-cut trivia for longtime fans.',
        icon: 'tabler:brain',
      },
      {
        title: 'Nearly 1,600 cartridges',
        description:
          'Every character, level and item you answer correctly on joins a collection for you to master. Free on Android and in the browser.',
        icon: 'tabler:device-gamepad-2',
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
    accentLight: '#a21caf',
    accentDark: '#e879f9',
    devlogTag: 'skill-check',
    hero: skillcheckHero,
    card: skillcheckCard,
    galleryRatio: 'aspect-[9/16]',
    gallery: [
      { image: skillcheckMenu, caption: 'Today’s run, today’s cards, and yesterday’s rank to beat.' },
      { image: skillcheckCardSelect, caption: 'A matching set stacked up. That’s a lot of points riding on a castle.' },
      { image: skillcheckQuestion, caption: 'A question in play. Answer before that bar runs out!' },
      { image: skillcheckCollection, caption: 'Nearly 1,600 cartridges to collect and master.' },
    ],
  },
  {
    slug: 'kit-knight-in-training',
    title: 'KIT: Knight in Training',
    genre: '3D action adventure',
    status: 'in-development',
    tagline: 'A kitten with a sword, a world to explore, and a knighthood to earn.',
    pitch:
      'KIT is a 3D action adventure in the spirit of the mascot platformers we grew up on. A colourful world, a camera that shifts between 3D exploration and 2D side-on sections, and a small cat with a very large sword.',
    body: [
      'KIT was our first serious project as a studio, and the subject of our first nine devlogs. We covered everything from the camera system and quest tracking right down to the grass. A lot of it works and we’re still proud of it.',
      'And now it’s back. We put KIT on hold to go and learn how to actually finish games, and having done that, we’re rebuilding it in Godot. The core mechanics are already feeling good in the new engine, they just need more fine tuning, and work has started on the first level. The first three screenshots below are from the new Godot version, which is using placeholder models for now, and the rest are from the original Unity one.',
    ],
    engine: 'Godot (ported from Unity)',
    platforms: ['PC'],
    releaseLine: 'Being rebuilt in Godot',
    features: [
      {
        title: 'A camera that shifts with you',
        description:
          'Dolly paths, player-controlled cameras and full 2D side-on sections, all blended smoothly as you explore.',
        icon: 'tabler:video',
      },
      {
        title: 'Paw Prints of Prowess',
        description:
          'A map and quest system built around hunting down collectibles hidden all over a hand-built world.',
        icon: 'tabler:map-2',
      },
      {
        title: 'A creature garden',
        description:
          'A companion system where the creatures you meet come home with you. It started life as scope creep, and now we can’t imagine the game without it.',
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
    accentLight: '#0284c7',
    accentDark: '#38bdf8',
    devlogTag: 'kit',
    hero: kitGodotVista,
    card: kitGodotCard,
    gallery: [
      { image: kitGodotVista, caption: 'Briarwatch, the first level, rebuilt in Godot. Placeholder models for now.' },
      { image: kitGodotVillage, caption: 'Briarwatch Green, under the old oath tree. (Godot, placeholder models)' },
      { image: kitGodotLeap, caption: 'A big leap out of the long grass. (Godot, placeholder models)' },
      { video: 'kit-highlight', caption: 'Platforming across the floating islands. (Unity)' },
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
