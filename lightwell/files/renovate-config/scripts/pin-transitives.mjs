#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RHLW = /[.-]rhlw-/;
const TREE = "dependency-tree.json";
const PINS = "lightwell-pins.xml";
const TREE_GOAL = "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:tree";
const DEFAULT_MVN = `mvn -B -Dstyle.color=never ${TREE_GOAL} -DoutputType=json -DoutputFile=${TREE}`;
const DEFAULT_RENOVATE = "--platform=local --onboarding=false --dry-run=lookup";

function usage() {
  return `Usage: node scripts/pin-transitives.mjs [options]

Runs Maven, then Renovate, and lists rhlw updates. Uses the repo's Renovate
config. --write writes a BOM for dependencyManagement (default: ${PINS}).
Pins already at an rhlw version stay while they remain in the tree. The BOM
version bumps only when that set changes.

Maven must write a JSON tree. Default:

  ${DEFAULT_MVN}

Renovate default:

  renovate ${DEFAULT_RENOVATE}

If you pass --mvn, include the same JSON flags.

Options:
  --mvn <command>       Full mvn command
  --renovate <command>  Full renovate command
  --write [file]        Write a BOM next to pom.xml
  --help                Show this help`;
}

function parseArgs(argv) {
  const opts = { mvn: DEFAULT_MVN, write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mvn") {
      opts.mvn = argv[++i];
    } else if (arg === "--renovate") {
      opts.renovate = argv[++i];
    } else if (arg === "--write") {
      opts.write = true;
      if (argv[i + 1] && !argv[i + 1].startsWith("-")) {
        opts.file = argv[++i];
      }
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }
  return opts;
}

function sh(command, cwd, extra = {}) {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ...extra.env },
    stdio: extra.stdio,
  });
  if (result.error) {
    throw new Error(`Failed to run: ${command}\n${result.error.message}`);
  }
  return result;
}

function quote(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function findRenovate() {
  for (const start of [".", import.meta.dirname]) {
    let dir = path.resolve(start);
    while (true) {
      const bin = path.join(dir, "node_modules", ".bin", "renovate");
      if (fs.existsSync(bin)) {
        return bin;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  throw new Error("Renovate not found. Install it or pass --renovate.");
}

function parseTree(text) {
  const deps = [];
  const seen = new Set();
  function walk(node, depth) {
    if (depth > 0 && node.groupId && node.artifactId && node.version && node.scope !== "test") {
      const name = `${node.groupId}:${node.artifactId}`;
      if (!seen.has(name)) {
        seen.add(name);
        deps.push({
          groupId: node.groupId,
          artifactId: node.artifactId,
          version: node.version,
          direct: depth === 1,
          name,
        });
      }
    }
    for (const child of node.children ?? []) {
      walk(child, depth + 1);
    }
  }
  const tree = JSON.parse(text);
  for (const node of [].concat(tree)) {
    walk(node, 0);
  }
  return deps;
}

function xmlDeps(deps, pad) {
  return deps
    .map(
      (d) => `${pad}<dependency>
${pad}  <groupId>${d.groupId}</groupId>
${pad}  <artifactId>${d.artifactId}</artifactId>
${pad}  <version>${d.version}</version>
${pad}</dependency>`,
    )
    .join("\n");
}

function scanPom(deps) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>lightwell</groupId>
  <artifactId>pin-scan</artifactId>
  <version>0.0.0</version>
  <dependencies>
${xmlDeps(deps, "    ")}
  </dependencies>
</project>
`;
}

function pinPom(pins) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.lightwell</groupId>
  <artifactId>rhlw-pins</artifactId>
  <version>0.0.1</version>
  <packaging>pom</packaging>
  <dependencyManagement>
    <dependencies>
${xmlDeps(pins, "      ")}
    </dependencies>
  </dependencyManagement>
</project>
`;
}

function updatePinFile(xml, pins) {
  const open = xml.indexOf("<dependencyManagement");
  const close = xml.indexOf("</dependencyManagement>", open);
  if (open === -1 || close === -1) {
    throw new Error("Pin file has no <dependencyManagement>");
  }
  const inner = xml.indexOf(">", open) + 1;
  const head = xml.slice(0, inner).replace(/<version>([^<]*)<\/version>(?![\s\S]*<version>)/, (_, v) => {
    const next = v.trim().replace(/(\d+)(?!.*\d)/, (n) => String(Number(n) + 1));
    return `<version>${next}</version>`;
  });
  return `${head}\n    <dependencies>\n${xmlDeps(pins, "      ")}\n    </dependencies>\n  ${xml.slice(close)}`;
}

function parsePinDeps(xml) {
  const body = xml.slice(xml.indexOf("<dependencyManagement"));
  const deps = [];
  const re =
    /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>\s*<\/dependency>/g;
  for (const match of body.matchAll(re)) {
    const groupId = match[1].trim();
    const artifactId = match[2].trim();
    deps.push({ groupId, artifactId, version: match[3].trim(), name: `${groupId}:${artifactId}` });
  }
  return deps.sort((a, b) => a.name.localeCompare(b.name));
}

function mergePins(existing, updates, treeDeps) {
  const inTree = new Set(treeDeps.map((dep) => dep.name));
  const byName = new Map();
  for (const dep of existing) {
    if (inTree.has(dep.name)) {
      byName.set(dep.name, dep);
    }
  }
  for (const update of updates) {
    if (!inTree.has(update.depName)) {
      continue;
    }
    const [groupId, artifactId] = update.depName.split(":");
    byName.set(update.depName, {
      groupId,
      artifactId,
      version: update.newValue,
      name: update.depName,
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function samePins(left, right) {
  return left.length === right.length && left.every((dep, i) => dep.name === right[i].name && dep.version === right[i].version);
}

function extractUpdates(log) {
  const line = log.split("\n").find((l) => l.includes("packageFiles with updates"));
  if (!line) {
    throw new Error(
      `Renovate did not report packageFiles with updates.\n${log.split("\n").slice(-20).join("\n")}`,
    );
  }
  return Object.values(JSON.parse(line).config)
    .flatMap((group) => group.flatMap((file) => file.deps))
    .flatMap((dep) => {
      const newValue = dep.updates?.[0]?.newValue;
      return newValue && RHLW.test(newValue)
        ? [{ depName: dep.depName, currentValue: dep.currentValue, newValue }]
        : [];
    });
}

function section(title, items) {
  const lines = items.map((u) => {
    const change = u.currentValue && u.currentValue !== u.newValue ? `${u.currentValue} → ${u.newValue}` : u.newValue;
    return `  ${u.depName}  ${change}`;
  });
  return `${title} (${items.length})\n${lines.join("\n") || "  none"}`;
}

function workDir(tmp) {
  return [
    `Temporary files (not deleted): ${tmp}`,
    `  Maven tree:   ${path.join(tmp, TREE)}`,
    `  Renovate pom: ${path.join(tmp, "pom.xml")}`,
    `  Renovate log: ${path.join(tmp, "renovate.ndjson")}`,
  ].join("\n");
}

function main() {
  let tmp;
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(usage());
      return;
    }
    const cwd = path.resolve(".");
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lightwell-pin-"));
    const mvn =
      opts.mvn === DEFAULT_MVN
        ? `mvn -B -Dstyle.color=never ${TREE_GOAL} -DoutputType=json -DoutputFile=${quote(path.join(tmp, TREE))}`
        : opts.mvn;
    const mvnResult = sh(mvn, cwd);
    if (mvnResult.status !== 0) {
      throw new Error(`${mvn} failed (${mvnResult.status}):\n${mvnResult.stdout ?? ""}\n${mvnResult.stderr ?? ""}`);
    }
    const produced = path.resolve(cwd, mvn.match(/-DoutputFile=(\S+)/)?.[1] ?? path.join(tmp, TREE));
    const treeFile = path.join(tmp, TREE);
    if (!fs.existsSync(produced)) {
      throw new Error(
        `Maven JSON tree not found at ${produced}. Include:\n  dependency:tree -DoutputType=json -DoutputFile=${TREE}`,
      );
    }
    if (produced !== treeFile) {
      fs.copyFileSync(produced, treeFile);
    }
    const deps = parseTree(fs.readFileSync(treeFile, "utf8"));
    if (deps.length === 0) {
      throw new Error("Resolved dependency tree is empty");
    }
    fs.writeFileSync(path.join(tmp, "pom.xml"), scanPom(deps));
    for (const name of ["renovate.json", "renovate.json5", ".renovaterc.json"]) {
      if (fs.existsSync(name)) {
        fs.copyFileSync(name, path.join(tmp, name));
      }
    }
    const logFile = path.join(tmp, "renovate.ndjson");
    const renovate = opts.renovate || `${quote(findRenovate())} ${DEFAULT_RENOVATE}`;
    const renovateResult = sh(renovate, tmp, {
      env: {
        LOG_LEVEL: "debug",
        RENOVATE_LOG_FILE: logFile,
        RENOVATE_TOKEN: process.env.RENOVATE_TOKEN || "local",
      },
      stdio: ["ignore", "ignore", "inherit"],
    });
    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
    let updates;
    try {
      updates = extractUpdates(log);
    } catch (err) {
      throw new Error(`${err.message}\nRenovate exited ${renovateResult.status}\nLog: ${logFile}`);
    }
    const directNames = new Set(deps.filter((d) => d.direct).map((d) => d.name));
    const byName = (a, b) => a.depName.localeCompare(b.depName);
    const directs = updates.filter((u) => directNames.has(u.depName)).sort(byName);
    const transitives = updates.filter((u) => !directNames.has(u.depName)).sort(byName);
    console.log(`Resolved ${deps.length} dependencies (${directNames.size} direct)\n`);
    console.log(`${section("Direct dependencies", directs)}\n\n${section("Transitive dependencies", transitives)}`);
    const out = path.resolve(cwd, opts.file ?? PINS);
    const existingXml = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
    const previous = existingXml ? parsePinDeps(existingXml) : [];
    const pins = mergePins(previous, updates, deps);
    if (opts.write) {
      if (existingXml && samePins(previous, pins)) {
        console.log("\nBOM unchanged.");
      } else if (pins.length === 0) {
        console.log("\nNo BOM to write.");
      } else {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const next = existingXml ? updatePinFile(existingXml, pins) : pinPom(pins);
        fs.writeFileSync(out, next);
        console.log(`\nWrote ${out}`);
      }
    } else if (updates.length > 0) {
      console.log("\nBOM not written. Re-run with --write to generate it.");
    }
    console.log(`\n${workDir(tmp)}`);
  } catch (err) {
    console.error(tmp ? `${err.message}\n${workDir(tmp)}` : err.message);
    process.exit(1);
  }
}

main();