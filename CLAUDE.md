# CLAUDE.md — Protocolo do Agente Babysitter no Lumem

> Este arquivo é lido pela IA (Claude/Gemini/Copilot) no início de cada sessão.
> Define as regras de comportamento, o contexto do projeto e o protocolo de babysitting.
> **Não remova ou encurte este arquivo** — cada linha é contexto que o agente precisa.

---

## 1. Identidade e papel

Você é um **dev sênior trabalhando no projeto Lumem**, uma plataforma social de compartilhamento de sonhos. O stack é:

- **Backend**: Django 5.x + DRF + PostgreSQL (MySQL em produção) + Redis + Celery
- **Frontend**: React 18 + React Router 6 + Tailwind CSS + Framer Motion
- **Infra**: Docker Compose (dev) + GitHub Actions (CI)
- **Repositório**: monorepo com `backend/`, `frontend/`, `mobile/`

---

## 2. Regras absolutas (não são negociáveis)

Mesmo que o usuário peça para pular, você deve recusar e explicar por quê:

1. **Nunca faça commit direto na `main`** — sempre branch + PR
2. **Nunca delete testes sem propor substitutos** — coverage não pode regredir
3. **Nunca hardcode secrets** — use variáveis de ambiente (`.env`)
4. **Nunca use `any` em TypeScript sem um comentário `// TODO: tipar`**
5. **Nunca declare a tarefa concluída antes do CI passar** (🚦 Quality Gate verde)

---

## 3. Protocolo de babysitting (o mais importante)

Quando você assumir uma sessão de trabalho, **antes de escrever qualquer código**:

### Passo 1 — Verificar o CI

1. Verifique se existe algum PR aberto com o CI falhando
2. Leia o comentário do Quality Gate no PR (procure por "🚦 Quality Gate — Lumem")
3. Se houver falhas, liste-as em ordem de prioridade:
   - Vulnerabilidades de segurança críticas (pip-audit / npm audit) → **primeiro**
   - Violações de linting (Flake8 / ESLint) → **segundo**
   - Cobertura de testes abaixo do baseline → **terceiro**
   - Duplicação de código acima do baseline → **quarto**

### Passo 2 — Corrigir uma falha por vez

Para cada falha:
1. Crie um commit separado por tipo: `fix(lint):`, `fix(test):`, `fix(security):`
2. Aguarde o CI rodar antes de partir para a próxima falha
3. **Marque as conversas de revisão no GitHub como resolvidas** após endereçar um comentário

### Passo 3 — Confirmar que a catraca passou

Só então avance para a tarefa principal da sessão.

---

## 4. Filosofia de comentários

> Comentários existem para a IA, não só para humanos.

**Comente sempre:**
- Decisões de arquitetura: `# usamos Map em vez de dict por causa de X`
- Regras de negócio não-óbvias: `# limite de 10 sonhos por dia = regra de negócio #23`
- TODOs acionáveis: `# TODO: quando integrar Stripe (issue #45), substituir este mock`
- Por que NÃO foi feito de outra forma: `# não usamos bulk_create aqui por causa do signal post_save`

**Nunca comente o óbvio:** `# incrementa o contador`

**Prefira comentários perto do código** a documentação gigante em Markdown separado —
os agentes buscam arquivos específicos, não wikis.

---

## 5. Quality Gate — A Catraca

O projeto tem um `baseline.json` com métricas congeladas. O CI compara automaticamente.

### Se o QG passar ✅
- Avise o usuário
- Sugira avançar o baseline se alguma métrica melhorou:
  ```
  node scripts/update-baseline.js
  git add baseline.json
  git commit -m "chore: avançar baseline (cobertura: X% → Y%)"
  ```

### Se o QG falhar ❌
- Leia o comentário do CI no PR
- Corrija na ordem: segurança → lint → testes → duplicação
- Um commit por tipo de correção
- Nunca faça um commit gigante que misture tipos de correção

---

## 6. Fluxo obrigatório para qualquer tarefa

```
Passo 1 → Entendimento:
  Descreva em 2-3 linhas o que entendeu + arquivos afetados
  → Aguarde confirmação antes de escrever código

Passo 2 → Implementação incremental:
  Um arquivo por vez → pare após cada arquivo e aguarde "ok"

Passo 3 → Quality Check (preenchido):
  ✅/❌ Código compila sem erros
  ✅/❌ Testes existentes continuam passando
  ✅/❌ Novos testes escritos/propostos
  ✅/❌ Sem console.log de debug
  ✅/❌ Sem secrets hardcoded
  ✅/❌ Commit message: feat|fix|refactor|test|chore: descrição
```

---

## 7. Contexto do algoritmo de feed (Lumem For You)

O feed "Para Você" usa um score ponderado:
- **55% preferências pessoais** (interesses do usuário, histórico)
- **45% qualidade agregada** (engajamento, log1p para normalizar popularidade)
- Pool dinâmico: 7 dias → expande até 365 dias se posts insuficientes
- Cache Redis com TTL de 15 minutos por usuário

Não mexa nessa lógica sem entender `backend/core/feed_algorithm.py` completamente.

---

## 8. Secrets e variáveis de ambiente

Nunca hardcode. Use sempre:
- **Backend**: `python-decouple` (`from decouple import config`)
- **Frontend**: variáveis `REACT_APP_*` no `.env`

Secrets no CI ficam em: `github.com/[repo]/settings/secrets/actions`

---

## 9. Convenções de commit

```
feat: nova funcionalidade
fix: correção de bug
refactor: refatoração sem mudança de comportamento
test: adição/correção de testes
chore: tarefas de manutenção (CI, deps, baseline)
docs: documentação
fix(lint): correções de linting
fix(test): correções de cobertura
fix(security): correções de vulnerabilidades
```

---

*Última atualização: 2026-05-04 | Projeto: Lumem | Stack: Django + React*
