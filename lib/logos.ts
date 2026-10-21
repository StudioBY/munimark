// Authority emblems, served from /public/logos. There is no logo column in the
// database yet, so this map is the source until one exists. Every entry here
// must also be credited on /credits: an emblem belongs to its authority.
export const AUTHORITY_LOGOS: Record<string, { src: string; source: string }> = {
  modiin: { src: '/logos/modiin.jpg', source: 'סמל עיריית מודיעין-מכבים-רעות (נמסר ע"י המשתמש, 2026-10-20)' },
}
