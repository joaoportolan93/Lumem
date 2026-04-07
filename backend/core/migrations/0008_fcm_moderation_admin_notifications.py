# Generated manually - adds FCM token, message moderation fields, and admin models

from django.db import migrations, models
import django.db.models.deletion
import uuid6


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_usuario_aceite_termos_em_moderacaoconteudo'),
    ]

    operations = [
        # === 1. Campos FCM no Usuario ===
        migrations.AddField(
            model_name='usuario',
            name='fcm_token',
            field=models.CharField(blank=True, max_length=512, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='fcm_token_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # === 2. Campos de moderação no MensagemDireta ===
        migrations.AddField(
            model_name='mensagemdireta',
            name='moderada',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='mensagemdireta',
            name='moderada_por',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='mensagens_moderadas',
                to='core.usuario',
                db_column='id_moderador_msg',
            ),
        ),
        migrations.AddField(
            model_name='mensagemdireta',
            name='moderada_em',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mensagemdireta',
            name='motivo_moderacao',
            field=models.TextField(blank=True, null=True),
        ),

        # === 3. Modelo NotificacaoAdmin ===
        migrations.CreateModel(
            name='NotificacaoAdmin',
            fields=[
                ('id_notificacao', models.UUIDField(default=uuid6.uuid7, editable=False, primary_key=True, serialize=False)),
                ('titulo', models.CharField(max_length=200)),
                ('mensagem', models.TextField()),
                ('tipo', models.CharField(choices=[('info', 'Informação'), ('alerta', 'Alerta'), ('promo', 'Promoção'), ('atualizacao', 'Atualização'), ('manutencao', 'Manutenção')], default='info', max_length=20)),
                ('destinatarios', models.CharField(choices=[('todos', 'Todos os Usuários'), ('ativos', 'Usuários Ativos (7 dias)'), ('verificados', 'Usuários Verificados')], default='todos', max_length=30)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_envio', models.DateTimeField(blank=True, null=True)),
                ('enviada', models.BooleanField(default=False)),
                ('total_enviados', models.IntegerField(default=0)),
                ('criado_por', models.ForeignKey(db_column='id_admin_criador', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notificacoes_admin_criadas', to='core.usuario')),
            ],
            options={
                'db_table': 'notificacoes_admin',
                'ordering': ['-data_criacao'],
            },
        ),

        # === 4. Modelo ConfiguracaoNotificacaoAdmin ===
        migrations.CreateModel(
            name='ConfiguracaoNotificacaoAdmin',
            fields=[
                ('id_config', models.AutoField(primary_key=True, serialize=False)),
                ('push_habilitado', models.BooleanField(default=True)),
                ('email_habilitado', models.BooleanField(default=False)),
                ('frequencia_max_diaria', models.IntegerField(default=10, help_text='Máximo de pushes por dia por usuário')),
                ('horario_silencio_inicio', models.TimeField(blank=True, help_text='Início do horário de silêncio (ex: 22:00)', null=True)),
                ('horario_silencio_fim', models.TimeField(blank=True, help_text='Fim do horário de silêncio (ex: 08:00)', null=True)),
                ('ultima_atualizacao', models.DateTimeField(auto_now=True)),
                ('atualizado_por', models.ForeignKey(blank=True, db_column='id_admin_atualizador', null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.usuario')),
            ],
            options={
                'db_table': 'configuracao_notificacao_admin',
            },
        ),

        # === 5. Modelo AuditLogChat ===
        migrations.CreateModel(
            name='AuditLogChat',
            fields=[
                ('id_log', models.UUIDField(default=uuid6.uuid7, editable=False, primary_key=True, serialize=False)),
                ('acao', models.CharField(choices=[('view', 'Visualização'), ('moderate', 'Moderação'), ('delete', 'Exclusão'), ('restore', 'Restauração'), ('flag', 'Sinalização'), ('export', 'Exportação')], max_length=20)),
                ('detalhes', models.JSONField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('data_acao', models.DateTimeField(auto_now_add=True)),
                ('conversa', models.ForeignKey(blank=True, db_column='id_conversa', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='core.conversa')),
                ('mensagem', models.ForeignKey(blank=True, db_column='id_mensagem', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='core.mensagemdireta')),
                ('admin', models.ForeignKey(db_column='id_admin', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs_chat', to='core.usuario')),
            ],
            options={
                'db_table': 'audit_log_chat',
                'ordering': ['-data_acao'],
            },
        ),
    ]
