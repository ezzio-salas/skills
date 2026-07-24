#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const skippedDirectories = new Set([".git", "node_modules", "media"]);
const scannedExtensions = new Set([
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".yaml",
  ".yml",
]);

// High-confidence credential shapes. Generic `key = "..."` assignments are
// deliberately excluded: in a docs-heavy repo they produce more noise than
// signal, and noise is what makes a scanner get switched off.
const rules = [
  { name: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "Stripe secret key", pattern: /\b[rs]k_live_[A-Za-z0-9]{16,}\b/g },
  {
    name: "private key block",
    pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g,
  },
];

// Documentation has to be able to show a redacted key without tripping the
// scanner, so anything that reads as an obvious stand-in is not a finding.
const placeholderMarkers = [
  /[•*]{3,}/,
  /x{6,}/i,
  /\b(?:redacted|placeholder|example|sample|dummy|fake|test)\b/i,
  /\byour[-_]/i,
  /\b(?:abc123|1234567890)\b/i,
];

function isPlaceholder(match) {
  return placeholderMarkers.some((marker) => marker.test(match));
}

async function collectFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skippedDirectories.has(entry.name)) continue;

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectFiles(absolute)));
    } else if (entry.isFile() && scannedExtensions.has(path.extname(entry.name))) {
      found.push(absolute);
    }
  }
  return found;
}

export function scanContent(content, label) {
  const findings = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      for (const match of line.matchAll(rule.pattern)) {
        if (isPlaceholder(match[0])) continue;
        findings.push({
          label,
          line: index + 1,
          rule: rule.name,
          preview: `${match[0].slice(0, 12)}…`,
        });
      }
    }
  });

  return findings;
}

async function main() {
  const args = process.argv.slice(2);
  const targets =
    args.length > 0
      ? args.map((arg) => path.resolve(arg))
      : await collectFiles(repoRoot);

  const findings = [];
  for (const target of targets) {
    const content = await readFile(target, "utf8");
    findings.push(...scanContent(content, path.relative(repoRoot, target)));
  }

  if (findings.length > 0) {
    console.error("Potential secrets found:");
    for (const finding of findings) {
      console.error(
        `- ${finding.label}:${finding.line}: ${finding.rule} (${finding.preview})`,
      );
    }
    console.error(
      "\nRedact these before publishing content to a hosted Plan or committing.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Scanned ${targets.length} files; no secrets found`);
}

await main();
