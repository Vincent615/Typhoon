import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../scripts/build_site.mjs';

const SOURCE_COMMIT = 'a'.repeat(40);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t, extraFiles = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-build-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  const files = {
    'index.html': `<link href="https://fonts.example/test?a=1&b=2" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,%3Csvg/%3E">
<link rel="stylesheet" href="./src/main.css?theme=night&amp;lang=zh#sheet">
<script type="module" src="./src/app.js?mode=a%20b#entry"></script>
<script>const sample = '<link rel="stylesheet" href="./src/main.css">';</script>
<!-- <script src="./src/unused.js"></script> -->
<a href="./classic.html">classic</a>`,
    'classic.html': `<link rel='stylesheet' href='./src/main.css'><script type='module' src='./src/app.js'></script>`,
    'ultra.html': '<script>location.replace("./" + location.search + location.hash);</script>',
    'src/app.js': `import { value } from './lib.js?raw=1&x=a%20b#part';
import './side.js';
export { value } from './lib.js';
export * from './lib.js?x=1';
const a = () => import('./lazy.js?raw=1#module');
const b = () => import(\`./lazy.js#template\`);
const c = () => import('./lazy.js', { with: { type: 'javascript' } });
const computed = () => import('./' + 'computed.js');
const remote = () => import('https://cdn.example/module.js');
const bare = () => import('library');
const data = fetch('./data/news.json?fresh=1');
const string = "import('./unchanged.js')";
const regex = () => /import\\('unchanged'\\)/;
// import './comment.js';
/* export * from './comment.js'; */
export const url = import.meta.url;
`,
    'src/lib.js': 'export const value = 1;',
    'src/side.js': 'import "./lib.js";',
    'src/lazy.js': 'export * from "./lib.js";',
    'src/main.css': `@import "./theme.css?theme=dark#theme" screen;
@import url('./theme.css');
.logo { background: url("./icon.svg?size=2#mark"); }
.local { background: url(./icon.svg#plain); }
.remote { background: url(https://example.test/img.png); }
.inline { background: url(data:image/svg+xml,%3Csvg%3E); filter: url(#shadow); }
.label::before { content: "url('./do-not-change.svg')"; }
/* url('./comment.svg') */`,
    'src/theme.css': 'body { color: black; }',
    'src/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'data/news.json': '{"articles":[]}',
    'README.md': 'Private implementation details',
    'tests/fixture.js': 'Do not publish',
    'scripts/private.js': 'Do not publish',
    '.env': 'PRIVATE_TOKEN=never-publish',
    ...extraFiles
  };
  for (const [name, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(rootDir, name)), { recursive: true });
    await fs.writeFile(path.join(rootDir, name), contents);
  }
  return {
    rootDir, files,
    build: (options = {}) => buildSite({ rootDir, sourceCommit: SOURCE_COMMIT, ...options }),
    read: (name) => fs.readFile(path.join(rootDir, '_site', name), 'utf8')
  };
}

async function snapshot(root, prefix = '') {
  const files = {};
  for (const entry of (await fs.readdir(path.join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, await snapshot(root, name));
    else files[name] = await fs.readFile(path.join(root, name), 'utf8');
  }
  return files;
}

test('HTML and the entire module graph share one version while URLs keep their query and fragment', async (t) => {
  const f = await fixture(t);
  const { assetVersion: v } = await f.build();
  const html = await f.read('index.html');
  assert.ok(html.includes(`./src/main.css?theme=night&amp;lang=zh&amp;v=${v}#sheet`));
  assert.ok(html.includes(`./src/app.js?mode=a%20b&amp;v=${v}#entry`));
  const js = await f.read('src/app.js');
  for (const expected of [
    `./lib.js?raw=1&x=a%20b&v=${v}#part`,
    `./side.js?v=${v}`,
    `./lib.js?v=${v}`,
    `./lib.js?x=1&v=${v}`,
    `./lazy.js?raw=1&v=${v}#module`,
    `./lazy.js?v=${v}#template`,
    `import('./lazy.js?v=${v}', {`
  ]) assert.ok(js.includes(expected), expected);
  assert.ok((await f.read('src/side.js')).includes(`"./lib.js?v=${v}"`));
  assert.ok((await f.read('src/lazy.js')).includes(`"./lib.js?v=${v}"`));
  // The original file paths continue to exist, including for older cached HTML.
  await fs.access(path.join(f.rootDir, '_site/src/app.js'));
});

test('CSS imports and assets are versioned without touching remote URLs, inline SVG or content strings', async (t) => {
  const f = await fixture(t);
  const { assetVersion: v } = await f.build();
  const css = await f.read('src/main.css');
  assert.ok(css.includes(`@import "./theme.css?theme=dark&v=${v}#theme" screen`));
  assert.ok(css.includes(`url('./theme.css?v=${v}')`));
  assert.ok(css.includes(`url("./icon.svg?size=2&v=${v}#mark")`));
  assert.ok(css.includes(`url(./icon.svg?v=${v}#plain)`));
  for (const unchanged of [
    'url(https://example.test/img.png)',
    'url(data:image/svg+xml,%3Csvg%3E)',
    'url(#shadow)',
    `"url('./do-not-change.svg')"`,
    "/* url('./comment.svg') */"
  ]) assert.ok(css.includes(unchanged), unchanged);
});

test('inline JavaScript, external fonts, icons, data fetches and non-import strings stay untouched', async (t) => {
  const f = await fixture(t);
  await f.build();
  const html = await f.read('index.html');
  for (const unchanged of [
    '<link href="https://fonts.example/test?a=1&b=2" rel="stylesheet">',
    '<link rel="icon" href="data:image/svg+xml,%3Csvg/%3E">',
    `<script>const sample = '<link rel="stylesheet" href="./src/main.css">';</script>`,
    '<!-- <script src="./src/unused.js"></script> -->',
    '<a href="./classic.html">classic</a>'
  ]) assert.ok(html.includes(unchanged), unchanged);
  const js = await f.read('src/app.js');
  for (const unchanged of [
    `import('./' + 'computed.js')`,
    `import('https://cdn.example/module.js')`,
    `import('library')`,
    `fetch('./data/news.json?fresh=1')`,
    `"import('./unchanged.js')"`,
    `/import\\('unchanged'\\)/`,
    "// import './comment.js';",
    "/* export * from './comment.js'; */",
    'import.meta.url'
  ]) assert.ok(js.includes(unchanged), unchanged);
  assert.equal(await f.read('ultra.html'), f.files['ultra.html']);
});

test('build is deterministic, leaves sources untouched, and publishes only the public allowlist', async (t) => {
  const f = await fixture(t);
  const first = await f.build();
  const firstFiles = await snapshot(first.outDir);
  await fs.writeFile(path.join(first.outDir, 'obsolete.txt'), 'remove stale output');
  const second = await f.build();
  assert.deepEqual(await snapshot(second.outDir), firstFiles);
  assert.deepEqual(first, second);
  for (const [name, contents] of Object.entries(f.files)) {
    assert.equal(await fs.readFile(path.join(f.rootDir, name), 'utf8'), contents, name);
  }
  assert.deepEqual(Object.keys(firstFiles).filter((name) => !name.startsWith('src/') && !name.startsWith('data/')).sort(),
    ['build.json', 'classic.html', 'index.html', 'ultra.html']);
  assert.deepEqual(JSON.parse(firstFiles['build.json']), { assetVersion: first.assetVersion, sourceCommit: SOURCE_COMMIT });
  assert.ok(!Object.values(firstFiles).join('').includes('never-publish'));
});

test('data refreshes keep the asset version while JS, CSS and filenames invalidate it', async (t) => {
  const f = await fixture(t);
  const original = await f.build();
  await fs.writeFile(path.join(f.rootDir, 'data/news.json'), '{"articles":[{"title":"new news"}]}');
  assert.equal((await f.build()).assetVersion, original.assetVersion);
  assert.ok((await f.read('data/news.json')).includes('new news'));
  await fs.appendFile(path.join(f.rootDir, 'src/lib.js'), '\nexport const changed = true;\n');
  const jsChange = await f.build();
  assert.notEqual(jsChange.assetVersion, original.assetVersion);
  await fs.appendFile(path.join(f.rootDir, 'src/theme.css'), '\nbody { color: red; }\n');
  const cssChange = await f.build();
  assert.notEqual(cssChange.assetVersion, jsChange.assetVersion);
  await fs.writeFile(path.join(f.rootDir, 'src/another.svg'), f.files['src/icon.svg']);
  assert.notEqual((await f.build()).assetVersion, cssChange.assetVersion);
});

test('existing version parameters are replaced while unrelated query encoding and fragments survive', async (t) => {
  const f = await fixture(t, {
    'src/app.js': `import './lib.js?x=a+b&v=old&flag&%76=older#same';\nimport './lib.js?x=%26%3D#encoded';`
  });
  const { assetVersion: v } = await f.build();
  assert.equal(await f.read('src/app.js'), `import './lib.js?x=a+b&flag&v=${v}#same';\nimport './lib.js?x=%26%3D&v=${v}#encoded';`);
});

test('build refuses unsafe output paths and symlinks without deleting source files', async (t) => {
  const f = await fixture(t);
  for (const outDir of [f.rootDir, path.dirname(f.rootDir), path.join(f.rootDir, 'src'), path.join(f.rootDir, '../_site')]) {
    await assert.rejects(f.build({ outDir }), /root\/_site/);
  }
  await fs.symlink(path.join(f.rootDir, 'src'), path.join(f.rootDir, '_site'));
  await assert.rejects(f.build(), /symlink/);
  assert.equal(await fs.readFile(path.join(f.rootDir, 'src/app.js'), 'utf8'), f.files['src/app.js']);
});

test('a missing module fails before replacing the previous successful artifact', async (t) => {
  const f = await fixture(t);
  const first = await f.build();
  await fs.appendFile(path.join(f.rootDir, 'src/app.js'), `\nimport './missing.js';`);
  await assert.rejects(f.build(), /Missing local asset/);
  assert.equal(JSON.parse(await f.read('build.json')).assetVersion, first.assetVersion);
  assert.equal((await fs.readdir(f.rootDir)).some((name) => name.startsWith('.site-build-')), false);
});

test('manifest uses the actual checkout commit, ignoring an unrelated workflow GITHUB_SHA', async (t) => {
  const f = await fixture(t);
  execFileSync('git', ['init', '--quiet'], { cwd: f.rootDir });
  execFileSync('git', ['-c', 'user.name=Build Test', '-c', 'user.email=build@example.test',
    '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture', '--quiet'], { cwd: f.rootDir });
  const expected = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: f.rootDir, encoding: 'utf8' }).trim();
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = 'b'.repeat(40);
  try {
    const manifest = await buildSite({ rootDir: f.rootDir });
    assert.equal(manifest.sourceCommit, expected);
    assert.equal(JSON.parse(await f.read('build.json')).sourceCommit, expected);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  }
});

test('the real site builds with every local module dependency versioned and source imports untouched', async (t) => {
  const f = await fixture(t);
  for (const entry of ['index.html', 'classic.html', 'ultra.html', 'src', 'data']) {
    await fs.rm(path.join(f.rootDir, entry), { recursive: true, force: true });
    await fs.cp(path.join(REPO_ROOT, entry), path.join(f.rootDir, entry), { recursive: true });
  }
  const sourceBefore = await snapshot(path.join(f.rootDir, 'src'));
  const { assetVersion: v } = await f.build();
  const built = await snapshot(path.join(f.rootDir, '_site/src'));
  for (const [name, content] of Object.entries(built).filter(([name]) => name.endsWith('.js'))) {
    for (const match of content.matchAll(/\bfrom\s*(['"])(\.[^'"]+)\1/g)) {
      assert.equal(new URL(match[2], 'https://example.test/src/').searchParams.get('v'), v, `${name}: ${match[2]}`);
    }
  }
  assert.deepEqual(await snapshot(path.join(f.rootDir, 'src')), sourceBefore);
  for (const page of ['index.html', 'classic.html']) {
    const html = await f.read(page);
    assert.ok(html.includes(`?v=${v}`), page);
    assert.ok(!/<(?:script|link)[^>]+(?:src|href)=["']\.\/src\/[^?"']+["']/i.test(html), page);
  }
});
