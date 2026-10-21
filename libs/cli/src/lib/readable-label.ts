const SEPARATORS = /[_\-.]+/;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function lowerCase(word: string): string {
  return word.toLowerCase();
}

export function readableLabel(name: string): string {
  const words: string[] = [];
  for (const word of name.split(SEPARATORS)) {
    let current = '';
    for (const character of word) {
      const previous = current[current.length - 1];
      if (
        current !== '' &&
        character !== lowerCase(character) &&
        previous === lowerCase(previous)
      ) {
        words.push(current);
        current = '';
      }
      current += character;
    }
    if (current !== '') {
      words.push(current);
    }
  }
  if (words.length === 0) {
    return name;
  }
  return words
    .map((word, index) => (index === 0 ? capitalize(word) : lowerCase(word)))
    .join(' ');
}
