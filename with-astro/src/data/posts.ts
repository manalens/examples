export interface Post { slug: string; title: string; date: string; body: string }

export const posts: Post[] = [
  { slug: 'first-light', title: 'Devlog 1: First light', date: '2026-10-02', body: 'The lighthouse keeper can now walk the harbor at night. The lamp turns, and the boats follow it home.' },
  { slug: 'the-storm', title: 'Devlog 2: The storm', date: '2026-10-16', body: 'A storm level with rain, wind and a lamp that goes out. Keep the boats off the rocks until dawn.' },
];
