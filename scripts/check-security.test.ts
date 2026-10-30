// Static guard for the public site's security rules: no privileged keys in source, no secret
// exposed through NEXT_PUBLIC_, no private/admin route in public navigation.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let bad = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(66), ok ? '' : detail);
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const src = walk(join(root, 'src')).filter((f) => /\.(tsx?|jsx?|mjs|css|json)$/.test(f));
const hits = (re: RegExp) => src.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));

check('no service-role key referenced anywhere under src/', hits(/service[_-]?role/i).length === 0, hits(/service[_-]?role/i).join(', '));
check('no JWT-looking secret literal in src/', hits(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./).length === 0);
check('no NEXT_PUBLIC_ variable names a secret', hits(/NEXT_PUBLIC_\w*(SECRET|SERVICE|PRIVATE|PASSWORD)/i).length === 0);
check('no Supabase write calls in src/ (public site is read-only)', hits(/\.(insert|update|upsert|delete)\(/).filter((f) => /supabase/i.test(readFileSync(join(root, f), 'utf8'))).length === 0);
check('no public admin/login/account routes', !existsSync(join(root, 'src/app/admin')) && !existsSync(join(root, 'src/app/login')) && !existsSync(join(root, 'src/app/account')));

const env = (n: string) => existsSync(join(root, n));
const ignored = (n: string) => {
  try {
    execSync(`git check-ignore -q ${n}`, { cwd: root });
    return true;
  } catch {
    return false;
  }
};
check('.env.local is git-ignored', ignored('.env.local'));
check('.env is git-ignored', ignored('.env'));
check('.env.example is NOT ignored (template stays committed)', !ignored('.env.example'));
if (env('.env.example')) {
  const ex = readFileSync(join(root, '.env.example'), 'utf8');
  check('.env.example holds no real values', !/^\s*[A-Z_]+=\S+/m.test(ex.replace(/^#.*$/gm, '')));
  check('.env.example keeps the service-role key un-prefixed', /^SUPABASE_SERVICE_ROLE_KEY=/m.test(ex) && !/NEXT_PUBLIC_\w*SERVICE/i.test(ex));
}

process.exit(bad ? 1 : 0);
