from django.db import migrations


def populate_conversas(apps, schema_editor):
    """
    Data migration: para cada par de usuários que trocaram mensagens,
    cria uma Conversa determinística (menor UUID = usuario_a)
    e atribui o FK conversa em cada MensagemDireta existente.
    """
    MensagemDireta = apps.get_model('core', 'MensagemDireta')
    Conversa = apps.get_model('core', 'Conversa')
    import uuid6

    mensagens = MensagemDireta.objects.select_related(
        'usuario_remetente', 'usuario_destinatario'
    ).all()

    cache_conversas = {}

    for msg in mensagens:
        uid1 = str(msg.usuario_remetente_id)
        uid2 = str(msg.usuario_destinatario_id)

        if uid1 < uid2:
            a_id, b_id = msg.usuario_remetente_id, msg.usuario_destinatario_id
        else:
            a_id, b_id = msg.usuario_destinatario_id, msg.usuario_remetente_id

        chave = (str(a_id), str(b_id))

        if chave not in cache_conversas:
            conversa, _ = Conversa.objects.get_or_create(
                usuario_a_id=a_id,
                usuario_b_id=b_id,
                defaults={'id_conversa': uuid6.uuid7()}
            )
            cache_conversas[chave] = conversa
        else:
            conversa = cache_conversas[chave]

        msg.conversa = conversa
        msg.tipo_mensagem = 'text'
        msg.save(update_fields=['conversa', 'tipo_mensagem'])


def reverse_populate(apps, schema_editor):
    """Reverse: limpar os campos adicionados."""
    MensagemDireta = apps.get_model('core', 'MensagemDireta')
    MensagemDireta.objects.all().update(conversa=None, tipo_mensagem='text')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_dm_v2_conversa_upload'),
    ]

    operations = [
        migrations.RunPython(populate_conversas, reverse_populate),
    ]
