#!/bin/bash
set -e

echo "=========================================="
echo "  Dream Share Backend - Entrypoint"
echo "=========================================="

# -----------------------------------------------
# 1. Esperar PostgreSQL ficar disponível
# -----------------------------------------------
if [ "$DB_ENGINE" = "django.db.backends.postgresql" ]; then
    echo "⏳ Aguardando PostgreSQL em ${DB_HOST}:${DB_PORT}..."
    while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q 2>/dev/null; do
        echo "   PostgreSQL não disponível ainda, tentando em 2s..."
        sleep 2
    done
    echo "✅ PostgreSQL disponível!"
fi

# -----------------------------------------------
# 2. Migrações
# -----------------------------------------------
echo "🔄 Aplicando migrações..."
python manage.py migrate --noinput

# -----------------------------------------------
# 3. Collectstatic
# -----------------------------------------------
echo "📦 Coletando arquivos estáticos..."
python manage.py collectstatic --noinput

# -----------------------------------------------
# 4. Seed condicional
# -----------------------------------------------
if [ "${RUN_SEED,,}" = "true" ]; then
    echo "🌱 Rodando seed de dados..."
    python manage.py seed || echo "⚠️  Seed de dados já executado ou falhou"
    python seed_communities.py || echo "⚠️  Seed de comunidades já executado ou falhou"
    echo "✅ Seed concluído!"
fi

# -----------------------------------------------
# 5. Iniciar Gunicorn
# -----------------------------------------------
BACKEND_PORT="${BACKEND_PORT:-8000}"
echo "🚀 Iniciando Gunicorn na porta ${BACKEND_PORT}..."
exec gunicorn dreamshare_backend.wsgi:application \
    --bind "0.0.0.0:${BACKEND_PORT}" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
