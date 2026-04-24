from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adiciona o campo 'interesses' (JSONField) em ConfiguracaoUsuario.

    Usa SeparateDatabaseAndState + ADD COLUMN IF NOT EXISTS para ser idempotente:
    se a coluna já existir no banco (adicionada manualmente ou por migration anterior),
    o Django não falha — apenas registra o estado sem executar o SQL de novo.
    """

    dependencies = [
        ('core', '0011_postembedding_conviTemoderador_postvisto'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # ── O que o Django faz NO BANCO ──
            database_operations=[
                migrations.RunSQL(
                    # MariaDB 10.0+ suporta ADD COLUMN IF NOT EXISTS
                    sql=(
                        "ALTER TABLE configuracoes_usuario "
                        "ADD COLUMN IF NOT EXISTS interesses JSON NOT NULL "
                        "DEFAULT (JSON_ARRAY())"
                    ),
                    reverse_sql=(
                        "ALTER TABLE configuracoes_usuario "
                        "DROP COLUMN IF EXISTS interesses"
                    ),
                ),
            ],
            # ── O que o Django registra no ESTADO dos modelos ──
            state_operations=[
                migrations.AddField(
                    model_name='configuracaousuario',
                    name='interesses',
                    field=models.JSONField(
                        blank=True,
                        default=list,
                        help_text='Categorias de sonho selecionadas no onboarding',
                    ),
                ),
            ],
        ),
    ]
