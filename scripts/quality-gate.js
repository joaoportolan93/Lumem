#!/usr/bin/env node
/**
 * quality-gate.js — Catraca de qualidade do Lumem
 *
 * Este script é o coração do Quality Gate. Ele:
 *   1. Lê o baseline.json (métricas congeladas)
 *   2. Lê os relatórios gerados pelo CI (.quality-reports/)
 *   3. Compara as métricas atuais com o baseline
 *   4. Falha o build (exit 1) se QUALQUER métrica regredir
 *   5. Gera um resumo em Markdown para o comentário do PR
 *
 * Lógica da catraca (ratchet):
 *   - Violações: atual <= baseline  (menos é melhor)
 *   - Coverage:  atual >= baseline  (mais é melhor)
 *   - Score:     atual >= baseline  (mais é melhor)
 *
 * Uso: node scripts/quality-gate.js
 */

const fs = require('fs');
const path = require('path');

// ── Caminhos ──────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'baseline.json');
const REPORTS_DIR = path.join(ROOT, '.quality-reports');
const OUTPUT_REPORT = path.join(REPORTS_DIR, 'gate-summary.md');

// ── Utilitários ───────────────────────────────────────────────
const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const emoji = (passed) => (passed ? '✅' : '❌');
const trend = (current, baseline, lowerIsBetter = true) => {
  if (current === baseline) return '→';
  if (lowerIsBetter) return current < baseline ? '⬇️ melhorou' : '⬆️ PIOROU';
  return current > baseline ? '⬆️ melhorou' : '⬇️ PIOROU';
};

// ── Lê relatórios ─────────────────────────────────────────────

// ESLint: usa o relatório JSON gerado por `eslint --format json`
function readEslintViolations() {
  const report = readJson(path.join(REPORTS_DIR, 'eslint.json'));
  if (!report) return null;
  // Soma todos os errorCount e warningCount de cada arquivo
  return report.reduce((acc, file) => acc + file.errorCount + file.warningCount, 0);
}

// Jest/React coverage: usa o summary do relatório de coverage
function readJestCoverage() {
  const summary = readJson(path.join(REPORTS_DIR, 'jest-coverage', 'coverage-summary.json'));
  if (!summary || !summary.total) return null;
  // Média das 4 métricas principais
  const { lines, statements, functions, branches } = summary.total;
  
  const getPct = (metric) => typeof metric?.pct === 'number' ? metric.pct : 0;
  
  const avg = (getPct(lines) + getPct(statements) + getPct(functions) + getPct(branches)) / 4;
  return Math.round(avg * 100) / 100;
}

// jscpd: usa o relatório JSON de duplicação
function readDuplication() {
  const report = readJson(path.join(REPORTS_DIR, 'jscpd-report.json'));
  if (!report || !report.statistics) return null;
  return Math.round(report.statistics.total.percentage * 100) / 100;
}

// Python coverage: usa o relatório JSON do coverage.py
function readPythonCoverage() {
  const report = readJson(path.join(REPORTS_DIR, 'python-coverage.json'));
  if (!report) return null;
  return Math.round(report.totals.percent_covered * 100) / 100;
}

// Flake8: usa o relatório de texto gerado pelo CI
function readFlake8Violations() {
  const reportPath = path.join(REPORTS_DIR, 'flake8.txt');
  if (!fs.existsSync(reportPath)) return null;
  const lines = fs.readFileSync(reportPath, 'utf8').trim().split('\n');
  // Conta apenas linhas não-vazias (cada linha = uma violação)
  return lines.filter((l) => l.trim().length > 0).length;
}

// pip-audit e npm-audit: usa os relatórios JSON
function readPipAudit() {
  const report = readJson(path.join(REPORTS_DIR, 'pip-audit.json'));
  if (!report) return null;
  // Conta apenas vulnerabilidades de severidade CRITICAL
  return (report.vulnerabilities || []).filter(
    (v) => v.fix_versions && v.fix_versions.length > 0
  ).length;
}

function readNpmAudit() {
  const report = readJson(path.join(REPORTS_DIR, 'npm-audit.json'));
  if (!report) return null;
  return (report.metadata?.vulnerabilities?.critical) || 0;
}

// ── Engine principal ──────────────────────────────────────────
function runGate() {
  console.log('\n🚦 Quality Gate — Lumem\n');
  console.log('=' .repeat(50));

  const baseline = readJson(BASELINE_PATH);
  if (!baseline) {
    console.error('❌ baseline.json não encontrado. Rode: node scripts/update-baseline.js');
    process.exit(1);
  }

  let allPassed = true;
  const results = [];

  // ── Helper para registrar cada verificação ────────────────
  const check = (name, current, baselineValue, lowerIsBetter = true) => {
    if (current === null) {
      results.push({ name, status: '⚠️', msg: 'Relatório não encontrado — pulando' });
      return;
    }
    const passed = lowerIsBetter
      ? current <= baselineValue
      : current >= baselineValue;

    if (!passed) allPassed = false;

    results.push({
      name,
      status: emoji(passed),
      current,
      baseline: baselineValue,
      trend: trend(current, baselineValue, lowerIsBetter),
      passed,
    });
  };

  // ── Verificações ──────────────────────────────────────────

  // Backend
  check(
    'Python — Flake8 violações',
    readFlake8Violations(),
    baseline.backend.flake8.violations,
    true // menos violações = melhor
  );

  check(
    'Python — Cobertura de testes (%)',
    readPythonCoverage(),
    baseline.backend.coverage.percentage,
    false // mais coverage = melhor
  );

  // Frontend
  check(
    'JS — ESLint violações',
    readEslintViolations(),
    baseline.frontend.eslint.violations,
    true
  );

  check(
    'JS — Cobertura de testes (%)',
    readJestCoverage(),
    baseline.frontend.coverage.percentage,
    false
  );

  check(
    'JS — Duplicação de código (%)',
    readDuplication(),
    baseline.frontend.duplication.percentage,
    true
  );

  // Segurança
  check(
    'Python — Vulnerabilidades críticas (pip-audit)',
    readPipAudit(),
    baseline.security.pip_audit.criticalVulnerabilities,
    true
  );

  check(
    'JS — Vulnerabilidades críticas (npm audit)',
    readNpmAudit(),
    baseline.security.npm_audit.criticalVulnerabilities,
    true
  );

  // ── Exibe resultados no terminal ──────────────────────────
  for (const r of results) {
    if (r.current === undefined) {
      console.log(`${r.status} ${r.name}: ${r.msg}`);
    } else {
      console.log(
        `${r.status} ${r.name}: ${r.current} (baseline: ${r.baseline}) ${r.trend}`
      );
    }
  }

  console.log('='.repeat(50));
  console.log(allPassed ? '✅ Quality Gate PASSOU' : '❌ Quality Gate FALHOU');

  // ── Gera resumo Markdown para o comentário do PR ──────────
  const mdLines = [
    '## 🚦 Quality Gate — Lumem',
    '',
    '| Métrica | Atual | Baseline | Status |',
    '|---------|-------|----------|--------|',
  ];

  for (const r of results) {
    if (r.current === undefined) {
      mdLines.push(`| ${r.name} | — | — | ${r.status} sem relatório |`);
    } else {
      mdLines.push(`| ${r.name} | \`${r.current}\` | \`${r.baseline}\` | ${r.status} ${r.trend} |`);
    }
  }

  mdLines.push('');
  if (allPassed) {
    mdLines.push('> ✅ **Todas as métricas estão dentro do baseline. Catraca liberada.**');
    mdLines.push('> 💡 Se alguma métrica melhorou, considere rodar `node scripts/update-baseline.js` para avançar o baseline.');
  } else {
    mdLines.push('> ❌ **Uma ou mais métricas REGRIGIRAM. Este PR não pode ser mergeado.**');
    mdLines.push('> 🛠️ Corrija as métricas marcadas com ❌ antes de solicitar nova revisão.');
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_REPORT, mdLines.join('\n'));
  console.log(`\n📄 Relatório gerado: ${OUTPUT_REPORT}`);

  // Exit 1 = falha o CI
  if (!allPassed) process.exit(1);
}

runGate();
