import { BIOME_IDS, ITEM_IDS, QUEST_SLOTS, type ActiveQuest, type CreationSlot, type ReadingLevel, type WorldPlayerSave } from '../core/types';
import { WORLD_SAVE } from '../config';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import { index } from '../../workshop/logic/catalogIndex';
import { READING_LEVELS, WORKSHOP_IDS, type PlayerSave, type WorkshopId } from '../../workshop/core/types';

const KEY = 'world.players.v1';
const WORKSHOP_KEY = 'workshop.players.v1';
const memory = new Map<string, string>();
const READINGS = new Set(READING_LEVELS);
const WORKSHOPS = new Set(WORKSHOP_IDS);
const BIOMES = new Set<unknown>(BIOME_IDS);
const ITEMS = new Set<unknown>(ITEM_IDS);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function readJson(key: string): unknown {
  let raw: string | null = null;
  try { raw = globalThis.localStorage?.getItem(key) ?? null; } catch { /* memory fallback */ }
  raw ??= memory.get(key) ?? null;
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { globalThis.localStorage?.setItem(key, raw); } catch { /* memory fallback */ }
}

export function loadWorkshopPlayer(profileId: string): PlayerSave | undefined {
  const all = readJson(WORKSHOP_KEY);
  const player = all && object(all) ? all[profileId] : undefined;
  if (!object(player) || player.version !== 2 || !object(player.workshops)) return undefined;
  return player as unknown as PlayerSave;
}

function validSlot(raw: unknown): CreationSlot | undefined {
  if (!object(raw) || !WORKSHOPS.has(raw.workshop as WorkshopId)) return undefined;
  const workshop = raw.workshop as WorkshopId;
  if (raw.source === 'live') return { source: 'live', workshop };
  if (raw.source === 'copy' && object(raw.model)) {
    return { source: 'copy', workshop, model: normalizeWorkshopModel(workshop, raw.model) };
  }
  return undefined;
}

export function normalizeWorkshopModel(workshop: WorkshopId, raw: unknown) {
  const catalog = CATALOGS[workshop];
  const ix = index(catalog);
  const model = defaultModel(catalog);
  if (object(raw)) for (const aspect of ix.aspectIds) {
    const variant = raw[aspect];
    if (typeof variant === 'string' && ix.variantById.get(variant)?.aspect === aspect) model[aspect] = variant;
  }
  return model;
}

function validQuest(raw: unknown): raw is ActiveQuest {
  if (!object(raw) || typeof raw.carrying !== 'boolean' || !object(raw.quest)) return false;
  const { id, giverId, giverHex, kind, item, fromBiome, goal, stars, text } = raw.quest;
  return typeof id === 'string' && id.length > 0 && typeof giverId === 'string' && giverId.length > 0
    && object(giverHex) && Number.isSafeInteger(giverHex.q) && Number.isSafeInteger(giverHex.r)
    && (kind === 'fetch' || kind === 'deliver') && ITEMS.has(item)
    && (fromBiome === undefined || BIOMES.has(fromBiome))
    && object(goal) && (goal.kind === 'giver' || goal.kind === 'home' || (goal.kind === 'biome' && BIOMES.has(goal.biome)))
    && typeof stars === 'number' && Number.isSafeInteger(stars) && stars > 0
    && object(text) && READING_LEVELS.every(level => typeof text[level] === 'string');
}

export function normalizePlayerSave(raw: unknown, lastWorkshop: WorkshopId = 'race'): WorldPlayerSave {
  const from = object(raw) ? raw : {};
  const primary = validSlot(from.primary) ?? { source: 'live', workshop: lastWorkshop } as const;
  const other: WorkshopId = lastWorkshop === 'race' ? 'dino' : 'race';
  const alternate = from.alternate === null ? null : validSlot(from.alternate) ?? { source: 'live', workshop: other } as const;
  const using = from.using === 'alternate' && alternate ? 'alternate' : 'primary';
  const claimed = Array.isArray(from.claimed)
    ? from.claimed.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(-WORLD_SAVE.claimedLimit) : [];
  const quests = Array.isArray(from.quests) ? from.quests.filter(validQuest).slice(0, QUEST_SLOTS.hard) : [];
  const questSeq: Record<string, number> = Object.create(null) as Record<string, number>;
  if (object(from.questSeq)) for (const [id, n] of Object.entries(from.questSeq)) {
    if (!['__proto__', 'constructor', 'prototype'].includes(id) && Number.isSafeInteger(n) && (n as number) >= 0) questSeq[id] = n as number;
  }
  const lastRaw = from.last;
  const last = object(lastRaw) && Number.isFinite(lastRaw.x) && Number.isFinite(lastRaw.y) && Number.isFinite(lastRaw.angle)
    ? { x: lastRaw.x as number, y: lastRaw.y as number, angle: lastRaw.angle as number } : undefined;
  return { version: 1, stars: Number.isSafeInteger(from.stars) && (from.stars as number) >= 0 ? from.stars as number : 0,
    primary, alternate, using, claimed, quests, questSeq, ...(last ? { last } : {}) };
}

function allSaves(): Record<string, unknown> {
  const parsed = readJson(KEY);
  return object(parsed) ? parsed : {};
}

export function loadPlayerSave(profileId: string): WorldPlayerSave {
  const all = allSaves();
  const workshop = loadWorkshopPlayer(profileId);
  const lastWorkshop = workshop?.lastWorkshop && WORKSHOPS.has(workshop.lastWorkshop) ? workshop.lastWorkshop : 'race';
  const save = normalizePlayerSave(all[profileId], lastWorkshop);
  if (JSON.stringify(all[profileId]) !== JSON.stringify(save)) writeJson(KEY, { ...all, [profileId]: save });
  return save;
}

export function savePlayerSave(profileId: string, save: WorldPlayerSave): WorldPlayerSave {
  const normalized = normalizePlayerSave(save);
  writeJson(KEY, { ...allSaves(), [profileId]: normalized });
  return normalized;
}

export function readingOf(profileId: string): ReadingLevel {
  const reading = loadWorkshopPlayer(profileId)?.reading;
  return reading && READINGS.has(reading) ? reading : WORLD_SAVE.defaultReading;
}

export function addStars(profileId: string, amount: number): WorldPlayerSave {
  const save = loadPlayerSave(profileId);
  if (!Number.isSafeInteger(amount) || amount <= 0) return save;
  return savePlayerSave(profileId, { ...save, stars: Math.min(Number.MAX_SAFE_INTEGER, save.stars + amount) });
}

export function claim(profileId: string, id: string, stars: number): WorldPlayerSave {
  const save = loadPlayerSave(profileId);
  if (!id || save.claimed.includes(id)) return save;
  return savePlayerSave(profileId, { ...save, claimed: [...save.claimed, id].slice(-WORLD_SAVE.claimedLimit),
    stars: Number.isSafeInteger(stars) && stars > 0 ? Math.min(Number.MAX_SAFE_INTEGER, save.stars + stars) : save.stars });
}

