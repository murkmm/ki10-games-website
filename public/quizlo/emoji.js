// The emoji players can choose as their picture, and the reactions they can send to the TV.
// Pictures of these live in web/emoji/ (made by tools/make_emoji.mjs) for screens without emoji.
export const AVATARS = ["🦊", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐧", "🦄", "🐙", "🐶", "🐱", "🐰", "🐻", "🐮", "🐷",
  "🐲", "🦖", "🐝", "🦋", "🌻", "🍕", "🍩", "🎸", "🚀", "👑", "🤖", "👻", "👽", "🤠", "🧙", "😎"];
export const REACTIONS = ["😂", "👏", "😱", "😍", "🤔", "🔥"];

/** File name of an emoji's picture, e.g. "1f98a.png". */
export function emojiFile(e) {
  return [...e].map((c) => c.codePointAt(0).toString(16)).filter((h) => h !== "fe0f").join("-") + ".png";
}
