const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export const countCharacters = (text: string): number => [...segmenter.segment(text)].length;
export const validMessage = (text: string): boolean =>
  text.trim().length > 0 && countCharacters(text) <= 20;
