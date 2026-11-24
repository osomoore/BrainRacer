/**
 * Plays ONE Dino Lab test-run stage by itself (builds its own StageContext).
 * `workshop.html?dev=DinoStages[&scenario=snack][&facet=snack.bite,snack.bigGulp][&level=1,2][&pass=1][&split=1][&speed=1]`
 *   scenario  a Dino Lab scenario id (default snack).
 *   facet     comma list of facet ids (full `snack.bite` or short `bite`); default = the scenario's first facet. `all` = every facet.
 *   level     comma list of levels, one per facet (a single number applies to all). Default 1.
 *   pass      1 = every requirement passes (a build found with the engine solver), 0 = the FIRST facet fails
 *             (the others pass when a build exists). Default 1.
 *   split     1 = play in a 960x1080 area (split screen) centred on screen.
 *   build     optional variant override, e.g. build=move.fly,size.big (applied on top of the picked build).
 *   speed     time scale (0.25..4) for slow-motion looks.
 * Keys: Left/Right = scenario, Up/Down = facet, [ ] or 1/2/3 = level, P = pass/fail, S = split, Space = replay.
 * `window.__dinoStage` = { done, pass, label } for scripts.
 */
import Phaser from 'phaser';
import { buildRig } from '../art';
import { createWorkshopAudio, preloadWorkshopAudio } from '../audio';
import { CATALOGS } from '../content';
import { Rng } from '../core/rng';
import type { WorkshopAudio } from '../core/runtime';
import type { ComputedModel, FacetDef, Model, Requirement, Stage, StageResult } from '../core/types';
import { solve } from '../logic/solver';
import { allPass, computeModel, defaultModel } from '../logic/stats';
import type { ScenarioPlayer, StageContext } from '../run/types';

const CAT = CATALOGS.dino;
const SCEN = CAT.scenarios;
const PLAYERS = import.meta.glob<{ default: ScenarioPlayer }>('../run/dino/*.ts', { eager: true });
const player = (id: string): ScenarioPlayer | undefined => Object.values(PLAYERS).map((m) => m.default).find((p) => p?.scenario === id);

const GROUND_Y = 840;
const ALL_OPEN = new Set(CAT.variants.map((v) => v.id));

/** Requirements for the chosen facets/levels. */
export function makeRequirements(facets: FacetDef[], levels: number[]): Requirement[] {
  return facets.map((f, i) => ({
    id: `s0r${i}`, facet: f.id, level: levels[i], checks: f.check(levels[i]),
    text: { easy: '', medium: '', hard: '' }, hint: { aspect: f.hintAspect, text: { easy: '', medium: '', hard: '' } },
  }));
}

const passes = (model: Model, r: Requirement): boolean => allPass(r.checks, computeModel(CAT, model));

/** A build where every requirement passes, or (fail) where the first fails and the others pass if possible. */
export function pickModel(reqs: Requirement[], pass: boolean): Model {
  const base = defaultModel(CAT);
  const checks = (rs: Requirement[]) => rs.flatMap((r) => r.checks);
  if (pass) return solve(CAT, checks(reqs), ALL_OPEN, { ref: base })?.build ?? base;
  const rest = reqs.slice(1);
  const ok = rest.length ? solve(CAT, checks(rest), ALL_OPEN, { ref: base })?.build : base;
  const m = ok ?? base;
  if (!passes(m, reqs[0])) return m;
  // The helper build also passes the first facet: drop back to the plain default if that fails it.
  return !passes(base, reqs[0]) ? base : m;
}

export function evalStage(model: Model, reqs: Requirement[]): { computed: ComputedModel; result: StageResult } {
  const computed = computeModel(CAT, model);
  const bad = reqs.find((r) => !allPass(r.checks, computed));
  return { computed, result: { index: 0, passed: !bad, reached: true, ...(bad ? { firstFail: bad.id } : {}) } };
}

export default class DinoStages extends Phaser.Scene {
  private sc = 0;
  private fi: number[] = [0];
  private levels: number[] = [1];
  private pass = true;
  private split = false;
  private speed = 1;
  private layer: Phaser.GameObjects.Container | null = null;
  private frame: Phaser.GameObjects.Container | null = null;
  private label!: Phaser.GameObjects.Text;
  private audio!: WorkshopAudio;
  private token = 0;
  /** Optional `build=move.fly,size.big` override of the picked build (testing odd combinations). */
  private build: Model = {};

  constructor() { super('DinoStages'); }

  preload(): void { preloadWorkshopAudio(this); }

  create(): void {
    const q = new URLSearchParams(location.search);
    const si = SCEN.findIndex((s) => s.id === q.get('scenario'));
    this.sc = si >= 0 ? si : 0;
    const sc = SCEN[this.sc];
    const fq = (q.get('facet') ?? '').split(',').filter(Boolean);
    this.fi = fq[0] === 'all' ? sc.facets.map((_, i) => i) : fq.map((n) => sc.facets.findIndex((f) => f.id === n || f.id === `${sc.id}.${n}`)).filter((i) => i >= 0);
    if (!this.fi.length) this.fi = [0];
    this.levels = (q.get('level') ?? '1').split(',').map((n) => Math.max(1, Number(n) || 1));
    this.pass = q.get('pass') !== '0';
    this.split = q.get('split') === '1';
    this.speed = Math.max(0.1, Math.min(4, Number(q.get('speed') ?? 1) || 1));
    for (const v of (q.get('build') ?? '').split(',').filter(Boolean)) this.build[v.split('.')[0]] = v;
    this.audio = createWorkshopAudio(this.game);
    this.label = this.add.text(12, 8, '', { fontSize: '22px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 8, y: 4 }, fontFamily: 'monospace' }).setDepth(1000);
    const k = this.input.keyboard!;
    k.on('keydown-RIGHT', () => this.setScenario(1));
    k.on('keydown-LEFT', () => this.setScenario(-1));
    k.on('keydown-UP', () => { this.fi = [(this.fi[0] + 1) % SCEN[this.sc].facets.length]; this.start(); });
    k.on('keydown-DOWN', () => { const n = SCEN[this.sc].facets.length; this.fi = [(this.fi[0] + n - 1) % n]; this.start(); });
    k.on('keydown-OPEN_BRACKET', () => this.bumpLevel(-1));
    k.on('keydown-CLOSED_BRACKET', () => this.bumpLevel(1));
    for (const [key, n] of [['ONE', 1], ['TWO', 2], ['THREE', 3]] as const) k.on(`keydown-${key}`, () => { this.levels = this.fi.map(() => n); this.start(); });
    k.on('keydown-P', () => { this.pass = !this.pass; this.start(); });
    k.on('keydown-S', () => { this.split = !this.split; this.start(); });
    k.on('keydown-SPACE', () => this.start());
    this.start();
  }

  private setScenario(d: number): void {
    this.sc = (this.sc + d + SCEN.length) % SCEN.length;
    this.fi = [0]; this.levels = [1];
    this.start();
  }

  private bumpLevel(d: number): void {
    const f = SCEN[this.sc].facets[this.fi[0]];
    const max = Math.max(...f.levels);
    this.levels = this.fi.map((_, i) => Math.max(1, Math.min(max, (this.levels[i] ?? this.levels[0]) + d)));
    this.start();
  }

  private clear(): void {
    this.token++;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.layer?.destroy(true);
    this.frame?.destroy(true);
    this.layer = null; this.frame = null;
  }

  private start(): void {
    this.clear();
    const my = this.token;
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
    const sc = SCEN[this.sc];
    const facets = this.fi.map((i) => sc.facets[i]);
    const levels = this.fi.map((_, i) => this.levels[i] ?? this.levels[0]);
    const reqs = makeRequirements(facets, levels);
    const model = { ...pickModel(reqs, this.pass), ...this.build };
    const { computed, result } = evalStage(model, reqs);
    const view = facets.every((f) => f.views.includes('side')) ? 'side' : 'top';
    const stage: Stage = { scenario: sc.id, view, params: Object.fromEntries(facets.map((f, i) => [f.id, levels[i]])), requirements: reqs };
    const size = this.split ? { w: 960, h: 1080 } : { w: 1920, h: 1080 };
    const ox = this.split ? 480 : 0;
    const layer = this.add.container(ox, 0);
    this.layer = layer;
    // dark side bars show the split-screen limits
    const frame = this.add.container(0, 0).setDepth(900);
    this.frame = frame;
    if (this.split) { frame.add(this.add.rectangle(0, 0, 480, 1080, 0x000000, 0.92).setOrigin(0)); frame.add(this.add.rectangle(1440, 0, 480, 1080, 0x000000, 0.92).setOrigin(0)); }
    const rig = buildRig(this, 'dino', model, view);
    layer.add(rig.root);
    rig.root.setPosition(size.w * 0.2, view === 'side' ? GROUND_Y : size.h / 2);
    const rng = new Rng(1234 + this.sc * 17 + (levels[0] ?? 1));
    const ctx: StageContext = {
      scene: this, layer, size, groundY: GROUND_Y, workshop: 'dino', model, computed, stage, stageIndex: 0, stageCount: 1, result,
      requirements: reqs.map((r) => {
        const passed = allPass(r.checks, computed);
        return { id: r.id, passed, reached: true, route: passed ? 'check' : null };
      }),
      rig, audio: this.audio, rng,
      wait: (ms) => new Promise((res) => { this.time.delayedCall(ms, () => res()); }),
      tween: (config) => new Promise((res) => { this.tweens.add({ ...config, onComplete: () => res() }); }),
    };
    const label = `${sc.id} | ${facets.map((f, i) => `${f.id}:${levels[i]}`).join(' + ')} | ${result.passed ? 'PASS' : `FAIL(${reqs.find((r) => r.id === result.firstFail)?.facet})`} | ${this.split ? 'split' : 'wide'} | rig ${rig.width}x${rig.height}`;
    this.label.setText(label + (player(sc.id) ? '' : ' | NO PLAYER'));
    const dbg = window as unknown as { __dinoStage?: { done: boolean; pass: boolean; label: string; error?: string } };
    dbg.__dinoStage = { done: false, pass: result.passed, label };
    const p = player(sc.id);
    if (!p) return;
    p.play(ctx).then(() => { if (my === this.token && dbg.__dinoStage) dbg.__dinoStage.done = true; }, (e: unknown) => { console.error(e); if (dbg.__dinoStage) dbg.__dinoStage.error = String(e); });
    const url = new URL(location.href);
    url.searchParams.set('scenario', sc.id); url.searchParams.set('facet', facets.map((f) => f.id).join(','));
    url.searchParams.set('level', levels.join(',')); url.searchParams.set('pass', this.pass ? '1' : '0');
    if (this.split) url.searchParams.set('split', '1'); else url.searchParams.delete('split');
    history.replaceState(null, '', url);
  }
}
