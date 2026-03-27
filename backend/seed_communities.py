import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumem_backend.settings')
django.setup()

from core.models import Comunidade

communities_data = [
    {
        "nome": "Interpretadores de Sonhos",
        "descricao": "Uma comunidade dedicada a decifrar o significado oculto dos nossos sonhos corporativos e diários. Compartilhe seu sonho e vamos analisá-lo juntos usando diferentes abordagens psicológicas e místicas.",
        "regras": ["Seja respeitoso ao interpretar", "Não dê diagnósticos médicos"],
    },
    {
        "nome": "Sonhadores Lúcidos Brasil",
        "descricao": "Grupo para quem pratica ou quer aprender sobre sonhos lúcidos (quando você sabe que está sonhando e pode controlar o sonho). Compartilhe técnicas, reality checks e experiências incríveis.",
        "regras": ["Apenas técnicas seguras", "Relatos reais apenas"],
    },
    {
        "nome": "Diário de Pesadelos",
        "descricao": "Um espaço seguro para desabafar sobre aqueles sonhos ruins e aterrorizantes. Você não está sozinho! Vamos entender os medos subconscientes juntos e confortar os colegas.",
        "regras": ["Coloque um alerta de gatilho (TW) se necessário", "Apoio e empatia sempre"],
    },
    {
        "nome": "Sonhos Proféticos & Deja Vu",
        "descricao": "Você já sonhou com algo e depois aconteceu na vida real? Ou teve aquela forte sensação de 'já vi isso antes'? Este é o seu lugar para compartilhar premonições e as chamadas coincidências bizarras da mente.",
        "regras": ["Seja cético mas mantenha a mente aberta", "Respeito às crenças alheias"],
    },
    {
        "nome": "Encontros Familiares, Entes Queridos",
        "descricao": "Tem tido visitas emocionantes de pessoas que já se foram através dos seus sonhos? Compartilhe essas experiências reconfortantes (ou confusas) com nossa comunidade totalmente empática.",
        "regras": ["Acolhimento absoluto", "Não tente invalidar a experiência do outro"],
    },
    {
        "nome": "Viagens Astrais e OBEs",
        "descricao": "Dedicado a Experiências Fora do Corpo (OBEs), Projeção Astral e fenômenos curiosos relacionados. Troque dicas de indução, sobre vibrações e leia os relatos mais profundos das suas viagens no plano astral e afins.",
        "regras": ["Proibido incentivar práticas perigosas", "Tente diferenciar sonho lúcido de projeção astral (quando couber)"],
    },
    {
        "nome": "Sonhos em Arte - Telas e Quadros",
        "descricao": "Viu paisagens impossíveis ou criaturas fantásticas? Tente desenhar o que você viu no seu sonho e poste aqui! Um museu virtual focado para as mentes mais criativas da noite durante o sono profundo.",
        "regras": ["De preferência arte original apenas", "Tente explicar o contexto do próprio sonho na descrição"],
    },
    {
        "nome": "Sonhos Recorrentes da Noite",
        "descricao": "Fugindo de um monstro, caindo infinitamente do abismo, ou voltando pra escola sem estar preparado para a prova? Se você costuma ter sempre o mesmo sonho, venha logo descobrir se mais alguém passa por isso também.",
        "regras": ["Sem julgamento", "Ajude na busca pessoal por padrões repetitivos"],
    }
]

created_count = 0
for data in communities_data:
    com, created = Comunidade.objects.get_or_create(
        nome=data["nome"],
        defaults={
            "descricao": data["descricao"],
            "regras": data["regras"]
        }
    )
    if created:
        created_count += 1
        print(f"Comunidade criada: {com.nome}")
    else:
        print(f"Comunidade já existia: {com.nome}")

print(f"\\nSucesso! {created_count} novas comunidades críveis foram semeadas com sucesso.")
