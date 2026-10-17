import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releases = join(root, 'releases');
const targets = [
  {name: 'local', directory: 'dist', platform: 'local', crazyMode: 'basic', ads: false},
  {name: 'crazygames-basic', directory: 'releases/crazygames-basic', platform: 'crazygames', crazyMode: 'basic', ads: false},
  {name: 'crazygames-full', directory: 'releases/crazygames-full', platform: 'crazygames', crazyMode: 'full', ads: true},
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected output: ${path}`);
  }
  return files.sort();
}

// Fixed dates, permissions and ordering make the ZIP independent of local mtimes.
const zipProgram = `
import pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(root.rglob('*')):
        if path.is_symlink(): raise RuntimeError('Symlinks are not release files')
        if path.is_file():
            name = path.relative_to(root).as_posix()
            if name != 'index.html' and not name.startswith('assets/'): raise RuntimeError('Unexpected release file: ' + name)
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
`;

await mkdir(releases, {recursive: true});
const report = {format: 1, targets: []};
for (const target of targets) {
  console.log(`\nBuilding ${target.name} (${target.platform}/${target.crazyMode})`);
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'run', 'build', '--', '--mode', target.name === 'local' ? 'production' : target.name,
    '--outDir', target.directory, '--emptyOutDir',
  ], {env: {...process.env, VITE_PLATFORM: target.platform, VITE_CRAZY_MODE: target.crazyMode}});
  const output = join(root, target.directory);
  const files = [];
  for (const path of await filesUnder(output)) {
    const data = await readFile(path);
    files.push({path: relative(output, path).replaceAll('\\', '/'), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')});
  }
  const result = {...target, files, fileCount: files.length, uncompressedBytes: files.reduce((sum, file) => sum + file.bytes, 0)};
  if (target.name !== 'local') {
    result.archive = `releases/smash-city-${target.name}.zip`;
    run('python3', ['-c', zipProgram, output, join(root, result.archive)]);
    const bytes = await readFile(join(root, result.archive));
    result.archiveBytes = (await stat(join(root, result.archive))).size;
    result.archiveSha256 = createHash('sha256').update(bytes).digest('hex');
    console.log(`${result.archive}: ${result.fileCount} files, ${result.archiveBytes} ZIP bytes, ${result.uncompressedBytes} unpacked bytes`);
  }
  report.targets.push(result);
}
await writeFile(join(releases, 'build-manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
run(process.execPath, ['scripts/verify-releases.mjs']);
