import uuid6
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_comentariomencao'),
    ]

    operations = [
        # --- PostEmbedding ---
        migrations.CreateModel(
            name='PostEmbedding',
            fields=[
                ('publicacao', models.OneToOneField(
                    db_column='id_publicacao',
                    on_delete=django.db.models.deletion.CASCADE,
                    primary_key=True,
                    related_name='embedding',
                    serialize=False,
                    to='core.publicacao',
                )),
                ('vetor', models.BinaryField(help_text='Vetor numpy serializado (float32)')),
                ('modelo', models.CharField(
                    default='paraphrase-multilingual-MiniLM-L12-v2',
                    help_text='Nome do modelo usado para gerar o embedding',
                    max_length=100,
                )),
                ('data_calculo', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'db_table': 'post_embeddings',
            },
        ),

        # --- ConviteModerador ---
        migrations.CreateModel(
            name='ConviteModerador',
            fields=[
                ('id_convite', models.UUIDField(default=uuid6.uuid7, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pendente'), ('accepted', 'Aceito'), ('rejected', 'Recusado')], default='pending', max_length=20)),
                ('data_criacao', models.DateTimeField(default=django.utils.timezone.now)),
                ('admin_convidador', models.ForeignKey(db_column='id_admin_convidador', on_delete=django.db.models.deletion.CASCADE, related_name='convites_enviados', to='core.usuario')),
                ('comunidade', models.ForeignKey(db_column='id_comunidade', on_delete=django.db.models.deletion.CASCADE, to='core.comunidade')),
                ('usuario_convidado', models.ForeignKey(db_column='id_usuario_convidado', on_delete=django.db.models.deletion.CASCADE, related_name='convites_recebidos', to='core.usuario')),
            ],
            options={
                'db_table': 'convites_moderador',
            },
        ),

        # --- PostVisto ---
        migrations.CreateModel(
            name='PostVisto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_visto', models.DateTimeField(default=django.utils.timezone.now)),
                ('publicacao', models.ForeignKey(db_column='id_publicacao', on_delete=django.db.models.deletion.CASCADE, related_name='vistos_por', to='core.publicacao')),
                ('usuario', models.ForeignKey(db_column='id_usuario', on_delete=django.db.models.deletion.CASCADE, related_name='posts_vistos', to='core.usuario')),
            ],
            options={
                'db_table': 'posts_vistos',
                'unique_together': {('usuario', 'publicacao')},
                'indexes': [
                    models.Index(fields=['usuario', '-data_visto'], name='posts_visto_id_usua_idx'),
                ],
            },
        ),

        # --- Alter Notificacao fields ---
        migrations.AlterField(
            model_name='notificacao',
            name='id_referencia',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='notificacao',
            name='tipo_notificacao',
            field=models.SmallIntegerField(choices=[
                (1, 'Nova Publicação'),
                (2, 'Comentário'),
                (3, 'Curtida'),
                (4, 'Seguidor Novo'),
                (5, 'Solicitação de Seguidor'),
                (6, 'Convite de Moderação'),
                (7, 'Menção em Publicação'),
            ]),
        ),

        # --- ConviteModerador constraint ---
        migrations.AddConstraint(
            model_name='convitemoderador',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')),
                fields=('comunidade', 'usuario_convidado'),
                name='unique_pending_invite_per_user_community',
            ),
        ),
    ]
