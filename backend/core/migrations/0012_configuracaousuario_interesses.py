from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adiciona o campo 'interesses' (JSONField) em ConfiguracaoUsuario.
    """

    dependencies = [
        ('core', '0011_postembedding_conviTemoderador_postvisto'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaousuario',
            name='interesses',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Categorias de sonho selecionadas no onboarding',
            ),
        ),
    ]

