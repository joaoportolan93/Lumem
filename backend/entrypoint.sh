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
# 6. Iniciar Celery Worker em background
# -----------------------------------------------
echo "🔧 Iniciando Celery Worker..."
celery -A dreamshare_backend worker --loglevel=info --concurrency=2 &
CELERY_PID=$!
echo "✅ Celery Worker iniciado (PID: $CELERY_PID)"

# -----------------------------------------------
# 7. Iniciar Daphne (ASGI - suporta HTTP + WebSocket)
# -----------------------------------------------
BACKEND_PORT="${BACKEND_PORT:-8000}"
echo "🚀 Iniciando Daphne (ASGI) na porta ${BACKEND_PORT}..."
exec daphne -b 0.0.0.0 -p "${BACKEND_PORT}" dreamshare_backend.asgi:application
