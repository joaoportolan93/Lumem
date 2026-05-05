#!/usr/bin/env node
/**
 * update-baseline.js — Atualiza o baseline.json com as métricas atuais
 *
 * Rode MANUALMENTE apenas quando quiser avançar o baseline após uma melhoria.
 * NUNCA rode este script automaticamente no CI — ele só deve ser executado
 * localmente por um humano ou após uma decisão consciente de avançar a catraca.
 *
 * Uso: node scripts/update-baseline.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'baseline.json');
const REPORTS_DIR = path.join(ROOT, '.quality-reports');

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
};

// Importa as mesmas funções de leitura do quality-gate.js
// (duplicado intencionalmente para manter os scripts independentes)

function readEslintViolations() {
  const report = readJson(path.join(REPORTS_DIR, 'eslint.json'));
  if (!report) return null;
  return report.reduce((acc, file) => acc + file.errorCount + file.warningCount, 0);
}

function readJestCoverage() {
  const summary = readJson(path.join(REPORTS_DIR, 'jest-coverage', 'coverage-summary.json'));
  if (!summary || !summary.total) return null;
  const { lines, statements, functions, branches } = summary.total;
  return Math.round(((lines.pct + statements.pct + functions.pct + branches.pct) / 4) * 100) / 100;
}

function readDuplication() {
  const report = readJson(path.join(REPORTS_DIR, 'jscpd-report.json'));
  if (!report || !report.statistics) return null;
  return Math.round(report.statistics.total.percentage * 100) / 100;
}

function readPythonCoverage() {
  const report = readJson(path.join(REPORTS_DIR, 'python-coverage.json'));
  if (!report) return null;
  return Math.round(report.totals.percent_covered * 100) / 100;
}

function readFlake8Violations() {
  const reportPath = path.join(REPORTS_DIR, 'flake8.txt');
  if (!fs.existsSync(reportPath)) return null;
  const lines = fs.readFileSync(reportPath, 'utf8').trim().split('\n');
  return lines.filter((l) => l.trim().length > 0).length;
}

function readPipAudit() {
  const report = readJson(path.join(REPORTS_DIR, 'pip-audit.json'));
  if (!report) return null;
  return (report.vulnerabilities || []).filter(
    (v) => v.fix_versions && v.fix_versions.length > 0
  ).length;
}

function readNpmAudit() {
  const report = readJson(path.join(REPORTS_DIR, 'npm-audit.json'));
  if (!report) return null;
  return (report.metadata?.vulnerabilities?.critical) || 0;
}

// ── Main ──────────────────────────────────────────────────────
console.log('\n📐 Atualizando baseline.json com as métricas atuais...\n');

const existing = readJson(BASELINE_PATH) || {};

const metrics = {
  _meta: {
    description: existing._meta?.description || 'Métricas congeladas do Quality Gate do Lumem.',
    updatedAt: new Date().toISOString(),
    updatedBy: process.env.GITHUB_ACTOR || process.env.USERNAME || 'local',
  },
  backend: {
    flake8: {
      violations: readFlake8Violations() ?? existing.backend?.flake8?.violations ?? 9999,
      description: 'Número máximo de violações do flake8. Não pode aumentar.',
    },
    coverage: {
      percentage: readPythonCoverage() ?? existing.backend?.coverage?.percentage ?? 0,
      description: 'Cobertura mínima de testes (%). Não pode diminuir.',
    },
    pylint: {
      score: existing.backend?.pylint?.score ?? 0.0,
      description: 'Score mínimo do pylint (0-10). Não pode diminuir.',
    },
  },
  frontend: {
    eslint: {
      violations: readEslintViolations() ?? existing.frontend?.eslint?.violations ?? 9999,
      description: 'Número máximo de violações do ESLint. Não pode aumentar.',
    },
    coverage: {
      percentage: readJestCoverage() ?? existing.frontend?.coverage?.percentage ?? 0,
      description: 'Cobertura mínima de testes Jest (%). Não pode diminuir.',
    },
    duplication: {
      percentage: readDuplication() ?? existing.frontend?.duplication?.percentage ?? 100,
      description: 'Percentual máximo de duplicação de código (jscpd). Não pode aumentar.',
    },
  },
  security: {
    pip_audit: {
      criticalVulnerabilities: readPipAudit() ?? existing.security?.pip_audit?.criticalVulnerabilities ?? 9999,
      description: 'Número máximo de vulnerabilidades críticas no Python.',
    },
    npm_audit: {
      criticalVulnerabilities: readNpmAudit() ?? existing.security?.npm_audit?.criticalVulnerabilities ?? 9999,
      description: 'Número máximo de vulnerabilidades críticas no npm.',
    },
  },
};

fs.writeFileSync(BASELINE_PATH, JSON.stringify(metrics, null, 2) + '\n');

console.log('Baseline atualizado:');
console.log(`  🐍 Flake8 violações:        ${metrics.backend.flake8.violations}`);
console.log(`  🐍 Python coverage:         ${metrics.backend.coverage.percentage}%`);
console.log(`  ⚛️  ESLint violações:        ${metrics.frontend.eslint.violations}`);
console.log(`  ⚛️  Jest coverage:           ${metrics.frontend.coverage.percentage}%`);
console.log(`  ⚛️  Duplicação:              ${metrics.frontend.duplication.percentage}%`);
console.log(`  🔒 pip-audit críticos:      ${metrics.security.pip_audit.criticalVulnerabilities}`);
console.log(`  🔒 npm-audit críticos:      ${metrics.security.npm_audit.criticalVulnerabilities}`);
console.log('\n✅ baseline.json salvo. Faça commit: git add baseline.json');
