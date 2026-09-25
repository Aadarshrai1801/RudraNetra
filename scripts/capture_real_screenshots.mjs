// Automated Screenshot Capturer using Chrome Headless
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = resolve(__dirname, '../assets/screenshots');

const pagesToCapture = [
  { name: 'vehicle.png', url: 'http://localhost:3000/vehicles', waitMs: 4000 },
  { name: 'teltonika.png', url: 'http://localhost:3000/vehicles?modal=teltonika', waitMs: 4000 },
  { name: 'dashboard.png', url: 'http://localhost:3000/dashboard', waitMs: 3000 },
  { name: 'playback.png', url: 'http://localhost:3000/playback', waitMs: 4000 },
  { name: 'geofences.png', url: 'http://localhost:3000/geofences', waitMs: 3000 },
  { name: 'fleet.png', url: 'http://localhost:3000/fleet', waitMs: 3000 },
  { name: 'alerts.png', url: 'http://localhost:3000/alerts', waitMs: 3000 },
  { name: 'reports.png', url: 'http://localhost:3000/reports', waitMs: 3000 },
  { name: 'devices.png', url: 'http://localhost:3000/devices', waitMs: 3000 },
  { name: 'settings.png', url: 'http://localhost:3000/settings', waitMs: 3000 },
  { name: 'listview.png', url: 'http://localhost:3000/list', waitMs: 3000 },
  { name: 'login.png', url: 'http://localhost:3000/login', waitMs: 2000 },
  { name: 'admin.png', url: 'http://localhost:3001', waitMs: 3000 },
];

console.log('Capturing real application screenshots via headless Chrome (1920x1080)...');

for (const p of pagesToCapture) {
  const outputPath = resolve(OUTPUT_DIR, p.name);
  if (existsSync(outputPath)) {
    try { unlinkSync(outputPath); } catch (e) {}
  }

  console.log(`- Capturing ${p.name} from ${p.url}...`);
  const res = spawnSync(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--window-size=1920,1080',
      `--virtual-time-budget=${p.waitMs}`,
      `--screenshot=${outputPath}`,
      p.url,
    ],
    { stdio: 'pipe' }
  );

  if (existsSync(outputPath)) {
    console.log(`  ✓ Successfully captured ${p.name}`);
  } else {
    console.error(`  ✗ Failed to capture ${p.name}: ${res.stderr.toString().slice(0, 150)}`);
  }
}

// Clean up temporary test files
const tempTestFiles = ['chrome_test.png', 'chrome_test_rendered.png', 'real_test.png', 'test_screenshot.png'];
for (const tf of tempTestFiles) {
  const p = resolve(OUTPUT_DIR, tf);
  if (existsSync(p)) {
    try { unlinkSync(p); } catch (e) {}
  }
}

console.log('Finished capturing all real application screenshots!');
