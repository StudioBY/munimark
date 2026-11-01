// Pages whose term data is still open (decided 2026-11-01): the page says so,
// and the same list is in the status doc's to-do. Remove an entry when its
// case is resolved. Keyed by authority slug and by person slug.

export const AUTHORITY_REVIEW: Record<string, string> = {
  harish: "ראש העיר יצחק קשת הושעה באוגוסט 2025, ויוחאי פרג'י משמש ממלא מקום. אופן ההצגה בבדיקה.",
  nazareth: 'מיוני 2025 העירייה מנוהלת בידי ועדה קרואה. נתוני הכהונה בבדיקה.',
  yoav: 'שיוך שנת 2022 בבדיקה: מועד סיום הכהונה של מטי צרפתי הרכבי.',
}

export const PERSON_REVIEW: Record<string, string> = {
  'yitzhak-keshet': "הושעה מתפקידו באוגוסט 2025; יוחאי פרג'י משמש ממלא מקום. אופן ההצגה בבדיקה.",
  'ali-salam': 'הודח ביוני 2025 ומאז העירייה מנוהלת בידי ועדה קרואה. נתוני הכהונה בבדיקה.',
}
