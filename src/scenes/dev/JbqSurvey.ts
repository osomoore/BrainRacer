/**
 * Dev survey: lays out the JBQ panel for EVERY question (with generated wrong answers) at 1, 2 and 4 players
 * and records the chosen font sizes and any cut text. Results land on `window.__jbqSurvey` (read by a script).
 * `?dev=JbqSurvey&n=2&id=409` shows one panel instead (for screenshots).
 */
import Phaser from 'phaser';
import { playerViewsFor } from '../../camera/cameraMath';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import type { AnswerSlot, Challenge, ChallengeOption, PlayerId } from '../../core/types';
import { JBQ_QUESTIONS, JbqGenerator, type JbqQuestion } from '../../challenge/jbqGenerator';
import { ChallengePanel } from '../../ui/hud/ChallengePanel';

const optionOf = (q: JbqQuestion): ChallengeOption =>
  q.ref !== undefined && q.verse !== undefined ? { kind: 'verse', ref: q.ref, text: q.verse } : { kind: 'text', text: q.a };

export default class JbqSurvey extends Phaser.Scene {
  constructor() { super('JbqSurvey'); }

  private challengeFor(q: JbqQuestion, gen: JbqGenerator, player: PlayerId): Challenge {
    const wrong = (gen as unknown as { pickWrong(q: JbqQuestion, n: number): JbqQuestion[] }).pickWrong(q, 3);
    const correct = (q.id % 4) as AnswerSlot;
    const rest = [...wrong];
    const options = [0, 1, 2, 3].map((i) => optionOf(i === correct ? q : rest.shift()!));
    return { id: q.id, player, kind: 'jbq', prompt: { kind: 'text', text: q.q }, options, correct, durationSec: 5, source: 'random', jbq: { id: q.id, points: q.points } };
  }

  private panel(c: Challenge, n: number, p: number): ChallengePanel {
    const view = playerViewsFor(n, GAME_WIDTH, GAME_HEIGHT)[p];
    return new ChallengePanel(this, PLAYER_COLORS[p], c, view, {
      onCorrect: () => {}, depth: 10, centered: true, controllerDevice: { type: 'gamepad', index: 0 },
      ...(n >= 3 ? { innerInset: 240 } : {}),
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#1b2430');
    const qs = new URLSearchParams(location.search);
    const gen = new JbqGenerator(new Rng(11));
    const one = Number(qs.get('id'));
    if (one) {
      const n = Number(qs.get('n')) || 2;
      const q = JBQ_QUESTIONS.find((x) => x.id === one)!;
      for (let p = 0; p < n; p++) {
        const pq = p === 0 ? q : JBQ_QUESTIONS[(JBQ_QUESTIONS.indexOf(q) + p * 7) % JBQ_QUESTIONS.length];
        const pan = this.panel(this.challengeFor(pq, gen, p as PlayerId), n, p);
        this.events.on('update', (_t: number, dt: number) => (pan as unknown as { update(dt: number): void }).update?.(dt / 1000));
      }
      return;
    }
    // Survey every question at each player count, a batch per frame (progress in window.__jbqSurveyDone).
    const jobs = [1, 2, 4].flatMap((n) => JBQ_QUESTIONS.map((q) => ({ n, q })));
    const rows: unknown[] = [];
    const w = window as unknown as { __jbqSurvey?: unknown; __jbqSurveyDone?: number };
    const step = () => {
      for (let k = 0; k < 24 && rows.length < jobs.length; k++) {
        const { n, q } = jobs[rows.length];
        const pan = this.panel(this.challengeFor(q, gen, 0), n, 0);
        const plan = (pan as unknown as { jbq?: { plan: { fa: number; fq: number; ok: boolean; truncate: boolean[] } } }).jbq?.plan;
        rows.push({ n, id: q.id, points: q.points, type: q.type, fa: plan?.fa, fq: plan?.fq, ok: plan?.ok, cut: plan?.truncate.filter(Boolean).length ?? 0 });
        pan.destroy();
      }
      w.__jbqSurveyDone = rows.length;
      if (rows.length < jobs.length) this.time.delayedCall(0, step); else w.__jbqSurvey = rows;
    };
    this.time.delayedCall(300, step);
  }
}
