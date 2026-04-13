# Generated manually - adds post mention tracking model

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid6


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_fcm_moderation_admin_notifications'),
    ]

    operations = [
        migrations.CreateModel(
            name='PublicacaoMencao',
            fields=[
                ('id_mencao', models.UUIDField(default=uuid6.uuid7, editable=False, primary_key=True, serialize=False)),
                ('data_criacao', models.DateTimeField(default=django.utils.timezone.now)),
                ('publicacao', models.ForeignKey(db_column='id_publicacao', on_delete=django.db.models.deletion.CASCADE, related_name='mencoes', to='core.publicacao')),
                ('usuario_mencionado', models.ForeignKey(db_column='id_usuario_mencionado', on_delete=django.db.models.deletion.CASCADE, related_name='mencoes_recebidas', to='core.usuario')),
                ('usuario_mencionador', models.ForeignKey(blank=True, db_column='id_usuario_mencionador', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mencoes_feitas', to='core.usuario')),
            ],
            options={
                'db_table': 'publicacao_mencoes',
                'unique_together': {('publicacao', 'usuario_mencionado')},
            },
        ),
    ]
