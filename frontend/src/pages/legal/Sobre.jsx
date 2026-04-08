import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import LegalPage from '../LegalPage';

const content = `# Sobre o Lumem

Bem-vindo(a) ao **Lumem**, um espaço digital criado com um propósito claro: **promover o autoconhecimento por meio do registro e do compartilhamento de sonhos.**

Entender a si mesmo, compreender as próprias motivações subliminares e descobrir a origem de medos e preferências sem uma razão aparente é um dos maiores e mais difíceis desafios humanos. Acreditamos que os sonhos carregam reflexos poderosos da nossa psique e que, quando registrados e compartilhados dentro de uma comunidade segura, tornam-se ferramentas inestimáveis de crescimento pessoal.

---

### O Significado do Nosso Nome

Não foi ao acaso que este projeto recebeu o nome de **Lumem**. Derivada do latim, a palavra significa "luz".

Muitas vezes, a mente humana parece caminhar no escuro quando tenta compreender os próprios sentimentos. O Lumem existe para ser esse guia. A nossa proposta é iluminar a parte mais profunda da mente — o subconsciente — ajudando você a enxergar com mais clareza o seu próprio caminho.

---

### Como Surgiu

O Lumem nasceu de uma iniciativa independente: a convicção de que faltava um espaço digital dedicado exclusivamente ao universo onírico — não como entretenimento, mas como ferramenta genuína de autoconhecimento.

O projeto foi idealizado e construído de forma solo, com atenção cuidadosa à segurança, à privacidade dos usuários e à solidez técnica da plataforma. Cada decisão de arquitetura foi tomada com o objetivo de garantir um ambiente estável e confiável para conexões íntimas e construtivas.

---

### Nosso Compromisso

Sentimos orgulho em proporcionar um ambiente onde as pessoas não se sintam isoladas em suas vivências oníricas. O Lumem está aqui para mostrar que seus sonhos importam, têm significado, e que compartilhá-los de forma saudável é uma forma poderosa de iluminar a si mesmo.

Sinta-se à vontade. Registre seus processos. Ilumine-se.
`;

const Sobre = () => (
    <LegalPage content={content} icon={<FaInfoCircle size={32} />} />
);

export default Sobre;
