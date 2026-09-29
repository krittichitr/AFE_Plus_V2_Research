#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const events = [];
let runId = null;
let incomplete = false;
const logger = {
  getRecordingResearchRunId: () => runId,
  appendResearchProvenanceEventAt: (event) => { events.push(event); return true; },
  appendResearchProvenanceEvent: (event) => { events.push(event); return true; },
  markM2Incomplete: () => { incomplete = true; },
};
const source = readFileSync(resolve(root, 'src/lib/research/m2Instrumentation.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', code)((id) => {
  if (id === './provenanceEvents') return logger;
  throw new Error(`Unexpected import ${id}`);
}, module, module.exports);
const m2 = module.exports;

assert.equal(m2.m2ResearchFetchBlocked('?m2_research=1', runId), true);
assert.equal(m2.m2ResearchFetchBlocked('', runId), false);
assert.equal(m2.startV2M2Attempt({ sessionId: 's', routeUpdateId: 'u', updateType: 'initial', targetSampleId: null }), null);
assert.equal(events.length, 0); // No pre-run attribution.
runId = 'run-fixture';
assert.equal(m2.m2ResearchFetchBlocked('?m2_research=1', runId), false);
const initial = m2.startV2M2Attempt({ sessionId: 's', routeUpdateId: 'u1', updateType: 'initial', targetSampleId: 'T1' });
m2.finishV2M2Attempt(initial, true, 200, null);
const style = m2.startV2M2Attempt({ sessionId: 's', routeUpdateId: 'u2', updateType: 'style_reload', targetSampleId: 'T2' });
m2.finishV2M2Attempt(style, false, 503, 'http_503');
assert.notEqual(initial, style);
assert.equal(events.filter((event) => event.event === 'm2_mapbox_attempt').length, 2);
assert.equal(events.filter((event) => event.event === 'm2_mapbox_outcome').length, 2);
assert.equal(events.find((event) => event.mapbox_attempt_id === style && event.event === 'm2_mapbox_attempt').request_phase, 'navigation');
assert.equal(events.find((event) => event.mapbox_attempt_id === style && event.event === 'm2_mapbox_outcome').success, false);
assert.equal(incomplete, false);

// The movement threshold returns before the M2 helper is called in the page.
const page = readFileSync(resolve(root, 'src/pages/navigation.tsx'), 'utf8');
assert(page.indexOf("if (!force && lastRouteFetchUserPosRef.current") < page.indexOf('m2AttemptId = startV2M2Attempt'));
assert(page.indexOf('m2ResearchFetchBlocked(window.location.search') < page.indexOf('m2AttemptId = startV2M2Attempt'));
assert(page.indexOf('m2AttemptId = startV2M2Attempt') < page.indexOf('const res = await fetch(url)'));
console.log('PASS: V2 research gate, unique initial/style attempts, failed outcome, movement gate placement');
