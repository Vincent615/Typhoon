import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_PAGES = ['index.html', 'classic.html', 'ultra.html'];

async function readPublicTree(root, relative, files) {
  const location = path.join(root, relative);
  const stat = await fs.lstat(location);
  if (stat.isSymbolicLink()) throw new Error(`Public files must not be symlinks: ${relative}`);
  if (stat.isDirectory()) {
    for (const entry of (await fs.readdir(location)).sort()) {
      await readPublicTree(root, `${relative}/${entry}`, files);
    }
  } else if (stat.isFile()) {
    files.set(relative, await fs.readFile(location));
  } else {
    throw new Error(`Unsupported public file: ${relative}`);
  }
}

function versionedUrl(url, owner, version, files, { module = false } = {}) {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return url;
  if (module && !/^(?:\.{1,2}\/|\/)/.test(url)) return url;
  const fragmentIndex = url.indexOf('#');
  const fragment = fragmentIndex < 0 ? '' : url.slice(fragmentIndex);
  const beforeFragment = fragmentIndex < 0 ? url : url.slice(0, fragmentIndex);
  const queryIndex = beforeFragment.indexOf('?');
  const pathname = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  let decodedPath;
  try { decodedPath = decodeURIComponent(pathname); } catch { return url; }
  const target = pathname.startsWith('/')
    ? path.posix.normalize(decodedPath.slice(1))
    : path.posix.join(path.posix.dirname(owner), decodedPath);
  if (!target.startsWith('src/')) return url;
  if (!files.has(target)) throw new Error(`Missing local asset: ${owner} -> ${url}`);
  // Keep parameter spelling/order and fragment bytes intact, replacing only our version.
  const query = queryIndex < 0 ? [] : beforeFragment.slice(queryIndex + 1).split('&');
  const params = query.filter((item) => {
    try { return decodeURIComponent(item.split('=')[0]) !== 'v'; } catch { return true; }
  });
  params.push(`v=${version}`);
  return `${pathname}?${params.join('&')}${fragment}`;
}

function applyEdits(source, edits) {
  for (const { start, end, value } of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, start) + value + source.slice(end);
  }
  return source;
}

function rewriteHtml(source, owner, version, files) {
  // Treat complete script/style bodies and comments as opaque: do not rewrite inline JS.
  return source.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<link\b[^>]*>/gi, (element) => {
    const tag = element.match(/^<(script|link)\b[^>]*>/i)?.[0];
    if (!tag) return element;
    const attributes = [...tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)];
    const kind = tag.startsWith('<') && /^<script\b/i.test(tag) ? 'src' : 'href';
    if (kind === 'href') {
      const rel = attributes.find((match) => match[1].toLowerCase() === 'rel');
      if (!rel || !(rel[2] ?? rel[3] ?? rel[4]).toLowerCase().split(/\s+/).includes('stylesheet')) return element;
    }
    const attribute = attributes.find((match) => match[1].toLowerCase() === kind);
    if (!attribute) return element;
    const raw = attribute[2] ?? attribute[3] ?? attribute[4];
    const original = raw.replace(/&amp;/gi, '&');
    const next = versionedUrl(original, owner, version, files);
    if (next === original) return element;
    const value = next.replace(/&/g, '&amp;');
    const offset = attribute.index + attribute[0].indexOf('=') + 1;
    const start = offset + attribute[0].slice(attribute[0].indexOf('=') + 1).indexOf(raw);
    return element.slice(0, start) + value + element.slice(start + raw.length);
  });
}

// A small lexical pass isolates actual module specifiers from comments, ordinary
// strings and regex literals. It does not evaluate any source code.
function jsTokens(source) {
  const tokens = [];
  let i = 0;
  const regexPrefix = /^(?:[=(:,[!&|?{};]|=>|return|throw|case|delete|void|typeof|yield|await)$/;
  while (i < source.length) {
    const start = i;
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (source.startsWith('//', i)) {
      i = source.indexOf('\n', i + 2);
      if (i < 0) break;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated JavaScript comment');
      i = end + 2;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      let dynamic = false;
      for (i++; i < source.length; i++) {
        if (source[i] === '\\') { i++; continue; }
        if (char === '`' && source.startsWith('${', i)) dynamic = true;
        if (source[i] === char) break;
      }
      if (i === source.length) throw new Error('Unterminated JavaScript literal');
      tokens.push({ type: dynamic ? 'template' : 'string', start, end: ++i, value: source.slice(start + 1, i - 1), quote: char });
      continue;
    }
    if (char === '/' && (!tokens.length || regexPrefix.test(tokens.at(-1).value))) {
      let inClass = false;
      for (i++; i < source.length; i++) {
        if (source[i] === '\\') { i++; continue; }
        if (source[i] === '[') inClass = true;
        if (source[i] === ']') inClass = false;
        if (source[i] === '/' && !inClass) break;
      }
      for (i++; /[a-z]/i.test(source[i] ?? '') && i < source.length; i++);
      tokens.push({ type: 'regex', start, end: i, value: 'regex' });
      continue;
    }
    if (source.startsWith('=>', i)) {
      tokens.push({ type: 'punctuation', start, end: i += 2, value: '=>' });
      continue;
    }
    const word = source.slice(i).match(/^[a-z_$][\w$]*/i)?.[0];
    if (word) {
      i += word.length;
      tokens.push({ type: 'word', start, end: i, value: word });
    } else {
      tokens.push({ type: 'punctuation', start, end: ++i, value: char });
    }
  }
  return tokens;
}

function decodeJsString(raw) {
  return raw.replace(/\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2})|(\r\n|[\s\S]))/gi,
    (_, point, unicode, hex, char) => {
      if (point || unicode || hex) return String.fromCodePoint(parseInt(point || unicode || hex, 16));
      return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '', '\r': '', '\r\n': '' })[char] ?? char;
    });
}

function rewriteJavaScript(source, owner, version, files) {
  const tokens = jsTokens(source);
  const edits = new Map();
  const rewrite = (token) => {
    if (!token || token.type !== 'string') return;
    const original = decodeJsString(token.value);
    const value = versionedUrl(original, owner, version, files, { module: true });
    if (original === value) return;
    let escaped = JSON.stringify(value).slice(1, -1);
    if (token.quote !== '"') escaped = escaped.replaceAll(token.quote, `\\${token.quote}`);
    if (token.quote === '`') escaped = escaped.replaceAll('${', '\\${');
    edits.set(token.start, { start: token.start + 1, end: token.end - 1, value: escaped });
  };
  tokens.forEach((token, index) => {
    if (token.type !== 'word' || !['import', 'export'].includes(token.value)) return;
    if (['.', '?.'].includes(tokens[index - 1]?.value)) return;
    const next = tokens[index + 1];
    if (next?.value === '.') return;
    if (token.value === 'import' && next?.value === '(') {
      if ([')', ','].includes(tokens[index + 3]?.value)) rewrite(tokens[index + 2]);
      return;
    }
    if (token.value === 'import' && next?.type === 'string') { rewrite(next); return; }
    // Other exports (functions, classes and values) cannot have a module specifier.
    if (token.value === 'export' && !['{', '*'].includes(next?.value)) return;
    for (let cursor = index + 1; cursor < tokens.length; cursor++) {
      const candidate = tokens[cursor];
      if (candidate.value === ';') break;
      if (candidate.type === 'word' && candidate.value === 'from' && tokens[cursor + 1]?.type === 'string') {
        rewrite(tokens[cursor + 1]);
        break;
      }
    }
  });
  return applyEdits(source, [...edits.values()]);
}

function rewriteCss(source, owner, version, files) {
  // Match comments and quoted strings too so fake url(...) text stays untouched.
  return source.replace(/\/\*[\s\S]*?\*\/|@import\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|url\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^)]*)\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi, (token) => {
    if (/^\/\*|^["']/.test(token)) return token;
    const match = token.match(/^(?:@import\s+|url\(\s*)(?:(["'])([\s\S]*?)\1|([^)]*?))(\s*\))?$/i);
    if (!match) return token;
    const raw = match[2] ?? match[3].trim();
    const value = versionedUrl(raw, owner, version, files);
    return value === raw ? token : token.slice(0, token.indexOf(raw)) + value + token.slice(token.indexOf(raw) + raw.length);
  });
}

export async function buildSite({ rootDir = PROJECT_ROOT, outDir, sourceCommit } = {}) {
  const root = await fs.realpath(rootDir);
  const output = path.resolve(outDir ?? path.join(root, '_site'));
  if (output !== path.join(root, '_site')) throw new Error('Build output must be the project root/_site directory');
  try {
    if ((await fs.lstat(output)).isSymbolicLink()) throw new Error('Build output must not be a symlink');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const commit = sourceCommit ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f\d]{40}(?:[a-f\d]{24})?$/i.test(commit)) throw new Error('sourceCommit must be a full Git commit SHA');
  const files = new Map();
  for (const entry of [...PUBLIC_PAGES, 'src', 'data']) await readPublicTree(root, entry, files);
  const hash = createHash('sha256');
  for (const [name, content] of [...files].filter(([name]) => name.startsWith('src/')).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    hash.update(`${name}\0${content.length}\0`).update(content);
  }
  const assetVersion = hash.digest('hex').slice(0, 16);
  const manifest = { assetVersion, sourceCommit: commit };
  const staging = await fs.mkdtemp(path.join(root, '.site-build-'));
  try {
    for (const [name, bytes] of files) {
      let contents = bytes;
      if (PUBLIC_PAGES.includes(name)) contents = rewriteHtml(bytes.toString('utf8'), name, assetVersion, files);
      else if (/\.[cm]?js$/.test(name) && name.startsWith('src/')) contents = rewriteJavaScript(bytes.toString('utf8'), name, assetVersion, files);
      else if (name.endsWith('.css') && name.startsWith('src/')) contents = rewriteCss(bytes.toString('utf8'), name, assetVersion, files);
      const destination = path.join(staging, name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, contents);
    }
    await fs.writeFile(path.join(staging, 'build.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    // Only remove the validated, dedicated output directory after a complete build.
    await fs.rm(output, { recursive: true, force: true });
    await fs.rename(staging, output);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  return { ...manifest, outDir: output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildSite().then(({ assetVersion, sourceCommit }) => {
    console.log(`Built _site with asset version ${assetVersion} from ${sourceCommit}`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
