/** Admin Mode sandbox: every variant open, `count` challenges spread over all tiers. Never mutates its input. */
import { WS_RULES } from '../config';
import type { Challenge, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { sanitizeModel } from './available';
import { copyProgress, refreshBoard } from './board';
import { challengeKey, generateChallenge } from './generator';
import { hashSeed } from './util';

export function adminSandbox(cat: WorkshopCatalog, p0: WorkshopProgress, seed: number, count: number): WorkshopProgress {
  const p = copyProgress(p0);
  p.overrides = Object.fromEntries(cat.variants.map((v) => [v.id, 'open' as const]));
  p.model = sanitizeModel(cat, p, p.model);
  const avail = new Set(cat.variants.map((v) => v.id));
  const usedKeys = new Set<string>();
  const avoid = new Set<string>();
  const challenges: Record<string, Challenge> = {};
  const active: string[] = [];
  for (let i = 0; i < count; i++) {
    const wantTier = Math.min(WS_RULES.maxTier, Math.floor((i * (WS_RULES.maxTier + 1)) / count));
    for (let tier = wantTier; tier >= 0; tier--) {
      const id = `admin-${seed}-${i}`;
      const gen = generateChallenge(cat, id, 'admin', hashSeed(`${cat.id}:admin:${seed}:${i}:${tier}`), {
        tier, avail, current: p.model, lastWin: null, minChanged: 0, newest: null, usedKeys, avoidScenarios: avoid,
        attempts: WS_RULES.genAttempts, strictCurrent: false,
      });
      if (!gen) continue;
      gen.challenge.source = 'admin';
      challenges[id] = gen.challenge;
      active.push(id);
      usedKeys.add(challengeKey(gen.challenge));
      avoid.add(gen.challenge.stages[0].scenario);
      break;
    }
  }
  p.challenges = challenges;
  p.active = active;
  p.completed = {};
  p.fails = {};
  return p;
}

export function grantCurrency(cat: WorkshopCatalog, progress: WorkshopProgress): WorkshopProgress {
  return refreshBoard(cat, { ...progress, wallet: progress.wallet + WS_RULES.adminCurrencyGrant });
}
