// Alliances (spec §7; research §6, battle-flow §7 item 7): a skirmish is a free-for-all — every house fights
// alone — while a campaign mission allies every computer house with every other against the player, as the
// original did. world.teams maps a house to its side (null: nobody is allied); this one predicate is asked
// wherever a house picks a foe or a target, so allies never shoot, crush, gas, capture or hunt each other.

/** Sides that fight together: setAlliances(world, [['harkonnen', 'sardaukar']]). A house in no list fights alone. */
export function setAlliances(world, teams) {
  world.teams = null;
  teams.forEach((list, k) => {
    if (list.length < 2) return;
    world.teams ??= {};
    for (const id of list) world.teams[id] = k + 1;
  });
  return world.teams;
}

/** The same house, or houses on one side. */
export function friendly(world, a, b) {
  if (a === b) return true;
  const t = world.teams;
  return !!t && t[a] !== undefined && t[a] === t[b];
}

export const hostile = (world, a, b) => !friendly(world, a, b);
