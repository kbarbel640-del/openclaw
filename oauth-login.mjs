#!/usr/bin/env node
import { loginAnthropic } from '@mariozechner/pi-ai';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const CREDENTIALS_DIR = path.join(process.env.HOME, '.clawdis', 'credentials');
const OAUTH_FILE = path.join(CREDENTIALS_DIR, 'oauth.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

async function main() {
  console.log('\n🔐 Anthropic OAuth Login\n');

  const credentials = await loginAnthropic(
    (url) => {
      console.log('Open this URL in your browser:\n');
      console.log(url);
      console.log('\nAfter authorizing, paste the CODE#STATE value below.\n');
    },
    async () => {
      const code = await prompt('Paste code here: ');
      return code.trim();
    }
  );

  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(OAUTH_FILE, JSON.stringify({ anthropic: credentials }, null, 2) + '\n');
  fs.chmodSync(OAUTH_FILE, 0o600);

  console.log('\n✅ Saved to', OAUTH_FILE);
  rl.close();
}

main().catch(e => { console.error('Error:', e.message); rl.close(); process.exit(1); });
