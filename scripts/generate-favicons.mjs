import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0a0a0f" rx="6"/>
  <text x="32" y="48" text-anchor="middle" font-family="Courier New, monospace" font-size="44" font-weight="700" fill="#44aaff" letter-spacing="-2">AZ</text>
</svg>`;

mkdirSync(PUBLIC_DIR, { recursive: true });
writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), svg);

try {
  const { default: sharp } = await import('sharp');
  for (const size of [16, 32, 180]) {
    const filename = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(join(PUBLIC_DIR, filename));
  }
  console.log('Generated favicon PNGs');
} catch (err) {
  console.warn('sharp unavailable:', err.message);
}
