import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function userDataDir(): string {
  return app.getPath('userData');
}

export function defaultCsvDir(): string {
  return path.join(userDataDir(), 'exports');
}

export function imagesDir(): string {
  return path.join(userDataDir(), 'images');
}

export function dbPath(): string {
  return path.join(userDataDir(), 'pos.db');
}

export function ensureDirs(csvDir: string): void {
  fs.mkdirSync(imagesDir(), { recursive: true });
  fs.mkdirSync(csvDir, { recursive: true });
}

export function imagePath(filename: string): string {
  return path.join(imagesDir(), path.basename(filename));
}

export function copyImage(sourcePath: string, id: string): string {
  const ext = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error('Image must be jpg, png, webp, or gif');
  const stat = fs.statSync(sourcePath);
  if (stat.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 10MB');
  const filename = `${id}${ext}`;
  fs.copyFileSync(sourcePath, imagePath(filename));
  return filename;
}

export function removeImage(filename: string | null): void {
  if (!filename) return;
  const full = imagePath(filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export function writeCsv(dir: string, name: string, contents: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, name);
  fs.writeFileSync(full, contents, 'utf8');
  return full;
}

export function readCsv(dir: string, name: string): string {
  const full = path.join(dir, path.basename(name));
  if (path.dirname(full) !== path.resolve(dir)) {
    throw new Error('Invalid file path');
  }
  return fs.readFileSync(full, 'utf8');
}

export function deleteCsv(dir: string, name: string): void {
  const full = path.join(dir, path.basename(name));
  if (path.dirname(full) !== path.resolve(dir)) {
    throw new Error('Invalid file path');
  }
  fs.unlinkSync(full);
}

export function listCsvFiles(
  dir: string,
): { name: string; createdAt: string; size: number }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return {
        name,
        createdAt: stat.mtime.toISOString(),
        size: stat.size,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function csvTypeFromName(
  name: string,
): 'sales' | 'capital' | 'products' | 'unknown' {
  const lower = name.toLowerCase();
  if (lower.startsWith('sales')) return 'sales';
  if (lower.startsWith('capital')) return 'capital';
  if (lower.startsWith('products')) return 'products';
  return 'unknown';
}
