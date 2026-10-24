import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = await fs.readFile(new URL('../.github/workflows/update-typhoon-data.yml', import.meta.url), 'utf8');

// Execute the actual workflow step body instead of duplicating its decisions in
// a test helper. actionlint separately validates the surrounding YAML and DAG.
function stepScript(name) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  assert.ok(start >= 0, `Missing workflow step: ${name}`);
  const nextStep = workflow.indexOf('\n      - name:', start + 1);
  const block = workflow.slice(start, nextStep < 0 ? undefined : nextStep);
  const run = block.indexOf('\n        run: |\n');
  assert.ok(run >= 0, `Missing shell body: ${name}`);
  const lines = block.slice(run + '\n        run: |\n'.length).split('\n');
  const script = [];
  for (const line of lines) {
    if (line.trim() && !line.startsWith('          ')) break;
    script.push(line.slice(10));
  }
  return script.join('\n');
}

const modeScript = stepScript('Read Saved Monitoring Mode');
const commitScript = stepScript('Commit and Push Updated Data');
const resultScript = stepScript('Report update and deployment results');

async function readSavedMode(t, data) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-workflow-mode-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, 'data'));
  await fs.writeFile(path.join(dir, 'data/typhoon-data.json'), JSON.stringify(data));
  const output = path.join(dir, 'output');
  await fs.writeFile(output, '');
  const processResult = spawnSync('bash', ['-e'], {
    input: modeScript, cwd: dir, env: { ...process.env, GITHUB_OUTPUT: output },
    encoding: 'utf8', timeout: 10000
  });
  return { ...processResult, output: await fs.readFile(output, 'utf8') };
}

test('workflow retains active behavior for a legacy dataset without monitoring metadata', async (t) => {
  const result = await readSavedMode(t, { officialSync: { cwaStatus: 'active' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'mode=active\n');
});

test('workflow reads the saved standby state even when the current fetch produced no outputs', async (t) => {
  const result = await readSavedMode(t, {
    monitoring: { mode: 'standby' }, officialSync: { cwaStatus: 'no_active' },
    scenarios: [{ hasTyphoon: false }]
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'mode=standby\n');
});

test('workflow refuses contradictory or unknown saved standby modes', async (t) => {
  for (const data of [
    { monitoring: { mode: 'unknown' } },
    { monitoring: { mode: 'standby' }, officialSync: { cwaStatus: 'active' }, scenarios: [{ hasTyphoon: true }] },
    { monitoring: { mode: 'standby' }, officialSync: { cwaStatus: 'no_active' }, scenarios: [] },
    { monitoring: { mode: 'standby' }, officialSync: { cwaStatus: 'no_active' }, scenarios: [{ hasTyphoon: true }] }
  ]) {
    const result = await readSavedMode(t, data);
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
  }
});

const resultCases = [
  ['active publication', 'active', 'success', 'success', 'true', 'success', true],
  ['first standby publication', 'standby', 'success', 'skipped', 'true', 'success', true],
  ['unchanged standby check', 'standby', 'success', 'skipped', 'false', 'skipped', true],
  ['unchanged active check', 'active', 'success', 'success', 'false', 'skipped', true],
  ['standby source failure', 'standby', 'failure', 'skipped', 'false', 'skipped', false],
  ['active source failure with news publication', 'active', 'failure', 'success', 'true', 'success', false],
  ['active news unexpectedly skipped', 'active', 'success', 'skipped', 'true', 'success', false],
  ['standby news unexpectedly fetched', 'standby', 'success', 'success', 'false', 'skipped', false],
  ['news failure', 'active', 'success', 'failure', 'true', 'success', false],
  ['deployment failure', 'active', 'success', 'success', 'true', 'failure', false],
  ['changed data with deployment skipped', 'standby', 'success', 'skipped', 'true', 'skipped', false],
  ['missing change result', 'standby', 'success', 'skipped', '', 'skipped', false]
];

for (const [name, mode, forecast, news, changed, deployed, succeeds] of resultCases) {
  test(`workflow result gate: ${name}`, () => {
    const result = spawnSync('bash', ['-e'], {
      input: resultScript,
      env: { ...process.env, MONITORING_MODE: mode, FORECAST_RESULT: forecast,
        NEWS_RESULT: news, DATA_CHANGED: changed, DEPLOY_RESULT: deployed },
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.status, succeeds ? 0 : 1, result.stderr + result.stdout);
    assert.match(result.stdout, succeeds ? /Update cycle completed/ : /::error::/);
  });
}

async function commitFixture(t, ageDays, mode = 'standby') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-workflow-commit-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const work = path.join(dir, 'work');
  const remote = path.join(dir, 'remote.git');
  const output = path.join(dir, 'output');
  await fs.mkdir(work);
  const git = (args, cwd = work, env = process.env) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout.trim();
  };
  git(['init', '--bare', remote], dir);
  git(['init', '--initial-branch=main']);
  git(['config', 'user.name', 'Workflow Test']);
  git(['config', 'user.email', 'workflow-test@example.invalid']);
  git(['config', 'commit.gpgsign', 'false']);
  const hooks = path.join(dir, 'empty-hooks');
  await fs.mkdir(hooks);
  git(['config', 'core.hooksPath', hooks]);
  await fs.mkdir(path.join(work, 'data'));
  const forecast = path.join(work, 'data/typhoon-data.json');
  const news = path.join(work, 'data/news.json');
  await fs.writeFile(forecast, JSON.stringify({ monitoring: { mode }, updatedAt: '2026-01-01T00:00:00Z' }) + '\n');
  await fs.writeFile(news, '{"articles":[]}\n');
  git(['add', 'data']);
  const initialTime = `@${Math.floor(Date.now() / 1000) - ageDays * 86400} +0000`;
  git(['commit', '-m', 'initial snapshot'], work, {
    ...process.env, GIT_AUTHOR_DATE: initialTime, GIT_COMMITTER_DATE: initialTime
  });
  git(['remote', 'add', 'origin', remote]);
  git(['push', '--set-upstream', 'origin', 'main']);
  const originalHead = git(['rev-parse', 'HEAD']);
  const originalTree = git(['rev-parse', 'HEAD^{tree}']);
  const originalBytes = [await fs.readFile(forecast), await fs.readFile(news)];
  const originalMtimes = [(await fs.stat(forecast)).mtimeMs, (await fs.stat(news)).mtimeMs];
  const run = async () => {
    await fs.writeFile(output, '');
    const result = spawnSync('bash', ['-e'], {
      input: commitScript, cwd: work,
      env: { ...process.env, MONITORING_MODE: mode, GITHUB_OUTPUT: output },
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return await fs.readFile(output, 'utf8');
  };
  return { git, run, forecast, news, remote, originalHead, originalTree, originalBytes, originalMtimes };
}

for (const [name, ageDays, mode] of [
  ['fresh standby', 0, 'standby'],
  ['standby under 28 days', 27, 'standby'],
  ['aged active tracking', 29, 'active']
]) {
  test(`workflow keepalive does not create an unnecessary commit: ${name}`, async (t) => {
    const fixture = await commitFixture(t, ageDays, mode);
    const output = await fixture.run();
    assert.match(output, /^changed=false\n/);
    assert.equal(fixture.git(['rev-parse', 'HEAD']), fixture.originalHead);
    assert.equal(fixture.git(['rev-parse', 'refs/heads/main'], fixture.remote), fixture.originalHead);
  });
}

test('aged standby pushes one empty keepalive without changing data, timestamps or deployment demand', async (t) => {
  const fixture = await commitFixture(t, 29);
  const output = await fixture.run();
  const head = fixture.git(['rev-parse', 'HEAD']);
  assert.notEqual(head, fixture.originalHead);
  assert.equal(fixture.git(['show', '-s', '--format=%s', 'HEAD']), 'chore: keep scheduled typhoon discovery active');
  assert.equal(fixture.git(['rev-parse', 'HEAD^{tree}']), fixture.originalTree);
  assert.equal(fixture.git(['rev-parse', 'refs/heads/main'], fixture.remote), head);
  assert.equal(output, `changed=false\nref=${head}\n`);
  assert.deepEqual([await fs.readFile(fixture.forecast), await fs.readFile(fixture.news)], fixture.originalBytes);
  assert.deepEqual([(await fs.stat(fixture.forecast)).mtimeMs, (await fs.stat(fixture.news)).mtimeMs], fixture.originalMtimes);
  assert.equal(await fixture.run(), output, 'the next check must not create another keepalive');
  assert.equal(fixture.git(['rev-list', '--count', 'HEAD']), '2');
});

test('a real data change takes the normal publication path even during aged standby', async (t) => {
  const fixture = await commitFixture(t, 29);
  await fs.writeFile(fixture.forecast, '{"monitoring":{"mode":"standby"},"updatedAt":"2026-01-02T00:00:00Z"}\n');
  const output = await fixture.run();
  assert.match(output, /^changed=true\n/);
  assert.equal(fixture.git(['show', '-s', '--format=%s', 'HEAD']), 'chore(data): update typhoon forecast and news');
  assert.notEqual(fixture.git(['rev-parse', 'HEAD^{tree}']), fixture.originalTree);
  assert.equal(fixture.git(['rev-parse', 'refs/heads/main'], fixture.remote), fixture.git(['rev-parse', 'HEAD']));
});
