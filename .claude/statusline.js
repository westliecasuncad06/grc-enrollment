#!/usr/bin/env node
/**
 * Claude Code statusline: renders this project's live completion percentage
 * straight from PROGRESS.md's "# ■ Overall Completion — NN%" heading, plus
 * branch and model. Never throws — any failure degrades to a shorter line
 * rather than breaking the status bar.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function resolveProjectDir(input) {
  return (
    input?.workspace?.project_dir ||
    input?.workspace?.current_dir ||
    input?.cwd ||
    process.cwd()
  );
}

function readCompletionPercent(projectDir) {
  const progressPath = path.join(projectDir, "PROGRESS.md");
  const text = fs.readFileSync(progressPath, "utf8");
  const match = text.match(/Overall Completion\s*—\s*(\d+)%/u);
  if (!match) return null;
  return Math.max(0, Math.min(100, parseInt(match[1], 10)));
}

function renderBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function currentBranch(projectDir) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function main() {
  const input = readStdin();
  const projectDir = resolveProjectDir(input);
  const modelName = input?.model?.display_name || input?.model?.id || "Claude";
  const branch = currentBranch(projectDir);

  let segment;
  try {
    const percent = readCompletionPercent(projectDir);
    segment =
      percent === null
        ? "GRC ?%"
        : `GRC ${percent}% ${renderBar(percent)}`;
  } catch {
    segment = "GRC ?%";
  }

  const parts = [segment];
  if (branch) parts.push(branch);
  parts.push(modelName);

  process.stdout.write(parts.join(" · "));
}

main();
