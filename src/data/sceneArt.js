// PLAYTEST_006 PT006-12 — the card-art library for events, quests, encounters and gyms (art direction:
// pastel, simplified, `071_080`; vertical 3 : 4; no text, frames or UI; no Ash / Gary / Brock / Misty;
// Team Rocket = Jessie, James, Meowth). Pictures come ONLY from the Studio's „Ilustracje kart”
// (tools/scene-art.html): split from Piotr's 5 × 2 sheets, cropped, named, bound BY HAND to one quest / event /
// encounter / gym, and saved („Zapisz w grze”, tools/studio-save.js saveSceneArt) only once Piotr marked
// them approved. EMPTY until then — no generated picture is in the repository.
//   SCENE_ART            artId → { file, w, h }   (the file in assets/scene-art/)
//   SCENE_ART_<KIND>     content id → artId        (one registry per kind; the Studio writes one line each)
// The game never depends on a picture: sceneArtFor() → null means the card as today (the fallback), and a
// picture that fails to load removes itself (main.js).
export const SCENE_ART_DIR = 'assets/scene-art';

export const SCENE_ART = {
  'evt-berry-bush': { file: 'evt-berry-bush.png', w: 600, h: 800 },
  'evt-dropped-coins': { file: 'evt-dropped-coins.png', w: 600, h: 800 },
  'evt-found-pokeball': { file: 'evt-found-pokeball.png', w: 600, h: 800 },
  'evt-found-pokeball-v2': { file: 'evt-found-pokeball-v2.png', w: 600, h: 800 },
  'evt-friendly-hiker': { file: 'evt-friendly-hiker.png', w: 600, h: 800 },
  'evt-hidden-stash': { file: 'evt-hidden-stash.png', w: 600, h: 800 },
  'evt-local-rumour': { file: 'evt-local-rumour.png', w: 600, h: 800 },
  'evt-lost-backpack': { file: 'evt-lost-backpack.png', w: 600, h: 800 },
  'evt-lost-pokemon': { file: 'evt-lost-pokemon.png', w: 600, h: 800 },
  'evt-lost-trainer': { file: 'evt-lost-trainer.png', w: 600, h: 800 },
  'evt-nurse-joy': { file: 'evt-nurse-joy.png', w: 600, h: 800 },
  'evt-nurse-joy-v2': { file: 'evt-nurse-joy-v2.png', w: 600, h: 800 },
  'evt-old-man-deal': { file: 'evt-old-man-deal.png', w: 600, h: 800 },
  'evt-old-man-deal-v2': { file: 'evt-old-man-deal-v2.png', w: 600, h: 800 },
  'evt-road-bully': { file: 'evt-road-bully.png', w: 600, h: 800 },
  'evt-rustling-grass': { file: 'evt-rustling-grass.png', w: 600, h: 800 },
  'evt-shortcut': { file: 'evt-shortcut.png', w: 600, h: 800 },
  'evt-strange-tracks': { file: 'evt-strange-tracks.png', w: 600, h: 800 },
  'evt-sudden-rain': { file: 'evt-sudden-rain.png', w: 600, h: 800 },
  'm-bill-cottage': { file: 'm-bill-cottage.png', w: 600, h: 800 },
  'm-bill-cottage-v2': { file: 'm-bill-cottage-v2.png', w: 600, h: 800 },
  'm-bill-cottage-v3': { file: 'm-bill-cottage-v3.png', w: 600, h: 800 },
  'm-bug-catcher': { file: 'm-bug-catcher.png', w: 600, h: 800 },
  'm-collector-mtmoon': { file: 'm-collector-mtmoon.png', w: 600, h: 800 },
  'm-fuji-lavender': { file: 'm-fuji-lavender.png', w: 600, h: 800 },
  'm-hiker-cave': { file: 'm-hiker-cave.png', w: 600, h: 800 },
  'm-jenny-patrol': { file: 'm-jenny-patrol.png', w: 600, h: 800 },
  'm-jenny-patrol-v2': { file: 'm-jenny-patrol-v2.png', w: 600, h: 800 },
  'm-jenny-trainer': { file: 'm-jenny-trainer.png', w: 600, h: 800 },
  'm-joy-evolve': { file: 'm-joy-evolve.png', w: 600, h: 800 },
  'm-joy-flawless': { file: 'm-joy-flawless.png', w: 600, h: 800 },
  'm-oak-field': { file: 'm-oak-field.png', w: 600, h: 800 },
  'm-oak-flying': { file: 'm-oak-flying.png', w: 600, h: 800 },
  'm-oak-rare': { file: 'm-oak-rare.png', w: 600, h: 800 },
  'm-oak-two': { file: 'm-oak-two.png', w: 600, h: 800 },
  'm-oak-water': { file: 'm-oak-water.png', w: 600, h: 800 },
  'm-ranger-forest': { file: 'm-ranger-forest.png', w: 600, h: 800 },
  'm-scout-victory': { file: 'm-scout-victory.png', w: 600, h: 800 },
  'm-swimmer-sea': { file: 'm-swimmer-sea.png', w: 600, h: 800 },
  'm-warden-safari': { file: 'm-warden-safari.png', w: 600, h: 800 },
  'q-bill-teleporter': { file: 'q-bill-teleporter.png', w: 600, h: 800 },
  'q-bill-teleporter-v2': { file: 'q-bill-teleporter-v2.png', w: 600, h: 800 },
  'q-celadon-evolution': { file: 'q-celadon-evolution.png', w: 600, h: 800 },
  'q-celadon-rocket': { file: 'q-celadon-rocket.png', w: 600, h: 800 },
  'q-lavender-fog': { file: 'q-lavender-fog.png', w: 600, h: 800 },
  'q-mt-moon-fossil': { file: 'q-mt-moon-fossil.png', w: 600, h: 800 },
  'q-nugget-bridge': { file: 'q-nugget-bridge.png', w: 600, h: 800 },
  'q-oak-field-research': { file: 'q-oak-field-research.png', w: 600, h: 800 },
  'q-oak-habitats': { file: 'q-oak-habitats.png', w: 600, h: 800 },
  'q-oak-habitats-v2': { file: 'q-oak-habitats-v2.png', w: 600, h: 800 },
  'q-oak-parcel': { file: 'q-oak-parcel.png', w: 600, h: 800 },
  'q-oak-parcel-v2': { file: 'q-oak-parcel-v2.png', w: 600, h: 800 },
  'q-oak-rocket': { file: 'q-oak-rocket.png', w: 600, h: 800 },
  'q-oak-water': { file: 'q-oak-water.png', w: 600, h: 800 },
  'q-power-plant-fault': { file: 'q-power-plant-fault.png', w: 600, h: 800 },
  'q-safari-scyther': { file: 'q-safari-scyther.png', w: 600, h: 800 },
  'q-safari-scyther-v2': { file: 'q-safari-scyther-v2.png', w: 600, h: 800 },
  'q-sailor-water-show': { file: 'q-sailor-water-show.png', w: 600, h: 800 },
  'q-tower-potions': { file: 'q-tower-potions.png', w: 600, h: 800 },
  'q-vermilion-courier': { file: 'q-vermilion-courier.png', w: 600, h: 800 },
  'q-vermilion-spark': { file: 'q-vermilion-spark.png', w: 600, h: 800 },
  'q-viridian-parcel': { file: 'q-viridian-parcel.png', w: 600, h: 800 },
};

export const SCENE_ART_QUEST = {
  'bill-teleporter': 'q-bill-teleporter-v2',
  'celadon-evolution': 'q-celadon-evolution',
  'celadon-rocket': 'q-celadon-rocket',
  'lavender-fog': 'q-lavender-fog',
  'mt-moon-fossil': 'q-mt-moon-fossil',
  'nugget-bridge': 'q-nugget-bridge',
  'oak-field-research': 'q-oak-field-research',
  'oak-habitats': 'q-oak-habitats-v2',
  'oak-parcel': 'q-oak-parcel-v2',
  'oak-rocket': 'q-oak-rocket',
  'oak-water': 'q-oak-water',
  'power-plant-fault': 'q-power-plant-fault',
  'safari-scyther': 'q-safari-scyther-v2',
  'sailor-water-show': 'q-sailor-water-show',
  'tower-potions': 'q-tower-potions',
  'vermilion-courier': 'q-vermilion-courier',
  'vermilion-spark': 'q-vermilion-spark',
  'viridian-parcel': 'q-viridian-parcel',
};

export const SCENE_ART_EVENT = {
  'berry-bush': 'evt-berry-bush',
  'dropped-coins': 'evt-dropped-coins',
  'found-pokeball': 'evt-found-pokeball-v2',
  'friendly-hiker': 'evt-friendly-hiker',
  'hidden-stash': 'evt-hidden-stash',
  'local-rumour': 'evt-local-rumour',
  'lost-backpack': 'evt-lost-backpack',
  'lost-pokemon': 'evt-lost-pokemon',
  'lost-trainer': 'evt-lost-trainer',
  'nurse-joy': 'evt-nurse-joy-v2',
  'old-man-deal': 'evt-old-man-deal-v2',
  'road-bully': 'evt-road-bully',
  'rustling-grass': 'evt-rustling-grass',
  'shortcut': 'evt-shortcut',
  'strange-tracks': 'evt-strange-tracks',
  'sudden-rain': 'evt-sudden-rain',
};

export const SCENE_ART_ENCOUNTER = {
};

export const SCENE_ART_GYM = {
};

// PLAYTEST_008 (Piotr 15.10): the deck's mission cards — their own kind (a card's id can be a book quest's id too: 'oak-water')
export const SCENE_ART_MISSION = {
  'bill-cottage': 'm-bill-cottage-v3',
  'bug-catcher': 'm-bug-catcher',
  'collector-mtmoon': 'm-collector-mtmoon',
  'fuji-lavender': 'm-fuji-lavender',
  'hiker-cave': 'm-hiker-cave',
  'jenny-patrol': 'm-jenny-patrol-v2',
  'jenny-trainer': 'm-jenny-trainer',
  'joy-evolve': 'm-joy-evolve',
  'joy-flawless': 'm-joy-flawless',
  'oak-field': 'm-oak-field',
  'oak-flying': 'm-oak-flying',
  'oak-rare': 'm-oak-rare',
  'oak-two': 'm-oak-two',
  'oak-water': 'm-oak-water',
  'ranger-forest': 'm-ranger-forest',
  'scout-victory': 'm-scout-victory',
  'swimmer-sea': 'm-swimmer-sea',
  'warden-safari': 'm-warden-safari',
};

export const SCENE_ART_BINDINGS = { quest: SCENE_ART_QUEST, event: SCENE_ART_EVENT, encounter: SCENE_ART_ENCOUNTER, gym: SCENE_ART_GYM, mission: SCENE_ART_MISSION };

// The picture bound to a quest / event / encounter / gym / mission card, or null (no picture: the card as today).
export function sceneArtFor(kind, id) {
  const artId = SCENE_ART_BINDINGS[kind]?.[id];
  const art = artId ? SCENE_ART[artId] : null;
  return art ? { artId, url: `${SCENE_ART_DIR}/${art.file}`, w: art.w, h: art.h } : null;
}
