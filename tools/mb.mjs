import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [command = 'help', ...args] = process.argv.slice(2);
const image = 'microbook-maker:verify';
const run = (binary, argv, options = {}) => {
  const result = spawnSync(binary, argv, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
  return result;
};
function setup() {
  run('docker', ['build', '--target', 'verify', '-t', image, '.']);
}
function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
if (command === 'setup') setup();
else if (['doctor', 'dev', 'check', 'render', 'compare', 'test', 'bench'].includes(command)) {
  if (!args.includes('--no-build')) setup();
  const out = path.resolve(
    option(
      'out',
      path.join(root, '.artifacts', `${command}-${new Date().toISOString().replace(/[:.]/g, '-')}`),
    ),
  );
  fs.mkdirSync(out, { recursive: true });
  const mounts = ['-v', `${out}:/reports`];
  if (process.getuid && process.getgid)
    mounts.push('-e', `MB_REPORT_OWNER=${process.getuid()}:${process.getgid()}`);
  const forwarded = args.filter((a) => a !== '--no-build');
  for (const flag of ['input', 'settings']) {
    const index = forwarded.indexOf(`--${flag}`);
    if (index < 0) continue;
    const file = path.resolve(forwarded[index + 1]);
    if (!fs.statSync(file).isFile()) throw Error(`${flag} must be a local file`);
    const destination = `/input/${flag === 'input' ? 'book' + path.extname(file) : 'settings.json'}`;
    mounts.push('-v', `${file}:${destination}:ro`);
    forwarded[index + 1] = destination;
    if (flag === 'input') forwarded.push('--name', path.basename(file));
  }
  const outIndex = forwarded.indexOf('--out');
  if (outIndex >= 0) forwarded.splice(outIndex, 2);
  const fixtureCache = path.join(root, '.cache', 'public-books');
  fs.mkdirSync(fixtureCache, { recursive: true });
  mounts.push('-v', `${fixtureCache}:/workspace/.cache/public-books`);
  if (command === 'dev') {
    const port = option('port', '7777');
    const data = path.resolve(option('data', path.join(root, '.artifacts', 'dev-data')));
    fs.mkdirSync(data, { recursive: true });
    run('docker', [
      'run',
      '--rm',
      '--init',
      '--name',
      `microbook-dev-${port}`,
      '-p',
      `127.0.0.1:${port}:7777`,
      '-v',
      `${data}:/data`,
      '-e',
      'MICROBOOK_DATA_DIR=/data',
      '--entrypoint',
      'node',
      image,
      'dist/server.js',
    ]);
  } else {
    run('docker', ['run', '--rm', '--init', ...mounts, image, command, ...forwarded, '--out', '/reports']);
    console.log(`Reports: ${out}`);
  }
} else {
  console.log(
    `MicroBook Maker\n\n  npm run mb -- setup\n  npm run mb -- doctor\n  npm run mb -- dev [--port 7777]\n  npm run mb -- check\n  npm run mb -- render --input book.epub [--mode rich|basic] [--settings settings.json] [--out directory]\n  npm run mb -- compare --input book.epub [--out directory]\n  npm run mb -- test --suite full\n  npm run mb -- bench --input book.epub [--runs 3]\n\nUse --no-build after setup to reuse the verification image. Tests always use isolated temporary storage.`,
  );
}
