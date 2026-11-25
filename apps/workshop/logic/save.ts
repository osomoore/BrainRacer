/** Save creation, validation and repair. Input is untrusted (localStorage JSON); nothing is mutated. */
import { CHALLENGE_RULES_VERSION, WS_RULES } from '../config';
import type {
  Challenge, ChallengeId, CompletedInfo, Model, PlayerSave, ReadingLevel, VariantId, VariantOverride, WorkshopCatalog,
  WorkshopId, WorkshopProgress,
} from '../core/types';
import { READING_LEVELS, WORKSHOP_IDS } from '../core/types';
import { easyFlag } from './aspects';
import { index } from './catalogIndex';
import { sanitizeModel } from './available';
import { affordability } from './affordability';
import { copyProgress, newProgress, refreshBoard, sortBoard } from './board';
import { normalizeBuddies } from './buddies';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function newPlayerSave(reading: ReadingLevel, buddySeed?: number): PlayerSave {
  return buddySeed === undefined ? { version: 2, reading, workshops: {} } : { version: 2, reading, workshops: {}, buddySeed };
}

function repairModel(cat: WorkshopCatalog, raw: unknown, fallback: Model): Model {
  const ix = index(cat);
  const out: Model = {};
  for (const a of cat.aspects) {
    const v = isObj(raw) ? raw[a.id] : undefined;
    out[a.id] = typeof v === 'string' && ix.variantById.get(v)?.aspect === a.id ? v : fallback[a.id];
  }
  return out;
}

function validBasicCheck(value: unknown): boolean {
  if (!isObj(value)) return false;
  switch (value.kind) {
    case 'statMin': return typeof value.stat === 'string' && isNum(value.min);
    case 'statMax': return typeof value.stat === 'string' && isNum(value.max);
    case 'tag':
    case 'noTag': return typeof value.tag === 'string';
    default: return false;
  }
}

function validCheck(value: unknown): boolean {
  if (!isObj(value) || value.kind !== 'anyOf') return validBasicCheck(value);
  return Array.isArray(value.options) && value.options.length >= 2
    && value.options.every((option) => Array.isArray(option) && option.length > 0 && option.every(validBasicCheck));
}

function validChallenge(c: unknown, id: string, workshop: WorkshopId): c is Challenge {
  if (!isObj(c) || c.id !== id || c.workshop !== workshop || !Array.isArray(c.stages) || c.stages.length === 0) return false;
  if (!isObj(c.intro) || typeof c.title !== 'string') return false;
  return (c.stages as unknown[]).every((s) => isObj(s) && typeof s.scenario === 'string' && Array.isArray(s.requirements) && s.requirements.length > 0
    && (s.requirements as unknown[]).every((r) => isObj(r) && typeof r.id === 'string' && Array.isArray(r.checks) && r.checks.length > 0 && r.checks.every(validCheck) && isObj(r.text) && isObj(r.hint)));
}

export function normalizeProgress(cat: WorkshopCatalog, raw: unknown, reading?: ReadingLevel): WorkshopProgress | null {
  if (!isObj(raw)) return null;
  const ix = index(cat);
  const base = newProgress(cat, undefined, reading);
  const freeStarters = new Set(Object.values(base.model));
  const out: WorkshopProgress = { ...base, buddies: normalizeBuddies(raw.buddies) };
  out.model = repairModel(cat, raw.model, base.model);
  out.bought = Array.isArray(raw.bought)
    ? [...new Set((raw.bought as unknown[]).filter((v): v is VariantId => typeof v === 'string' && ix.variantById.has(v) && !freeStarters.has(v)))]
    : [];
  out.wallet = isNum(raw.wallet) ? Math.max(0, Math.floor(raw.wallet)) : WS_RULES.startWallet;
  if (isObj(raw.overrides)) {
    for (const [k, v] of Object.entries(raw.overrides)) {
      if (ix.variantById.has(k) && (v === 'open' || v === 'locked')) out.overrides[k] = v as VariantOverride;
    }
  }
  if (isObj(raw.challenges)) {
    for (const [k, v] of Object.entries(raw.challenges)) {
      if (!validChallenge(v, k, cat.id)) continue;
      const challenge = JSON.parse(JSON.stringify(v)) as Challenge;
      const color = challenge.boardColor;
      if (typeof color !== 'number' || !Number.isInteger(color) || color < 0 || color >= WS_RULES.boardSize) {
        delete challenge.boardColor;
      }
      out.challenges[k] = challenge;
    }
  }
  if (isObj(raw.completed)) {
    for (const [k, v] of Object.entries(raw.completed)) {
      if (!isObj(v) || !out.challenges[k]) continue;
      const info: CompletedInfo = {
        build: repairModel(cat, v.build, out.model),
        wonAt: isNum(v.wonAt) ? v.wonAt : 0,
        payout: isNum(v.payout) ? Math.max(0, Math.floor(v.payout)) : 0,
      };
      out.completed[k] = info;
    }
  }
  if (Array.isArray(raw.active)) {
    out.active = [...new Set((raw.active as unknown[]).filter((id): id is ChallengeId => typeof id === 'string' && !!out.challenges[id]))].slice(0, WS_RULES.boardSize);
  }
  if (isObj(raw.fails)) {
    for (const [k, v] of Object.entries(raw.fails)) if (out.challenges[k] && isNum(v) && v > 0) out.fails[k] = Math.floor(v);
  }
  out.failHints = {};
  if (isObj(raw.failHints)) {
    for (const [k, v] of Object.entries(raw.failHints)) {
      if (!out.challenges[k] || out.completed[k] || !Array.isArray(v)) continue;
      const notes = (v as unknown[]).flatMap((n) => isObj(n) && typeof n.req === 'string' && Array.isArray(n.parts)
        && n.parts.length > 0 && n.parts.every((id) => typeof id === 'string' && ix.variantById.has(id))
        ? [{ req: n.req, parts: [...n.parts as string[]] }] : []).slice(0, WS_RULES.failLinesMax);
      if (notes.length) out.failHints[k] = notes;
    }
  }
  // Existing builds are historical records; only the current editable model is
  // constrained to today's availability.
  out.model = sanitizeModel(cat, out, out.model);
  out.lastWin = isObj(raw.lastWin) ? repairModel(cat, raw.lastWin, out.model) : null;
  out.nextStarter = isNum(raw.nextStarter) ? Math.min(cat.starters.length, Math.max(0, Math.floor(raw.nextStarter))) : 0;
  out.firstWins = Object.keys(out.completed).length;
  // genSeq must exceed every generated id in the save so ids are never reused
  let seq = isNum(raw.genSeq) ? Math.max(1, Math.floor(raw.genSeq)) : 1;
  for (const id of Object.keys(out.challenges)) {
    const m = /-g(\d+)$/.exec(id);
    if (m) seq = Math.max(seq, Number(m[1]) + 1);
  }
  out.genSeq = seq;
  sortBoard(out, affordability(cat, out));
  // Rules changed (or the number of aspects in play changed) since this workshop was saved:
  // don't migrate open cards, re-deal them.
  if (raw.rulesVersion !== CHALLENGE_RULES_VERSION || !!raw.easy !== !!easyFlag(reading).easy) return redeal(cat, out);
  return out;
}

/** Throw away the unfinished cards and deal a fresh board from the current rules. Wallet, bought parts and wins stay. */
function redeal(cat: WorkshopCatalog, p: WorkshopProgress): WorkshopProgress {
  const out = copyProgress(p);
  for (const id of Object.keys(out.challenges)) if (!out.completed[id]) delete out.challenges[id];
  out.active = [];
  out.fails = {};
  out.failHints = {};
  out.rulesVersion = CHALLENGE_RULES_VERSION;
  // The build and the last win keep only parts the level can use (hidden aspects fall back to their first starter).
  out.model = sanitizeModel(cat, out, out.model);
  if (out.lastWin) out.lastWin = sanitizeModel(cat, out, out.lastWin);
  return refreshBoard(cat, out);
}

export function normalizeSave(catalogs: Readonly<Record<WorkshopId, WorkshopCatalog>>, raw: unknown): PlayerSave | null {
  if (!isObj(raw) || raw.version !== 2) return null;
  const reading = (READING_LEVELS as readonly unknown[]).includes(raw.reading) ? (raw.reading as ReadingLevel) : 'easy';
  const save = newPlayerSave(reading, isNum(raw.buddySeed) ? raw.buddySeed : undefined);
  if (isObj(raw.workshops)) {
    for (const id of WORKSHOP_IDS) {
      const p = normalizeProgress(catalogs[id], raw.workshops[id], reading);
      if (p) save.workshops[id] = p;
    }
  }
  if (typeof raw.lastWorkshop === 'string' && (WORKSHOP_IDS as readonly string[]).includes(raw.lastWorkshop)) {
    save.lastWorkshop = raw.lastWorkshop as WorkshopId;
  }
  return save;
}

export function progressOf(cat: WorkshopCatalog, save: PlayerSave): WorkshopProgress {
  const saved = save.workshops[cat.id];
  if (!saved) return refreshBoard(cat, newProgress(cat, save.buddySeed, save.reading));
  // The reading level changed since the cards were dealt: Easy and Medium/Hard use different aspects.
  if (!!saved.easy !== !!easyFlag(save.reading).easy) {
    const { easy: _easy, ...rest } = saved;
    return redeal(cat, { ...rest, ...easyFlag(save.reading) });
  }
  return refreshBoard(cat, saved);
}
