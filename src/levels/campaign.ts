import type { Level } from '../types/game'
import { parseAsciiLevel, type AsciiLevelSpec } from './parse'

// See parse.ts for the legend. Lies: P I D B X/e Y/t
export const CAMPAIGN_SPECS: AsciiLevelSpec[] = [
  {
    name: { he: 'הקיר שאינו', en: 'The Wall That Isn’t' },
    hint: {
      he: 'לפי המפה אין דרך אל היציאה. אולי אחד הקירות בכלל לא שם? כשתזהה שקר — לחץ עליו.',
      en: 'The map says the exit is sealed off. Maybe one of those walls isn’t really there? Click a lie when you spot it.',
    },
    rows: [
      '#########',
      '#S......#',
      '#######.#',
      '#.......#',
      '#.#######',
      '#...#...#',
      '###.P.#E#',
      '#....##.#',
      '#########',
    ],
  },
  {
    name: { he: 'הקיצור שלא קיים', en: 'The Shortcut That Isn’t' },
    hint: {
      he: 'המפה מבטיחה מסדרון ישר אל היציאה. סמוך על הפנס שלך, לא על המפה. (^ = מלכודת אמיתית — המפה לא משקרת עליה)',
      en: 'The map promises a straight corridor to the exit. Trust your lantern, not the map. (^ = a real trap — the map is honest about it)',
    },
    rows: [
      '###########',
      '#S..I....E#',
      '#.#######.#',
      '#...^.....#',
      '#.#####.#.#',
      '#.......#T#',
      '###########',
    ],
  },
  {
    name: { he: 'רצפה תמימה', en: 'Innocent Floor' },
    hint: {
      he: 'הדרך הקצרה נראית בטוחה במפה. תמיד תסתכל לאן אתה דורך — מלכודת מוסווית נראית רק מקרוב.',
      en: 'The short way looks safe on the map. Always look where you step — a disguised trap only shows up close.',
    },
    rows: [
      '#############',
      '#S....D....E#',
      '#.####.####.#',
      '#.#.T#.#..#.#',
      '#.#.##.##.#.#',
      '#...........#',
      '#############',
    ],
  },
  {
    name: { he: 'הדלת הלא נכונה', en: 'The Wrong Door' },
    hint: {
      he: 'שני שקרים. היציאה במפה נראית חסומה… אבל האם היא בכלל שם?',
      en: 'Two lies. The exit on the map looks walled off… but is it even there?',
    },
    rows: [
      '#############',
      '#S....#....X#',
      '#.###.#.###.#',
      '#.#...#...#.#',
      '#.#.#####.#.#',
      '#.#...P.....#',
      '#.###.#####.#',
      '#....e#....T#',
      '#############',
    ],
  },
  {
    name: { he: 'המפה מתעצבנת', en: 'The Map Gets Angry' },
    hint: {
      he: 'מכאן המפה עצבנית: כשאתה מתקרב לשקר שלא נתפס, המסגרת שלה מאדימה ומרצדת. היזהר מאוצרות שנראים טוב מדי.',
      en: 'From now on the map gets nervous: near an uncaught lie its frame turns red and glitches. Beware of treasure that looks too good.',
    },
    angryMap: true,
    rows: [
      '#############',
      '#S..#.....#.#',
      '#.#.#.###.#.#',
      '#.#...#B#...#',
      '#.#####.###.#',
      '#...I.....#.#',
      '###.#####.#.#',
      '#T..#...#...#',
      '#.###.#.#.#.#',
      '#.....#...#E#',
      '#############',
    ],
  },
]

export const CAMPAIGN_LENGTH = CAMPAIGN_SPECS.length

export function getCampaignLevel(n: number): Level {
  return parseAsciiLevel(CAMPAIGN_SPECS[n - 1], n)
}
