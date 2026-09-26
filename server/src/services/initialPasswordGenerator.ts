import { randomInt } from "node:crypto";

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*_-+=?";
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

function pick(characters: string): string {
  return characters[randomInt(characters.length)] as string;
}

export function generateInitialPassword(length = 16): string {
  if (length < 4) {
    throw new Error("Initial password length must be at least four characters");
  }

  const characters = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS), pick(SYMBOLS)];
  while (characters.length < length) {
    characters.push(pick(ALL_CHARACTERS));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex] as string, characters[index] as string];
  }

  return characters.join("");
}
