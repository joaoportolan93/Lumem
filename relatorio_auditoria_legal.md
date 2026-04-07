# Relatório de Auditoria de Conformidade Legal — Lumem
**LGPD (Lei nº 13.709/2018) + Marco Civil da Internet (Lei nº 12.965/2014)**
> Versão 3.0 | Revisado em: 02/04/2026
> Escopo: plataforma 18+. ECA Digital (Lei nº 15.211/2025) fora do escopo desta versão.
> Arquivos analisados: `models.py`, `serializers.py`, `views.py`, `urls.py`, `Register.jsx`, `Login.jsx`, `Onboarding.jsx`, `EditProfile.jsx`, `Settings.jsx`, `App.js`

---

## Legenda de Classificação

| Símbolo | Significado |
|---------|-------------|
| ✅ | Conforme — já atende à lei |
| 🔴 | **AUSENTE CRÍTICO** — violação direta da lei, risco jurídico imediato |
| 🟠 | **AUSENTE IMPORTANTE** — não viola hoje, mas precisa ser implementado antes do lançamento público |
| 🟡 | Melhoria Recomendada — boas práticas |

---

## PARTE 1: AUDITORIA DO BACKEND

### 1.1 — Modelo de Usuário (`models.py` · Classe `Usuario`)

| Verificação | Status | Detalhe |
|---|---|---|
| Campo `data_nascimento` existe no banco | ✅ | `data_nascimento = models.DateField(null=True, blank=True)` — linha 46 |
| Campo `data_nascimento` é obrigatório no cadastro | 🔴 CRÍTICO | `null=True, blank=True` permite criar conta sem informar a data. Para uma plataforma 18+, esse campo é obrigatório para validar a idade mínima |
| Campo de status para suspensão/banimento | ✅ | `status` com choices `Ativo/Suspenso/Desativado` — linha 59 |
| Login verifica status de banimento | ✅ | `GoogleLoginView` e `CustomTokenObtainPairView` verificam `status == 2` |
| Campo `aceite_termos_em` (registro de consentimento) | 🔴 CRÍTICO | Não existe. A LGPD exige registro com data/hora de quando o usuário aceitou os Termos de Uso e a Política de Privacidade |
| Estratégia de migração para usuários legados sem `data_nascimento` | 🔴 CRÍTICO | Não prevista. Usuários já cadastrados antes do deploy das correções nunca passaram pela validação de idade. É necessária uma lógica que, no primeiro login após o deploy, force esses usuários a completar a data antes de continuar |

### 1.2 — Serializer de Registro (`serializers.py` · `RegisterSerializer`)

| Verificação | Status | Detalhe |
|---|---|---|
| `data_nascimento` nos campos de registro | 🔴 CRÍTICO | `fields = ('nome_usuario', 'email', 'nome_completo', 'password')` — data de nascimento ausente no serializer |
| Validação de idade mínima (< 18 → rejeitar cadastro) | 🔴 CRÍTICO | Nenhuma lógica de validação de idade. O backend precisa rejeitar o cadastro com erro claro caso a data informada indique menos de 18 anos |
| Campo `aceite_termos` obrigatório no cadastro | 🔴 CRÍTICO | Não existe. Sem prova de que o usuário leu e concordou com os documentos legais |

### 1.3 — Login com Google (`views.py` · `GoogleLoginView`)

| Verificação | Status | Detalhe |
|---|---|---|
| Verificação de banimento antes de gerar token | ✅ | Verificado corretamente — linhas 148–153 |
| Coleta de `data_nascimento` após login Google em conta nova | 🔴 CRÍTICO | Google retorna apenas `email` e `name`. Contas criadas via Google nunca passam pela coleta e validação de idade |
| Validação de idade antes de ativar conta Google | 🔴 CRÍTICO | `User.objects.create_user()` na linha 163 cria a conta sem verificar se o usuário tem 18 anos |
| Tratamento de usuários Google legados sem `data_nascimento` | 🔴 CRÍTICO | Usuários Google já existentes precisam ser interceptados no próximo login e redirecionados para completar a data antes de acessar o feed |

### 1.4 — Endpoints/Rotas (`urls.py`)

| Verificação | Status | Detalhe |
|---|---|---|
| Endpoint de exclusão de conta pelo usuário | 🔴 CRÍTICO | Não existe. LGPD Art. 18, VI — direito de exclusão garantido por lei |
| Endpoint de exportação dos próprios dados | 🔴 CRÍTICO | Não existe. LGPD Art. 18, V — direito de portabilidade garantido por lei e explicitamente comprometido na Política de Privacidade e nos Termos de Uso |

### 1.5 — Exclusão e Direito ao Esquecimento

| Verificação | Status | Detalhe |
|---|---|---|
| Cascata de exclusão nos modelos | ✅ | `on_delete=models.CASCADE` implementado corretamente em todos os relacionamentos |
| Endpoint público de auto-exclusão de conta | 🔴 CRÍTICO | Não existe (reforço do item 1.4) |
| Retenção de logs após exclusão (Marco Civil) | 🟠 IMPORTANTE | Verificar se a cascata de exclusão preserva os logs de acesso pelo prazo mínimo de 6 meses exigido pelo Art. 15 do Marco Civil da Internet, sem apagá-los junto com os dados do perfil |

---

## PARTE 2: AUDITORIA DO FRONTEND

### 2.1 — Tela de Registro (`Register.jsx`)

| Verificação | Status | Detalhe |
|---|---|---|
| Campo `data_nascimento` no formulário de cadastro | 🔴 CRÍTICO | Completamente ausente. Formulário: apenas `username`, `email`, `password`, `confirmPassword` |
| Validação de idade mínima no frontend | 🔴 CRÍTICO | Sem o campo de data, impossível bloquear cadastro de menores de 18 anos já na interface, antes da requisição ao backend |
| Checkbox de aceite de Termos e Privacidade | 🔴 CRÍTICO | Completamente ausente. Botão "Criar Conta" não exige concordância com nada |
| Links clicáveis para Termos e Privacidade | 🔴 CRÍTICO | Não existem na tela de registro |

### 2.2 — Tela de Login (`Login.jsx`)

| Verificação | Status | Detalhe |
|---|---|---|
| Verificação de banimento exibida ao usuário | ✅ | Tratamento do erro 403 com `banned: true` funcionando — linhas 90–92 |
| Após login Google em conta nova: coleta de idade | 🔴 CRÍTICO | `loginWithGoogle` redireciona direto para `/feed` (linha 117) sem perguntar a data de nascimento de novos usuários Google |
| Após login Google em conta legada sem idade: interceptação | 🔴 CRÍTICO | Não existe. O redirecionamento direto para `/feed` ocorre também para contas existentes que nunca forneceram a data de nascimento |
| Links para Termos/Privacidade na tela de login | 🟡 Recomendado | Ausente. Não é obrigatório, mas é boa prática exibir no rodapé da tela |

### 2.3 — Onboarding (`Onboarding.jsx`)

| Verificação | Status | Detalhe |
|---|---|---|
| Coleta de `data_nascimento` no fluxo de Onboarding | 🔴 CRÍTICO | O Onboarding só coleta: avatar, `nome_completo`, `bio` e configuração de privacidade. A data de nascimento não está em nenhum dos steps |
| Campo de aceite dos Termos no Onboarding | 🟠 IMPORTANTE | Se a coleta de idade for movida para o `Register.jsx`, o Onboarding pode ser o local mais adequado para apresentar o checkbox de aceite de Termos de forma menos burocrática |

### 2.4 — Editar Perfil (`EditProfile.jsx`)

| Verificação | Status | Detalhe |
|---|---|---|
| Campo `data_nascimento` existe na tela | ✅ | Campo presente na linha 208–214 com `type="date"` |
| `data_nascimento` é obrigatório nessa tela | 🟡 Recomendado | O campo é opcional aqui. Isso é aceitável pois o usuário já terá informado ao criar a conta. Após a correção do `Register.jsx`, este campo pode continuar opcional para edição |

### 2.5 — Configurações (`Settings.jsx`)

| Verificação | Status | Detalhe |
|---|---|---|
| Seção "Legal e Políticas" com links para documentos | 🔴 CRÍTICO | Não existe. Usuários logados precisam ter acesso fácil à Política de Privacidade e aos Termos de Uso |
| Botão de "Excluir Conta" | 🔴 CRÍTICO | Não existe. A LGPD garante esse direito e ele precisa estar acessível na interface |
| Link para Central de Ajuda | 🟠 IMPORTANTE | Não existe nas Configurações |

### 2.6 — Estrutura de Rotas (`App.js`)

| Verificação | Status | Detalhe |
|---|---|---|
| Rotas para páginas legais (`/sobre`, `/termos`, `/privacidade`, `/ajuda`) | 🔴 CRÍTICO | Não existem. Os documentos foram criados, mas nenhuma rota foi registrada no App.js para exibi-los |
| Componente de rodapé (Footer) nas rotas públicas | 🔴 CRÍTICO | Não existe. Nenhum componente de rodapé foi implementado nas telas públicas (`/login`, `/register`) |
| Verificação de autenticação baseada em token JWT | ✅ | `PrivateRoute` redireciona para `/login` quando `localStorage.get('access')` é nulo |

---

## RESUMO EXECUTIVO — 20 Itens Catalogados por Prioridade

### 🔴 CRÍTICOS — 16 itens (Implementação obrigatória antes do lançamento)

**Bloco A — Backend (8 itens):**
1. `models.py` → Tornar `data_nascimento` obrigatório (`null=False, blank=False`) e adicionar validação de 18+ no nível do modelo
2. `models.py` → Adicionar campo `aceite_termos_em` (DateTimeField) para registro de consentimento com data/hora
3. `serializers.py` → Adicionar `data_nascimento` como campo obrigatório no `RegisterSerializer`
4. `serializers.py` → Adicionar validação: rejeitar cadastro com erro claro se idade < 18 anos
5. `serializers.py` → Adicionar campo `aceite_termos` (booleano) com validação que bloqueia o cadastro se `False`
6. `views.py (GoogleLoginView)` → Após criar conta Google nova, não redirecionar para `/feed`: exigir data de nascimento e validar 18+ antes de ativar
7. `views.py` → Implementar interceptação no login de usuários legados (e-mail e Google) sem `data_nascimento` preenchida
8. `urls.py` → Criar endpoint `DELETE /profile/` (auto-exclusão de conta)

**Bloco B — Frontend (8 itens):**
9. `Register.jsx` → Adicionar campo de Data de Nascimento obrigatório
10. `Register.jsx` → Adicionar validação: bloquear envio do formulário se idade < 18 anos, com mensagem clara
11. `Register.jsx` → Adicionar checkbox de aceite com links clicáveis para Termos e Privacidade (botão bloqueado enquanto desmarcado)
12. `Login.jsx` → Após login Google em conta nova ou legada sem idade, redirecionar para coleta e validação de `data_nascimento` antes do `/feed`
13. `Settings.jsx` → Adicionar seção "Legal e Políticas" com links para `/sobre`, `/termos`, `/privacidade`, `/ajuda`
14. `Settings.jsx` → Adicionar botão "Excluir Conta" com modal de confirmação, chamando `DELETE /profile/`
15. `App.js` → Registrar rotas públicas: `/sobre`, `/termos`, `/privacidade`, `/ajuda`
16. `App.js` → Criar e importar componente `<Footer />` nas rotas públicas (`/login`, `/register`) com links para os documentos legais

### 🟠 IMPORTANTES — 3 itens (Implementar antes do lançamento)
17. `[NOVO]` → Criar as 4 páginas institucionais como componentes React que exibem o conteúdo dos `.md`
18. `urls.py` → Criar endpoint `GET /profile/export/` para portabilidade de dados (LGPD Art. 18, V)
19. `models.py` → Verificar se a cascata de exclusão preserva logs de acesso pelo prazo de 6 meses (Art. 15, Marco Civil)

### 🟡 RECOMENDADOS — 2 itens (Melhorias pós-lançamento)
20. `Login.jsx` → Adicionar links para Termos/Privacidade no rodapé do formulário de login
21. `Onboarding.jsx` → Avaliar se o Step 2 é o local ideal para apresentar o checkbox de aceite de Termos (alternativa ao Register.jsx)

---

## NOTA SOBRE O ECA DIGITAL

O Lumem é atualmente uma plataforma **exclusiva para maiores de 18 anos**, o que exclui do escopo deste relatório as obrigações previstas na Lei nº 15.211/2025 (ECA Digital) relativas a crianças e adolescentes. Caso a plataforma venha a abrir acesso a menores no futuro, uma auditoria específica de conformidade com o ECA Digital deverá ser realizada antes dessa mudança.

A única obrigação da Lei nº 8.069/1990 (ECA) que permanece em vigor independentemente do público da plataforma é a **notificação obrigatória às autoridades em caso de identificação de CSAM** (material de abuso sexual infantil) — essa obrigação não está limitada a plataformas voltadas ao público infantojuvenil e está prevista nos Termos de Uso do Lumem.