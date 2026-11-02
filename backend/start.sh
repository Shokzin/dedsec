#!/bin/sh
# Sobe o trabalhador do Celery e a API no mesmo contentor.
#
# Em desenvolvimento sao dois servicos separados no docker-compose, que e o
# arranjo correto: cada um escala por conta propria. Na hospedagem gratuita
# escolhida, porem, um processo de segundo plano em separado e recurso pago,
# entao os dois dividem o mesmo contentor. O desenho continua o mesmo, com a
# fila no Redis entre eles; muda apenas onde cada processo roda.
set -e

: "${PORT:=8000}"                 # a hospedagem informa a porta por variavel
: "${CELERY_CONCURRENCY:=2}"      # o plano gratuito tem pouca memoria

encerrar() {
    echo "encerrando..."
    [ -n "$PID_WORKER" ] && kill "$PID_WORKER" 2>/dev/null || true
    exit 0
}
trap encerrar INT TERM

echo "iniciando trabalhador do Celery (concorrencia $CELERY_CONCURRENCY)"
celery -A worker.celery_app worker \
    --loglevel=info \
    --concurrency="$CELERY_CONCURRENCY" &
PID_WORKER=$!

echo "iniciando API na porta $PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
