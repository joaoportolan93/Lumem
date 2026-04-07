"""
Configuração do Celery para o projeto Lumem.
Broker: Redis (lido de settings.CELERY_BROKER_URL)
"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dreamshare_backend.settings')

app = Celery('dreamshare_backend')

# Lê configurações do Django settings (variáveis com prefixo CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-descobre tasks em todos os apps registrados
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Task de teste para verificar se o Celery está funcionando."""
    print(f'Request: {self.request!r}')
