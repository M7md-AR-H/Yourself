import type { Command } from './commands';

/** The starter chart. Pillars + sleep block come straight from the Mandala method example. */
export const STARTER_GOAL = 'My best self';

export const STARTER: { pillar: string; actions: string[] }[] = [
  { pillar: 'Sleep', actions: ['Dark room', 'Red color filter', 'Cold room', 'Same wake-up', 'No late coffee', 'Read in bed', '8 hours', 'No late meals'] },
  { pillar: 'Mind', actions: ['Meditate 10 min', 'Journal', 'No phone first hour', 'Gratitude list', 'Walk outside', 'Therapy / talk it out', 'Breathwork', 'Digital sunset'] },
  { pillar: 'Skin', actions: ['SPF every day', 'Cleanse at night', 'Moisturise', 'Drink 2 L water', 'Change pillowcase', 'No touching face', 'Retinol 3× a week', 'Remove makeup'] },
  { pillar: 'Money', actions: ['Track spending', 'Save 20%', 'No impulse buys', 'Weekly budget check', 'Invest monthly', 'Pay off debt', 'Cook, don’t order', 'Learn one money skill'] },
  { pillar: 'Movement', actions: ['10k steps', 'Strength 3× a week', 'Stretch', 'Take the stairs', 'Run', 'Yoga', 'Stand every hour', 'Sport with friends'] },
  { pillar: 'Food', actions: ['Protein each meal', 'Veg with every meal', 'No sugary drinks', 'Meal prep Sunday', 'Eat slowly', 'Fruit daily', 'Less ultra-processed', 'Home-cooked dinner'] },
  { pillar: 'Hobbies', actions: ['Read 20 pages', 'Play music', 'Draw / create', 'Learn a language', 'Photography', 'Garden', 'See friends', 'Try something new'] },
  { pillar: 'Education', actions: ['Online course', 'Read non-fiction', 'Practise a skill', 'Watch a lecture', 'Take notes', 'Teach someone', 'Build a project', 'Review weekly'] },
];

export function starterCommands(goal = STARTER_GOAL): Command[] {
  const out: Command[] = [{ type: 'set_goal', title: goal }];
  STARTER.forEach((b, i) => {
    out.push({ type: 'set_pillar', pillar: i + 1, title: b.pillar });
    b.actions.forEach((a, j) => out.push({ type: 'set_action', pillar: i + 1, slot: j + 1, title: a }));
  });
  return out;
}
