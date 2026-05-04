# REVIEW.md — Checklist de Revisão do PR

> Este arquivo é lido pelo Agente Babysitter (IA) e pelo revisor humano.
> Preencha antes de solicitar revisão. O agente verifica este checklist automaticamente.

---

## PR: [título do PR]

**Branch:** `feature/nome-da-feature` → `develop`  
**Autor:** @joaoportolan93  
**Data:** YYYY-MM-DD  

---

## ✅ Checklist obrigatório

### Qualidade de código
- [ ] Código compila sem erros (`npm run build` / `python manage.py check`)
- [ ] Sem `console.log` de debug no frontend
- [ ] Sem `print()` de debug no backend
- [ ] Sem secrets ou credenciais hardcoded
- [ ] Comentários de arquitetura adicionados onde necessário

### Testes
- [ ] Testes existentes continuam passando
- [ ] Novos testes escritos para a funcionalidade adicionada
- [ ] Coverage não regrediu (verificar comentário do CI)

### Quality Gate (Catraca)
- [ ] CI passou ✅ (verificar a aba "Actions" no GitHub)
- [ ] Comentário "🚦 Quality Gate — Lumem" no PR mostra todas as métricas ✅
- [ ] Nenhuma métrica regrediu em relação ao `baseline.json`

### Segurança
- [ ] Sem vulnerabilidades críticas novas (pip-audit / npm audit)
- [ ] Endpoints novos têm autenticação adequada
- [ ] Dados sensíveis não são logados ou expostos

### Commits
- [ ] Mensagens de commit no formato: `feat|fix|refactor|test|chore: descrição`
- [ ] Um commit por tipo de mudança (não misturar feat + fix no mesmo commit)

---

## 📋 Descrição da mudança

<!-- O que foi alterado e por quê? -->

## 🔗 Issue relacionada

Closes #[número]

## 🧪 Como testar

<!-- Passos para validar a mudança manualmente -->

---

## 🤖 Para o Agente Babysitter

Se este PR tem falhas no CI, siga o protocolo:

1. Leia o comentário "🚦 Quality Gate — Lumem" neste PR
2. Corrija na ordem: segurança → lint → testes → duplicação
3. Faça um commit separado por tipo de correção
4. Marque as conversas resolvidas após corrigir
5. Aguarde o CI rodar antes de partir para a próxima correção
