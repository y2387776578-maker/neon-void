// Level-up upgrades for NEON VOID.
// Eight upgrades, each with a level cap and a plain description. When the
// player levels up, the game offers three cards drawn from the upgrades
// that still have room; picking one applies it at once. The card data
// here is also what the level-up screen draws, so the text in the game
// and the text in this file can never drift apart.
export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    desc: '+18% fire rate',
    color: '#ffe14d',
    maxLevel: 5,
    apply: (player) => {
      player.fireRate *= 1.18;
    },
  },
  {
    id: 'heavy',
    name: 'HEAVY ROUNDS',
    desc: '+25% bullet damage',
    color: '#ff5d5d',
    maxLevel: 5,
    apply: (player) => {
      player.damage *= 1.25;
    },
  },
  {
    id: 'split',
    name: 'SPLIT SHOT',
    desc: '+1 projectile per shot',
    color: '#8ef6ff',
    maxLevel: 3,
    apply: (player) => {
      player.multishot += 1;
    },
  },
  {
    id: 'swift',
    name: 'SWIFT HULL',
    desc: '+12% move speed',
    color: '#7dff9e',
    maxLevel: 4,
    apply: (player) => {
      player.speed *= 1.12;
    },
  },
  {
    id: 'hull',
    name: 'REINFORCED HULL',
    desc: '+25 max HP, heal 25',
    color: '#ff9de2',
    maxLevel: 4,
    apply: (player) => {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'pierce',
    name: 'PIERCE ROUNDS',
    desc: 'Bullets pass through +1 enemy',
    color: '#c9a7ff',
    maxLevel: 3,
    apply: (player) => {
      player.pierce += 1;
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET CORE',
    desc: '+60% gem pickup radius',
    color: '#4dd7ff',
    maxLevel: 4,
    apply: (player) => {
      player.magnet *= 1.6;
    },
  },
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    desc: '+15% bullet speed, +10% fire rate',
    color: '#ffb347',
    maxLevel: 3,
    apply: (player) => {
      player.bulletSpeed *= 1.15;
      player.fireRate *= 1.1;
    },
  },
];

export function xpNeededFor(level) {
  return 5 + level * 4;
}

export function drawUpgradeChoices(rng, ownedLevels) {
  const available = UPGRADE_POOL.filter((item) => (ownedLevels[item.id] || 0) < item.maxLevel);
  const shuffled = available.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, 3).map((item) => ({
    ...item,
    level: (ownedLevels[item.id] || 0) + 1,
  }));
}
