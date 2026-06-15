// Journey validation — the counterpart to validateManifest() for authored
// journey data. Journeys are hand-written (200+ lines each) and reference module
// types, instance ids, ports and connection ids as bare strings that nothing
// else cross-checks: a typo (`toPort: "levle"`) silently produces a dead wire
// rather than an error. This walks every journey at startup and throws loudly on
// the first inconsistency, the same way a malformed manifest crashes import.
//
// Lives in its own file (not journeys/index.js) so it can import the module
// registry without creating an import cycle — the store imports journeys/index,
// and the registry transitively imports the store.

import { byType } from "../../modules/_registry.js";
import { listStaticPorts, PORT_DIR } from "../../audio/graph/types.js";
import { JOURNEYS } from "./index.js";

// Every module instance a journey declares: its initialPatch plus every
// chapter's adds.modules → Map of id → type. (Re-adds across chapters collapse;
// the chapter-delta system makes those idempotent.)
function collectModules(journey) {
  const map = new Map();
  const add = (mods) => {
    for (const m of mods || []) if (m && m.id) map.set(m.id, m.type);
  };
  add(journey.initialPatch?.modules);
  for (const ch of journey.chapters || []) add(ch.adds?.modules);
  return map;
}

// Every connection id a journey defines (initialPatch + all chapter adds) — so
// removeConnections can be checked against something real.
function collectConnectionIds(journey) {
  const ids = new Set();
  for (const c of journey.initialPatch?.connections || []) if (c?.id) ids.add(c.id);
  for (const ch of journey.chapters || []) {
    for (const c of ch.adds?.connections || []) if (c?.id) ids.add(c.id);
  }
  return ids;
}

// in/out port-name sets for a module type, including the CV inputs that
// listStaticPorts auto-derives from CONTROLS. null if the type is unknown.
const _portCache = new Map();
function portSets(type) {
  if (_portCache.has(type)) return _portCache.get(type);
  const manifest = byType(type);
  const sets = manifest && {
    out: new Set(listStaticPorts(manifest.Cls).filter((p) => p.dir === PORT_DIR.OUT).map((p) => p.name)),
    in:  new Set(listStaticPorts(manifest.Cls).filter((p) => p.dir === PORT_DIR.IN).map((p) => p.name)),
  };
  _portCache.set(type, sets || null);
  return sets || null;
}

export function validateJourney(journey) {
  const errs = [];
  const modules = collectModules(journey);
  const connIds = collectConnectionIds(journey);

  // 1. Every declared module is a known type.
  for (const [id, type] of modules) {
    if (!byType(type)) errs.push(`module "${id}" has unknown type "${type}"`);
  }

  // 2. Connections reference real endpoints + real ports of the right direction.
  const checkConn = (c, ctx) => {
    if (!c) return;
    const fromType = modules.get(c.fromId);
    const toType   = modules.get(c.toId);
    if (fromType === undefined) errs.push(`${ctx}: connection "${c.id}" fromId "${c.fromId}" is not a module in this journey`);
    if (toType   === undefined) errs.push(`${ctx}: connection "${c.id}" toId "${c.toId}" is not a module in this journey`);
    const fromPorts = fromType !== undefined && portSets(fromType);
    const toPorts   = toType   !== undefined && portSets(toType);
    if (fromPorts && !fromPorts.out.has(c.fromPort))
      errs.push(`${ctx}: connection "${c.id}" fromPort "${c.fromPort}" is not an output of "${c.fromId}" (${fromType})`);
    if (toPorts && !toPorts.in.has(c.toPort))
      errs.push(`${ctx}: connection "${c.id}" toPort "${c.toPort}" is not an input of "${c.toId}" (${toType})`);
  };
  for (const c of journey.initialPatch?.connections || []) checkConn(c, "initialPatch");

  // 3. Per-chapter: connections + id references in setParams/setPositions/removes.
  for (const ch of journey.chapters || []) {
    const ctx = `chapter "${ch.id}"`;
    const adds = ch.adds;
    if (!adds) continue;
    for (const c of adds.connections || []) checkConn(c, ctx);
    for (const id of Object.keys(adds.setParams || {}))
      if (!modules.has(id)) errs.push(`${ctx}: setParams targets unknown module id "${id}"`);
    for (const id of Object.keys(adds.setPositions || {}))
      if (!modules.has(id)) errs.push(`${ctx}: setPositions targets unknown module id "${id}"`);
    for (const id of adds.removeModules || [])
      if (!modules.has(id)) errs.push(`${ctx}: removeModules targets unknown module id "${id}"`);
    for (const cid of adds.removeConnections || [])
      if (!connIds.has(cid)) errs.push(`${ctx}: removeConnections targets unknown connection id "${cid}"`);
  }

  // 4. Puzzle config (optional) references declared ids + real port names.
  if (journey.puzzle) {
    const { anchor, modules: pm = {} } = journey.puzzle;
    if (anchor && !modules.has(anchor)) errs.push(`puzzle.anchor "${anchor}" is not a module in this journey`);
    for (const [id, cfg] of Object.entries(pm)) {
      const type = modules.get(id);
      if (type === undefined) { errs.push(`puzzle.modules["${id}"] is not a module in this journey`); continue; }
      const sets = portSets(type);
      if (!sets) continue;
      for (const name of cfg.ports || [])
        if (!sets.in.has(name) && !sets.out.has(name))
          errs.push(`puzzle.modules["${id}"].ports lists "${name}", not a port of ${type}`);
    }
  }

  if (errs.length) {
    throw new Error(`[journeys] "${journey?.id ?? "?"}" is invalid:\n  - ${errs.join("\n  - ")}`);
  }
}

// Run at startup (imported for side effect by main.jsx), mirroring the manifest
// validation that runs when the registry is imported.
for (const j of JOURNEYS) validateJourney(j);
