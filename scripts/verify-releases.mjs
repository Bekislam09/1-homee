import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'releases/build-manifest.json'), 'utf8'));
assert.equal(manifest.format, 1, 'Unexpected release manifest');
const expected = [
  ['local', 'dist', 'local', 'basic', false],
  ['crazygames-basic', 'releases/crazygames-basic', 'crazygames', 'basic', false],
  ['crazygames-full', 'releases/crazygames-full', 'crazygames', 'full', true],
];
assert.deepEqual(manifest.targets.map(t => [t.name, t.directory, t.platform, t.crazyMode, t.ads]), expected, 'Release targets changed');

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), 'No symlinks in releases');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else {assert(entry.isFile()); files.push(path);}
  }
  return files.sort();
}

function checkReference(reference, from, available) {
  if (!reference || reference.startsWith('#') || reference.startsWith('data:') || reference.startsWith('blob:')) return;
  assert(!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(reference), `External or root-absolute asset in ${from}: ${reference}`);
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  const resolved = relative('.', resolve(dirname(from), clean)).split(sep).join('/');
  assert(available.has(resolved), `Missing local resource in ${from}: ${reference}`);
}

const verifyZip = `
import hashlib, json, pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2]) as archive:
    assert archive.testzip() is None, 'ZIP CRC validation failed'
    names = archive.namelist()
    expected = sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file())
    assert len(names) == len(set(names)), 'Duplicate ZIP entries'
    assert sorted(names) == expected, 'ZIP and build directory differ'
    assert 'index.html' in names, 'index.html must be at archive root'
    for name in names:
        assert name == 'index.html' or name.startswith('assets/'), 'Unexpected archive file: ' + name
        assert not name.startswith('/') and '..' not in pathlib.PurePosixPath(name).parts
        assert archive.read(name) == (root / name).read_bytes(), 'ZIP content differs: ' + name
        info = archive.getinfo(name)
        assert info.date_time == (1980, 1, 1, 0, 0, 0), 'Non-deterministic ZIP date'
print(json.dumps({'zipFiles': len(names), 'zipBytes': pathlib.Path(sys.argv[2]).stat().st_size}))
`;

for (const target of manifest.targets) {
  const directory = join(root, target.directory);
  const files = await listFiles(directory);
  const names = files.map(file => relative(directory, file).split(sep).join('/'));
  const available = new Set(names);
  assert(available.has('index.html'), `${target.name}: missing entry point`);
  assert.deepEqual(names, target.files.map(f => f.path), `${target.name}: file list changed since build`);
  assert.equal(target.fileCount, files.length);
  let totalBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const name = names[i];
    assert(name === 'index.html' || name === 'assets/Fredoka-OFL.txt' || /^assets\/[a-zA-Z\d_.-]+\.(?:js|css|png|webp|svg|jpg|jpeg|woff2?|ogg|mp3|wav)$/.test(name), `Unexpected release file: ${name}`);
    const data = await readFile(files[i]);
    totalBytes += data.length;
    assert.equal(data.length, target.files[i].bytes, `${target.name}/${name}: size mismatch`);
    assert.equal(createHash('sha256').update(data).digest('hex'), target.files[i].sha256, `${target.name}/${name}: hash mismatch`);
    const source = data.toString('utf8');
    if (name === 'index.html') {
      assert(source.includes('lang="en"'), `${target.name}: release must be English`);
      for (const [key, value] of [['smash-platform', target.platform], ['smash-crazy-mode', target.crazyMode], ['smash-ads', target.ads ? 'enabled' : 'disabled']]) {
        assert(source.includes(`name="${key}" content="${value}"`), `${target.name}: wrong ${key}`);
      }
      assert(!source.includes('%PUBLIC_URL%'), 'Legacy CRA template leaked into release');
      assert(!/<script[^>]+src=["'][^"']*(?:sdk\.js|crazygames-sdk)/i.test(source), 'SDK must be loaded only by its selected adapter');
      for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) checkReference(match[1], name, available);
    } else if (name.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*["']?([^\s'"()]+)["']?\s*\)/g)) checkReference(match[1], name, available);
    } else if (name.endsWith('.js')) {
      for (const match of source.matchAll(/(?:^|;)\s*import\s*(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/g)) checkReference(match[1], name, available);
    }
  }
  assert.equal(totalBytes, target.uncompressedBytes);
  if (target.name !== 'local') {
    const archive = join(root, target.archive);
    const data = await readFile(archive);
    assert.equal(data.length, target.archiveBytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), target.archiveSha256);
    const result = spawnSync('python3', ['-c', verifyZip, directory, archive], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || 'ZIP verification failed');
    console.log(`${target.name}: verified ${target.fileCount} files, ${totalBytes} unpacked bytes, ${data.length} ZIP bytes; ${target.platform}/${target.crazyMode}, ads ${target.ads ? 'enabled' : 'disabled'}`);
  } else console.log(`local: verified ${target.fileCount} files, ${totalBytes} bytes; no SDK or advertising`);
}
console.log('Static integrity checks passed. Platform limits and real SDK/ad behavior require checks in the platform preview; run HTTP/browser checks on extracted ZIPs separately.');
