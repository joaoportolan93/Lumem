import React from 'react';
import { FaUserShield } from 'react-icons/fa';
import LegalPage from '../LegalPage';

const content = `# Política de Privacidade — Lumem

**Data de vigência:** 01/04/2026

A sua privacidade e segurança são levadas a sério. O **Lumem** elaborou esta Política de Privacidade para explicar, de forma clara e transparente, como coletamos, usamos, armazenamos e protegemos os seus dados pessoais.

Este documento foi redigido em estrita conformidade com a **[Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)** e com o **[Marco Civil da Internet (Lei nº 12.965/2014)](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm)**.

O Lumem é uma rede social voltada ao registro de sonhos, ao autoconhecimento e à socialização, **destinada exclusivamente a maiores de 18 anos**. O cadastro na plataforma implica a declaração de que o usuário possui idade igual ou superior a 18 anos.

---

### 1. Quais dados coletamos?

Para que você possa utilizar o Lumem, coletamos dois tipos de informações:

**A. Dados que você nos fornece diretamente (ou via login do Google):**

- **Nome completo e E-mail:** Utilizados para identificar você, garantir o acesso à sua conta, enviar comunicações importantes (como confirmação de e-mail, recuperação de senha e notificações de segurança) e, quando necessário, para identificação em caso de violação dos nossos Termos de Uso. Ao utilizar a opção "Entrar com o Google", recebemos apenas seu nome, e-mail e foto de perfil pública, diretamente via protocolo OAuth.
- **Data de Nascimento:** Coletada para confirmar que o usuário possui 18 anos ou mais, conforme exigido pelos Termos de Uso da plataforma. Adicionalmente, caso você escolha exibi-la no seu perfil público, ela poderá aparecer na sua bio — essa exibição depende exclusivamente da sua configuração de privacidade e do seu consentimento explícito.
- **Informações de Perfil:** Foto, biografia e os registros de sonhos que você publica na plataforma. Esses dados são tratados conforme as suas configurações de privacidade (conta pública, conta privada ou visibilidade restrita a "Melhores Amigos").

**B. Dados coletados automaticamente:**

- **Endereço IP:** Coletado para fins de segurança, prevenção de fraudes, bloqueio de usuários mal-intencionados e cumprimento de obrigações legais previstas no Art. 15 do Marco Civil da Internet.
- **Tempo de Uso e Interações:** Registramos o tempo que você passa no site para métricas internas de funcionamento da plataforma. Não utilizamos esses dados para construção de perfis psicológicos ou comportamentais abusivos, nem para direcionamento de publicidade.

---

### 2. Privacidade e Controle do Usuário

O Lumem foi projetado com a privacidade como princípio central. Você tem controle direto sobre quem pode ver o quê:

- **Conta Pública:** Seu perfil e seus registros públicos são visíveis para qualquer usuário da plataforma.
- **Conta Privada:** Seu perfil e seus registros são visíveis apenas para usuários que você aprovou como seguidores.
- **Melhores Amigos:** Você pode publicar registros de sonhos visíveis apenas para um grupo seleto de pessoas de sua escolha, independentemente da configuração geral da sua conta.

Essas configurações podem ser alteradas a qualquer momento nas suas preferências de perfil.

---

### 3. Como utilizamos os seus dados?

Seus dados são utilizados única e exclusivamente para:

- Criar e manter a sua conta funcionando.
- Garantir a sua segurança e a integridade da comunidade, investigando violações aos nossos Termos de Uso.
- Enviar comunicações transacionais essenciais (confirmação de e-mail, recuperação de senha, notificações de segurança).
- Identificar usuários em caso de violações legais graves, em colaboração com as autoridades competentes, mediante ordem judicial ou requisição legal.
- Cumprir obrigações legais impostas pelo Marco Civil da Internet e pela LGPD.

**Nós nunca venderemos os seus dados pessoais para terceiros, empresas de marketing ou corretoras de dados.**

---

### 4. Operadores de Dados Terceiros

Para que o Lumem funcione, utilizamos alguns provedores de serviço que, na condição de **operadores de dados**, processam certas informações em nosso nome. Eles agem estritamente conforme nossas instruções e de acordo com a LGPD. São eles:

- **Google LLC:** Utilizado para a funcionalidade de login social ("Entrar com o Google") via protocolo OAuth. Apenas nome, e-mail e foto pública de perfil são recebidos.
- **Vercel Inc.:** Utilizado para hospedagem da interface visual (frontend) da plataforma.

---

### 5. Onde seus dados ficam armazenados?

O banco de dados e as informações principais da plataforma são armazenados em servidores próprios, com acesso restrito e protegido. A interface visual (site) é hospedada na plataforma Vercel. Adotamos práticas de segurança de mercado para evitar vazamentos e acessos não autorizados.

---

### 6. Os seus direitos (LGPD — Art. 18)

Você é o titular dos seus dados. A qualquer momento, você tem o direito de:

1. **Confirmar** a existência de tratamento dos seus dados pessoais pelo Lumem.
2. **Acessar** os dados que temos sobre você.
3. **Corrigir** dados incompletos, inexatos ou desatualizados diretamente no seu perfil.
4. **Solicitar a anonimização, bloqueio ou eliminação** de dados desnecessários ou tratados em desconformidade com a LGPD.
5. **Solicitar a portabilidade** dos seus dados, incluindo os registros de sonhos que você publicou na plataforma, em formato legível e estruturado.
6. **Excluir** sua conta e todos os dados vinculados a ela.
7. **Ser informado** sobre com quais operadores terceiros seus dados são compartilhados.
8. **Revogar o seu consentimento** a qualquer momento.
9. **Peticionar à [ANPD](https://www.gov.br/anpd/pt-br)** (Autoridade Nacional de Proteção de Dados).

---

### 7. Contato com o DPO (Encarregado de Dados)

Se você tiver dúvidas sobre esta Política, quiser exercer seus direitos ou reportar algum problema envolvendo seus dados, entre em contato conosco pelo e-mail:

**contato@lumem.com.br**
`;

const PoliticaPrivacidade = () => (
    <LegalPage content={content} icon={<FaUserShield size={32} />} />
);

export default PoliticaPrivacidade;
