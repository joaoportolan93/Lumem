#!/bin/bash
set -e

echo "=========================================="
echo "  Lumem Backend - Entrypoint"
echo "=========================================="

# -----------------------------------------------
# 1. Esperar MySQL ficar disponível
# -----------------------------------------------
if [ "$DB_ENGINE" = "django.db.backends.mysql" ]; then
    echo "⏳ Aguardando MySQL em ${DB_HOST}:${DB_PORT}..."
    while ! mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" --silent 2>/dev/null; do
        echo "   MySQL não disponível ainda, tentando em 2s..."
        sleep 2
    done
    echo "✅ MySQL disponível!"
fi

# -----------------------------------------------
# 2. Esperar Redis ficar disponível
# -----------------------------------------------
if [ -n "$REDIS_URL" ]; then
    # Extrair host e porta da REDIS_URL (redis://host:port/db)
    REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+):([0-9]+)/.*|\1|')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+):([0-9]+)/.*|\2|')
    echo "⏳ Aguardando Redis em ${REDIS_HOST}:${REDIS_PORT}..."
    while ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; do
        echo "   Redis não disponível ainda, tentando em 2s..."
        sleep 2
    done
    echo "✅ Redis disponível!"
fi

# -----------------------------------------------
# 3. Migrações
# -----------------------------------------------
echo "🔄 Aplicando migrações..."
python manage.py migrate --noinput

# -----------------------------------------------
# 4. Collectstatic
# -----------------------------------------------
echo "📦 Coletando arquivos estáticos..."
python manage.py collectstatic --noinput

# -----------------------------------------------
# 5. Seed condicional
# -----------------------------------------------
if [ "${RUN_SEED,,}" = "true" ]; then
    echo "🌱 Rodando seed de dados..."
    python manage.py seed || echo "⚠️  Seed de dados já executado ou falhou"
    python seed_communities.py || echo "⚠️  Seed de comunidades já executado ou falhou"
    echo "✅ Seed concluído!"
fi

# -----------------------------------------------
# 6. Backfill de embeddings (posts sem vetor semântico)
# -----------------------------------------------
echo "🧠 Verificando posts sem embedding..."
python manage.py shell -c "
from core.models import Publicacao, PostEmbedding

total_posts = Publicacao.objects.count()
total_embeddings = PostEmbedding.objects.count()
sem_embedding = total_posts - total_embeddings

if sem_embedding > 0:
    print(f'   Encontrados {sem_embedding} posts sem embedding.')
    print(f'   O Celery Worker vai processar em background.')
    
    from core.tasks import compute_post_embedding_task
    
    ids_sem_embedding = Publicacao.objects.exclude(
        id_publicacao__in=PostEmbedding.objects.values_list('publicacao_id', flat=True)
    ).values_list('id_publicacao', flat=True)[:500]
    
    for pid in ids_sem_embedding:
        compute_post_embedding_task.delay(str(pid))
    
    print(f'   ✅ {len(ids_sem_embedding)} tasks de embedding enfileiradas no Celery.')
else:
    print(f'   ✅ Todos os {total_posts} posts já possuem embeddings.')
" || echo "⚠️  Backfill de embeddings falhou (não-crítico, será processado depois)"

# -----------------------------------------------
# 7. Iniciar Daphne (ASGI - suporta HTTP + WebSocket)
# -----------------------------------------------
BACKEND_PORT="${BACKEND_PORT:-8000}"
echo "🚀 Iniciando Daphne (ASGI) na porta ${BACKEND_PORT}..."
exec daphne -b 0.0.0.0 -p "${BACKEND_PORT}" dreamshare_backend.asgi:application
