/**
 * Run preview: `workshop.html?dev=RunPreview&ws=race&scenario=mud&facet=mud.grip&level=2&pass=0&split=1&speed=1`
 *  - ws=race|dino, scenario=<id>, facet=<id> (one stage with that facet) or facets=a:1,b:2 (a combined stage),
 *    failfacet=<id> (which facet fails when pass=0), level=<n>, view=side|top (override), pass=0|1,
 *    split=1 (renders in a 960x1080 pane in the middle), speed=<mult>, autoplay=0, hud=0
 *  - buddy=<kind> (default dino): the buddy that runs along
 *  - sim=<n>: play the n-th challenge of a simulated game (winning build with pass=1, default build with pass=0)
 * Keys: Left/Right scenario, Up/Down facet, Q/E level -/+, A all facets of the scenario combined, P pass/fail,
 *       Space replay, F hold = fast forward, S toggle split, T top/side view where the facet allows both.
 */
import Phaser from 'phaser';
import { BUDDY_KINDS, type BuddyKind } from '../../../shared/buddies';
import { buildRig } from '../art';
import { createWorkshopAudio, preloadWorkshopAudio } from '../audio';
import { CATALOGS } from '../content';
import type { WorkshopAudio } from '../core/runtime';
import type { Challenge, FacetDef, Model, Requirement, RunResult, ScenarioDef, Stage, View, WorkshopId } from '../core/types';
import { engine, simulate } from '../logic';
import { solve } from '../logic/solver';
import { allPass, computeModel } from '../logic/stats';
import { flatChecks } from '../logic/util';
import { type RunHandle, playRun } from '../run/runner';

const SPLIT = { w: 960, h: 1080 };

export default class RunPreview extends Phaser.Scene {
  private ws: WorkshopId = 'race';
  private si = 0;
  private fi = 0;
  private level = 1;
  private pass = true;
  private combo = false;
  private split = false;
  private viewOverride: View | null = null;
  private failFacet = '';
  private simN = -1;
  private extraFacets: { facet: string; level: number }[] | null = null;
  private run: RunHandle | null = null;
  private audio!: WorkshopAudio;
  private label!: Phaser.GameObjects.Text;
  private note = '';
  private fast = false;
  private seed = 7;
  private buddy: BuddyKind = 'dino';

  constructor() { super('RunPreview'); }

  preload(): void { preloadWorkshopAudio(this); }

  private get cat() { return CATALOGS[this.ws]; }
  private get scen(): ScenarioDef { return this.cat.scenarios[this.si % this.cat.scenarios.length]; }
  private get facet(): FacetDef { return this.scen.facets[this.fi % this.scen.facets.length]; }

  create(): void {
    const q = new URLSearchParams(location.search);
    if (q.get('ws') === 'dino') this.ws = 'dino';
    const sid = q.get('scenario');
    if (sid) { const i = this.cat.scenarios.findIndex((s) => s.id === sid); if (i >= 0) this.si = i; }
    const fid = q.get('facet');
    if (fid) {
      const si = this.cat.scenarios.findIndex((s) => s.facets.some((f) => f.id === fid));
      if (si >= 0) { this.si = si; this.fi = this.scen.facets.findIndex((f) => f.id === fid); }
    }
    this.level = Number(q.get('level') ?? this.facet.levels[0]);
    this.pass = q.get('pass') !== '0';
    this.split = q.get('split') === '1';
    this.seed = Number(q.get('seed') ?? 7);
    const buddy = q.get('buddy');
    if (buddy && (BUDDY_KINDS as readonly string[]).includes(buddy)) this.buddy = buddy as BuddyKind;
    this.viewOverride = (q.get('view') as View | null) ?? null;
    this.failFacet = q.get('failfacet') ?? '';
    this.simN = Number(q.get('sim') ?? -1);
    const fs = q.get('facets');
    if (fs) this.extraFacets = fs.split(',').map((x) => { const [f, l] = x.split(':'); return { facet: f, level: Number(l) }; });
    this.combo = q.get('combo') === '1';
    const speed = Number(q.get('speed') ?? 1);
    this.audio = createWorkshopAudio(this.game);
    this.cameras.main.setBackgroundColor('#222a3a');
    if (this.split) { this.cameras.main.setViewport(480, 0, SPLIT.w, SPLIT.h); this.cameras.main.setScroll(480, 0); }
    this.label = this.add.text(this.split ? 490 : 10, 1032, '', { fontFamily: 'Arial', fontSize: '26px', color: '#1b1b3a', backgroundColor: '#ffffffd0', padding: { x: 8, y: 3 } }).setDepth(5000);
    if (q.get('hud') === '0') this.label.setVisible(false);
    const k = this.input.keyboard!;
    const n = () => this.cat.scenarios.length;
    k.on('keydown-RIGHT', () => { this.si = (this.si + 1) % n(); this.fi = 0; this.level = this.facet.levels[0]; this.extraFacets = null; this.start(); });
    k.on('keydown-LEFT', () => { this.si = (this.si + n() - 1) % n(); this.fi = 0; this.level = this.facet.levels[0]; this.extraFacets = null; this.start(); });
    k.on('keydown-UP', () => { this.fi = (this.fi + 1) % this.scen.facets.length; this.level = this.facet.levels[0]; this.extraFacets = null; this.start(); });
    k.on('keydown-DOWN', () => { this.fi = (this.fi + this.scen.facets.length - 1) % this.scen.facets.length; this.level = this.facet.levels[0]; this.extraFacets = null; this.start(); });
    k.on('keydown-E', () => { this.stepLevel(1); });
    k.on('keydown-Q', () => { this.stepLevel(-1); });
    k.on('keydown-A', () => { this.combo = !this.combo; this.extraFacets = null; this.start(); });
    k.on('keydown-P', () => { this.pass = !this.pass; this.start(); });
    k.on('keydown-S', () => { const u = new URL(location.href); u.searchParams.set('split', this.split ? '0' : '1'); u.searchParams.set('scenario', this.scen.id); u.searchParams.set('facet', this.facet.id); u.searchParams.set('level', String(this.level)); u.searchParams.set('pass', this.pass ? '1' : '0'); location.href = u.toString(); });
    k.on('keydown-T', () => { this.viewOverride = (this.viewOverride ?? this.facet.views[0]) === 'side' ? 'top' : 'side'; this.start(); });
    k.on('keydown-SPACE', () => this.start());
    k.on('keydown-F', () => { this.fast = true; this.run?.setSpeed(4); });
    k.on('keyup-F', () => { this.fast = false; this.run?.setSpeed(1); });
    this.events.once('shutdown', () => this.run?.destroy());
    this.speedParam = speed;
    if (q.get('autoplay') !== '0') this.start();
  }

  private speedParam = 1;

  private stepLevel(d: number): void {
    const ls = this.facet.levels;
    const i = Math.max(0, Math.min(ls.length - 1, ls.indexOf(this.level) + d));
    this.level = ls[i];
    this.extraFacets = null;
    this.start();
  }

  // ------------------------------------------------------------------ challenge construction

  private makeRequirement(facet: FacetDef, level: number, id: string): Requirement {
    const t = { easy: facet.id, medium: facet.id, hard: facet.id };
    return { id, facet: facet.id, level, checks: facet.check(level), text: t, hint: { aspect: facet.hintAspect, text: t } };
  }

  private findFacet(id: string): { scen: ScenarioDef; facet: FacetDef } | null {
    for (const s of this.cat.scenarios) for (const f of s.facets) if (f.id === id) return { scen: s, facet: f };
    return null;
  }

  private buildChallenge(): { challenge: Challenge; gagFacet: string } {
    const scen = this.scen;
    const picks = this.extraFacets ?? (this.combo ? scen.facets.map((f) => ({ facet: f.id, level: f.levels[Math.min(1, f.levels.length - 1)] })) : [{ facet: this.facet.id, level: this.level }]);
    const first = this.findFacet(picks[0].facet) ?? { scen, facet: this.facet };
    const params: Record<string, number> = {};
    const reqs: Requirement[] = [];
    picks.forEach((p, i) => { const f = this.findFacet(p.facet); if (!f) return; params[p.facet] = p.level; reqs.push(this.makeRequirement(f.facet, p.level, `s0r${i}`)); });
    const allViews = first.facet.views;
    const view: View = this.viewOverride && allViews.includes(this.viewOverride) ? this.viewOverride : allViews[0];
    const stage: Stage = { scenario: first.scen.id, view, params, requirements: reqs };
    const challenge: Challenge = { id: 'preview', workshop: this.ws, title: 'Preview', intro: { easy: '', medium: '', hard: '' }, stages: [stage], tier: 0, source: 'admin', seed: this.seed, genVersion: 1 };
    const gagFacet = this.failFacet && params[this.failFacet] !== undefined ? this.failFacet : picks[picks.length - 1].facet;
    return { challenge, gagFacet };
  }

  /** A model that passes every requirement (solver) or fails the gag facet but passes the rest. */
  private pickModel(challenge: Challenge, gagFacet: string): { model: Model; result: RunResult; note: string } {
    const cat = this.cat;
    const avail = new Set(cat.variants.map((v) => v.id));
    const def = engine.defaultModel(this.ws);
    const stage = challenge.stages[0];
    const checksOf = (rs: Requirement[]) => rs.flatMap((r) => r.checks);
    let model = def;
    let note = '';
    if (this.pass) {
      const sol = solve(cat, checksOf(stage.requirements), avail, { ref: def });
      if (sol) model = { ...def, ...sol.build }; else note = ' (no solution: forced pass)';
    } else {
      const others = stage.requirements.filter((r) => r.facet !== gagFacet);
      const sol = others.length ? solve(cat, checksOf(others), avail, { ref: def }) : null;
      model = sol ? { ...def, ...sol.build } : def;
      const gag = stage.requirements.filter((r) => r.facet === gagFacet);
      const cm = computeModel(cat, model);
      if (gag.every((r) => allPass(r.checks, cm))) {
        // default build passes the facet: look for one that fails it
        const asp = this.facet.hintAspect;
        const alt = cat.variants.filter((v) => v.aspect === asp).map((v) => ({ ...model, [asp]: v.id })).find((m) => !gag.every((r) => allPass(r.checks, computeModel(cat, m))));
        if (alt) model = alt; else note = ' (cannot fail: forced fail)';
      }
    }
    // forced result so visuals always match the requested outcome
    const cm = computeModel(cat, model);
    const reqRes = stage.requirements.map((r) => ({ id: r.id, passed: this.pass ? true : r.facet === gagFacet ? false : allPass(r.checks, cm), reached: true }));
    if (!this.pass) { const g = reqRes.find((r) => !r.passed); if (!g) reqRes[stage.requirements.findIndex((r) => r.facet === gagFacet)].passed = false; }
    const bad = reqRes.find((r) => !r.passed);
    const result: RunResult = { passed: !bad, cleverWin: false, endStage: 0,
      stages: [{ index: 0, passed: !bad, reached: true, ...(bad ? { firstFail: bad.id } : {}) }],
      requirements: reqRes.map((r) => ({ ...r, route: r.passed ? 'check' : null })),
    };
    return { model, result, note };
  }

  private start(): void {
    this.run?.destroy();
    this.run = null;
    const origin = this.split ? { x: 480, y: 0 } : { x: 0, y: 0 };
    const size = this.split ? SPLIT : { w: 1920, h: 1080 };
    let challenge: Challenge, model: Model, result: RunResult, desc: string;
    if (this.simN >= 0) {
      const sim = simulate(this.cat, { maxSteps: 400 });
      const list = Object.values(sim.progress.challenges);
      challenge = list[this.simN % list.length];
      const sol = solve(this.cat, flatChecks(challenge), new Set(this.cat.variants.map((v) => v.id)), { ref: engine.defaultModel(this.ws) });
      model = this.pass && sol ? { ...engine.defaultModel(this.ws), ...sol.build } : engine.defaultModel(this.ws);
      result = engine.evaluate(this.ws, model, challenge);
      desc = `sim #${this.simN}: ${challenge.stages.map((s) => s.scenario).join(' > ')}`;
      this.note = '';
    } else {
      const b = this.buildChallenge();
      challenge = b.challenge;
      const m = this.pickModel(challenge, b.gagFacet);
      model = m.model; result = m.result; this.note = m.note;
      const st = challenge.stages[0];
      desc = `${st.scenario} [${st.view}] ${Object.entries(st.params).map(([f, l]) => `${f}=${l}`).join(' ')}${this.pass ? '' : ` gag=${b.gagFacet}`}`;
    }
    this.label.setText(`${this.ws}: ${desc}  ${result.passed ? 'PASS' : 'FAIL'}${this.note}`);
    this.run = playRun({ scene: this, origin, size, workshop: this.ws, model, challenge, result, audio: this.audio, buildRig, seed: this.seed, buddy: this.buddy });
    this.run.setSpeed(this.fast ? 4 : this.speedParam);
    void this.run.done.then(() => { if (this.label.active) this.label.setText(`${this.label.text}  [done]`); });
  }
}
