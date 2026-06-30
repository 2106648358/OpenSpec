import type { CodeLocation, TraceabilityIndex, TraceabilityMapping } from './schema.js';

function locationKey(location: CodeLocation): string {
  return `${location.file}\0${location.symbol}\0${location.line ?? ''}`;
}

function referenceFor(mapping: TraceabilityMapping): string {
  return `${mapping.capability}/${mapping.requirement}`;
}

export function dedupeLocations(locations: CodeLocation[]): CodeLocation[] {
  const seen = new Set<string>();
  const result: CodeLocation[] = [];

  for (const location of locations) {
    const key = locationKey(location);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(location);
    }
  }

  return result;
}

function addReverseReference(index: TraceabilityIndex, location: CodeLocation, ref: string): void {
  index.reverse[location.file] ??= {};
  index.reverse[location.file][location.symbol] ??= { implements: [] };

  const refs = new Set(index.reverse[location.file][location.symbol].implements);
  refs.add(ref);
  index.reverse[location.file][location.symbol].implements = [...refs].sort();
}

function removeReverseReference(index: TraceabilityIndex, location: CodeLocation, ref: string): void {
  const symbolRefs = index.reverse[location.file]?.[location.symbol];
  if (!symbolRefs) {
    return;
  }

  symbolRefs.implements = symbolRefs.implements.filter(existing => existing !== ref);
  if (symbolRefs.implements.length > 0) {
    return;
  }

  delete index.reverse[location.file][location.symbol];
  if (Object.keys(index.reverse[location.file]).length === 0) {
    delete index.reverse[location.file];
  }
}

export function mergeMapping(index: TraceabilityIndex, mapping: TraceabilityMapping): void {
  const ref = referenceFor(mapping);
  const newLocations = dedupeLocations(mapping.codeLocations);

  if (mapping.type === 'touch') {
    for (const location of newLocations) {
      addReverseReference(index, location, ref);
    }
    return;
  }

  const oldCurrent = index.forward[mapping.capability]?.[mapping.requirement]?.current ?? [];
  index.forward[mapping.capability] ??= {};
  index.forward[mapping.capability][mapping.requirement] = { current: newLocations };

  for (const location of oldCurrent) {
    removeReverseReference(index, location, ref);
  }

  for (const location of newLocations) {
    addReverseReference(index, location, ref);
  }
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function normalizeIndex(index: TraceabilityIndex): TraceabilityIndex {
  const forward: TraceabilityIndex['forward'] = {};
  for (const [capability, requirements] of Object.entries(sortRecord(index.forward))) {
    forward[capability] = {};
    for (const [requirement, value] of Object.entries(sortRecord(requirements))) {
      forward[capability][requirement] = {
        current: [...value.current].sort((a, b) => locationKey(a).localeCompare(locationKey(b))),
      };
    }
  }

  const reverse: TraceabilityIndex['reverse'] = {};
  for (const [file, symbols] of Object.entries(sortRecord(index.reverse))) {
    reverse[file] = {};
    for (const [symbol, value] of Object.entries(sortRecord(symbols))) {
      reverse[file][symbol] = { implements: [...new Set(value.implements)].sort() };
    }
  }

  return { ...index, forward, reverse };
}

export function mergeTraceabilityIndex(
  index: TraceabilityIndex,
  mappings: TraceabilityMapping[],
  lastUpdated: string
): TraceabilityIndex {
  const next: TraceabilityIndex = structuredClone(index);
  for (const mapping of mappings) {
    mergeMapping(next, mapping);
  }

  next.lastUpdated = lastUpdated;
  return normalizeIndex(next);
}
