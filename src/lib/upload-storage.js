import fs from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

function hasFile(filepath) {
    return fs.existsSync(filepath);
}

function isProjectRoot(dir) {
    const hasAppDir =
        hasFile(path.join(dir, 'src', 'app')) ||
        hasFile(path.join(dir, 'app'));
    const hasNextConfig =
        hasFile(path.join(dir, 'next.config.mjs')) ||
        hasFile(path.join(dir, 'next.config.js')) ||
        hasFile(path.join(dir, 'next.config.ts'));
    const hasForumDb = hasFile(path.join(dir, 'data', 'forum.db'));

    return hasAppDir && hasNextConfig && hasForumDb;
}

export function resolveProjectRoot() {
    const cwd = process.cwd();
    if (isProjectRoot(cwd)) {
        return cwd;
    }

    const __filename = fileURLToPath(import.meta.url);
    let currentDir = path.dirname(__filename);

    while (true) {
        if (isProjectRoot(currentDir)) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }

    return cwd;
}

export function sanitizeUploadFilename(rawFilename) {
    if (!rawFilename) return null;

    const decoded = decodeURIComponent(rawFilename);
    const safeFilename = path.basename(decoded);

    if (!safeFilename || safeFilename === '.' || safeFilename !== decoded) {
        return null;
    }

    return safeFilename;
}

export function buildUploadUrl(filename) {
    return `/api/upload/files/${encodeURIComponent(filename)}`;
}

export function extractUploadFilenameFromUrl(imageUrl) {
    if (!imageUrl) return null;

    const match = imageUrl.match(/\/(?:uploads|api\/upload\/files)\/([^/?#]+)/i);
    if (!match) {
        return null;
    }

    return sanitizeUploadFilename(match[1]);
}

export function getUploadStorageDir() {
    return path.join(resolveProjectRoot(), 'data', 'uploads');
}

export async function ensureUploadStorageDir() {
    const uploadDir = getUploadStorageDir();
    await mkdir(uploadDir, { recursive: true });
    return uploadDir;
}

export function resolveStoredUploadPath(filename) {
    const safeFilename = sanitizeUploadFilename(filename);
    if (!safeFilename) {
        return null;
    }

    const projectRoot = resolveProjectRoot();
    const candidatePaths = [
        path.join(projectRoot, 'data', 'uploads', safeFilename),
        path.join(projectRoot, 'public', 'uploads', safeFilename),
        path.join(path.dirname(projectRoot), 'public', 'uploads', safeFilename),
    ];

    return candidatePaths.find((candidatePath) => hasFile(candidatePath)) || null;
}

export function getContentTypeByFilename(filename) {
    const ext = path.extname(filename).toLowerCase();

    switch (ext) {
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        case '.pdf':
            return 'application/pdf';
        case '.txt':
            return 'text/plain; charset=utf-8';
        default:
            return 'application/octet-stream';
    }
}
