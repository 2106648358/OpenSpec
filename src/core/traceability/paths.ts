import path from 'path';

export function getChangeTraceabilityPath(changeDir: string): string {
  return path.join(changeDir, 'tasks', 'traceability.json');
}

export function getTraceabilityIndexDir(openspecRoot: string): string {
  return path.join(openspecRoot, 'openspec', '.traceability');
}

export function getTraceabilityIndexPath(openspecRoot: string): string {
  return path.join(getTraceabilityIndexDir(openspecRoot), 'index.json');
}

export function isSafeRelativeFilePath(filePath: string): boolean {
  if (path.isAbsolute(filePath)) {
    return false;
  }

  const normalized = path.normalize(filePath);
  return normalized !== '..' && !normalized.startsWith(`..${path.sep}`) && normalized !== '.';
}
