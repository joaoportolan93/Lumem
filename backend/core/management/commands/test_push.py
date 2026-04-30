"""
Comando de gerenciamento: test_push
------------------------------------
Verifica se a infraestrutura de push notifications está configurada
corretamente no servidor.

Uso:
    python manage.py test_push                  # Testa só a configuração
    python manage.py test_push --send <email>   # Envia push real para o usuário
"""
import os
import sys
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = 'Testa a configuração de push notifications (FCM HTTP v1)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--send',
            type=str,
            help='Email do usuário para enviar um push de teste real.',
        )

    def handle(self, *args, **options):
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  TESTE DE PUSH NOTIFICATIONS - Lumem')
        self.stdout.write('=' * 60 + '\n')

        passed = 0
        failed = 0

        # ─── Teste 1: Variáveis de ambiente ───────────────────────
        self.stdout.write(self.style.HTTP_INFO('[1/5] Variáveis de ambiente...'))

        creds_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)
        project_id = getattr(settings, 'FIREBASE_PROJECT_ID', None)

        if creds_path:
            self.stdout.write(self.style.SUCCESS(f'  ✓ FIREBASE_CREDENTIALS_PATH = {creds_path}'))
            passed += 1
        else:
            self.stdout.write(self.style.ERROR('  ✗ FIREBASE_CREDENTIALS_PATH não definido no settings.py'))
            failed += 1

        if project_id:
            self.stdout.write(self.style.SUCCESS(f'  ✓ FIREBASE_PROJECT_ID = {project_id}'))
            passed += 1
        else:
            self.stdout.write(self.style.ERROR('  ✗ FIREBASE_PROJECT_ID não definido no settings.py'))
            failed += 1

        # ─── Teste 2: Arquivo de credenciais ──────────────────────
        self.stdout.write(self.style.HTTP_INFO('\n[2/5] Arquivo de credenciais...'))

        if creds_path and os.path.exists(creds_path):
            size = os.path.getsize(creds_path)
            self.stdout.write(self.style.SUCCESS(f'  ✓ Arquivo encontrado ({size} bytes)'))
            passed += 1

            # Validar se é um JSON válido com os campos esperados
            import json
            try:
                with open(creds_path, 'r') as f:
                    creds_data = json.load(f)

                required_fields = ['type', 'project_id', 'private_key', 'client_email']
                missing = [f for f in required_fields if f not in creds_data]

                if not missing:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ JSON válido com campos obrigatórios'))
                    self.stdout.write(f'    → type: {creds_data.get("type")}')
                    self.stdout.write(f'    → project_id: {creds_data.get("project_id")}')
                    self.stdout.write(f'    → client_email: {creds_data.get("client_email")}')
                    passed += 1
                else:
                    self.stdout.write(self.style.ERROR(f'  ✗ Campos faltando: {missing}'))
                    failed += 1

            except json.JSONDecodeError:
                self.stdout.write(self.style.ERROR('  ✗ Arquivo não é JSON válido'))
                failed += 1
        else:
            self.stdout.write(self.style.ERROR(f'  ✗ Arquivo NÃO encontrado em: {creds_path}'))
            failed += 1

        # ─── Teste 3: google-auth instalado ───────────────────────
        self.stdout.write(self.style.HTTP_INFO('\n[3/5] Dependência google-auth...'))

        try:
            import google.auth
            self.stdout.write(self.style.SUCCESS(f'  ✓ google-auth {google.auth.__version__} instalado'))
            passed += 1
        except ImportError:
            self.stdout.write(self.style.ERROR('  ✗ google-auth NÃO instalado (pip install google-auth)'))
            failed += 1

        # ─── Teste 4: Obter access token ─────────────────────────
        self.stdout.write(self.style.HTTP_INFO('\n[4/5] Autenticação OAuth2 com FCM...'))

        access_token = None
        try:
            from core.push_service import _get_access_token
            access_token = _get_access_token()

            if access_token:
                preview = access_token[:20] + '...'
                self.stdout.write(self.style.SUCCESS(f'  ✓ Access token obtido: {preview}'))
                passed += 1
            else:
                self.stdout.write(self.style.ERROR('  ✗ Token retornou vazio'))
                failed += 1

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Falha na autenticação: {e}'))
            failed += 1

        # ─── Teste 5: Usuários com fcm_token ─────────────────────
        self.stdout.write(self.style.HTTP_INFO('\n[5/5] Tokens FCM no banco de dados...'))

        try:
            from core.models import Usuario
            total_users = Usuario.objects.filter(status=1).count()
            with_token = Usuario.objects.filter(status=1).exclude(fcm_token__isnull=True).exclude(fcm_token='').count()

            self.stdout.write(f'  → Usuários ativos: {total_users}')
            self.stdout.write(f'  → Com FCM token:   {with_token}')

            if with_token > 0:
                self.stdout.write(self.style.SUCCESS(f'  ✓ {with_token} usuário(s) prontos para receber push'))
                passed += 1
            else:
                self.stdout.write(self.style.WARNING('  ⚠ Nenhum usuário tem token FCM registrado (normal se ninguém fez login no browser ainda)'))
                passed += 1  # Não é erro, é esperado

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Erro ao consultar banco: {e}'))
            failed += 1

        # ─── Envio de teste real (opcional) ───────────────────────
        if options.get('send'):
            email = options['send']
            self.stdout.write(self.style.HTTP_INFO(f'\n[EXTRA] Enviando push de teste para {email}...'))

            try:
                from core.models import Usuario
                user = Usuario.objects.get(email=email, status=1)

                if not user.fcm_token:
                    self.stdout.write(self.style.ERROR(
                        f'  ✗ Usuário {email} não tem FCM token. '
                        f'Ele precisa fazer login no browser e permitir notificações primeiro.'
                    ))
                    failed += 1
                else:
                    from core.push_service import send_push
                    send_push(
                        fcm_token=user.fcm_token,
                        title='Teste de Push 🚀',
                        body='Se você recebeu isso, as push notifications estão funcionando!',
                        data={'type': 'test', 'url': '/'}
                    )
                    self.stdout.write(self.style.SUCCESS('  ✓ Push de teste enviado com sucesso!'))
                    passed += 1

            except Usuario.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'  ✗ Usuário com email "{email}" não encontrado'))
                failed += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Falha no envio: {e}'))
                failed += 1

        # ─── Resultado final ─────────────────────────────────────
        self.stdout.write('\n' + '=' * 60)
        total = passed + failed
        if failed == 0:
            self.stdout.write(self.style.SUCCESS(f'  RESULTADO: {passed}/{total} testes passaram ✓'))
        else:
            self.stdout.write(self.style.ERROR(f'  RESULTADO: {failed}/{total} testes falharam ✗'))
        self.stdout.write('=' * 60 + '\n')

        if failed > 0:
            sys.exit(1)
