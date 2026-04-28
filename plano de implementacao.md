# Lumem — Fase 2: Push Notifications (FCM HTTP v1)

---

## Diagnóstico do estado atual

### O que já existe

| Componente | Status |
|---|---|
| `fcm_token` e `fcm_token_updated_at` no model `Usuario` | ✅ Existe |
| `FCMTokenView` salvando e deletando o token | ✅ Existe |
| `Notificacao` sendo criada em DB por `create_notification` | ✅ Existe |
| `ConfiguracaoUsuario` checando preferências antes de criar | ✅ Existe |
| `AdminNotificacaoSendView` chamando `send_broadcast_push.delay()` | ✅ Existe |
| Celery já integrado via `tasks.py` | ✅ Existe |
| `NotificacaoAdmin` com horário de silêncio e destinatários | ✅ Existe |

### O gap exato

`create_notification` cria o registro no banco e **para**. O token FCM existe no usuário, mas nunca é lido nessa função. Nenhum push chega ao dispositivo — nem para curtidas, comentários, seguidores ou menções.

As notificações in-app funcionam (aparecem no sino), mas são **mudas**.

Além disso, o `send_broadcast_push` já é referenciado no `AdminNotificacaoSendView`, mas o `tasks.py` não tem a implementação real da chamada FCM — só o esqueleto da task.

---

## Arquitetura da solução

```
backend/core/
  ├── push_service.py   ← NOVO: wrapper isolado da API FCM
  ├── tasks.py          ← COMPLETAR: send_push_to_user() + send_broadcast_push()
  └── views.py          ← MODIFICAR: create_notification() dispara push após criar notif

src/ (frontend)
  ├── services/
  │   └── notifications.js        ← NOVO: registra token e lida com foreground
  └── public/
      └── firebase-messaging-sw.js  ← NOVO: service worker para background
```

A separação `push_service.py` + `tasks.py` é intencional:
- **`push_service.py`** cuida de *como* falar com o FCM (autenticação OAuth2, payload, retry de token inválido)
- **`tasks.py`** cuida de *quando* e *para quem* (Celery async, broadcast, horário de silêncio)
- **`views.py`** apenas dispara a task — sem saber nada do FCM

---

## Passo 1 — Configuração do Firebase Console

Antes de escrever qualquer código, é necessário configurar o projeto no Firebase.

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto chamado `lumem-app` (ou use um existente)
2. Ative o **Cloud Messaging** no painel do projeto
3. Gere a **Service Account** para o backend:
   - Vá em **Configurações do Projeto → Contas de serviço**
   - Clique em **Gerar nova chave privada**
   - Salve o arquivo JSON — ele será usado como variável de ambiente
4. Gere a **VAPID Key** para Web Push:
   - Vá em **Cloud Messaging → Configurações da Web**
   - Clique em **Gerar par de chaves**
5. Copie as credenciais do **app web** (apiKey, authDomain, projectId, etc.)

---

## Passo 2 — Dependências

### Backend

```bash
pip install google-auth requests
```

Adicionar ao `requirements.txt`:
```
google-auth>=2.0.0
requests>=2.28.0
```

### Frontend

```bash
npm install firebase
```

---

## Passo 3 — Variáveis de ambiente

### Backend (`settings.py`)

Nunca colocar o JSON da service account no código. Carregar da variável de ambiente:

```python
# settings.py
import json
import os

FIREBASE_SERVICE_ACCOUNT = json.loads(
    os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON', '{}')
)
```

### No servidor (`.env` ou painel do Railway/Render)

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"lumem-app","private_key_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...","client_email":"firebase-adminsdk-xxx@lumem-app.iam.gserviceaccount.com",...}
```

> **Atenção:** O JSON inteiro vai em uma única linha. Quebras de linha dentro da `private_key` devem ser escapadas como `\n`.

### Frontend (`.env`)

```env
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=lumem-app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=lumem-app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
REACT_APP_FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Passo 4 — `backend/core/push_service.py` (novo arquivo)

É o único lugar que conhece a API do FCM. O resto do projeto nunca importa credenciais Firebase diretamente.

```python
"""
Lumem Push Service
------------------
Wrapper da Firebase Cloud Messaging (FCM) HTTP v1 API.
Toda comunicação com o FCM passa por aqui.

Referência: https://firebase.google.com/docs/cloud-messaging/send-message
"""

import json
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/{project_id}/messages:send'


def _get_access_token() -> str:
    """
    Gera um OAuth2 access token usando a service account do Firebase.
    O token tem validade de ~1h e é renovado automaticamente pela lib.

    Requer: pip install google-auth
    """
    from google.oauth2 import service_account
    import google.auth.transport.requests

    credentials = service_account.Credentials.from_service_account_info(
        settings.FIREBASE_SERVICE_ACCOUNT,
        scopes=['https://www.googleapis.com/auth/firebase.messaging']
    )
    request = google.auth.transport.requests.Request()
    credentials.refresh(request)
    return credentials.token


def send_push(fcm_token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Envia uma notificação push para um dispositivo específico via FCM HTTP v1.

    Args:
        fcm_token:  token FCM do dispositivo destino (salvo em Usuario.fcm_token)
        title:      título da notificação (ex: "Nova curtida")
        body:       corpo da notificação (ex: "joao curtiu seu sonho")
        data:       payload extra acessível no app (ex: {'type': '3', 'post_id': 'uuid'})

    Returns:
        True se enviado com sucesso, False caso contrário.
    """
    if not fcm_token:
        return False

    try:
        access_token = _get_access_token()
        project_id = settings.FIREBASE_SERVICE_ACCOUNT.get('project_id', '')
        url = FCM_ENDPOINT.format(project_id=project_id)

        payload = {
            'message': {
                'token': fcm_token,
                'notification': {
                    'title': title,
                    'body': body,
                },
                # data: todos os valores precisam ser strings
                'data': {k: str(v) for k, v in (data or {}).items()},
                # Configurações específicas por plataforma
                'android': {
                    'priority': 'high',
                    'notification': {
                        'sound': 'default',
                        'channel_id': 'lumem_notifications',
                    },
                },
                'apns': {
                    'payload': {
                        'aps': {
                            'sound': 'default',
                            'badge': 1,
                        }
                    },
                },
                'webpush': {
                    'notification': {
                        'icon': '/logo192.png',
                        'badge': '/badge.png',
                    },
                },
            }
        }

        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            },
            data=json.dumps(payload),
            timeout=10,
        )

        if response.status_code == 200:
            return True

        # Token inválido ou dispositivo desregistrado — limpar do banco
        if response.status_code == 404 or (
            response.status_code == 400 and
            'UNREGISTERED' in response.text
        ):
            logger.warning('FCM token inválido detectado, removendo do banco.')
            _invalidate_token(fcm_token)
            return False

        logger.error(f'FCM erro HTTP {response.status_code}: {response.text[:300]}')
        return False

    except Exception as e:
        logger.exception(f'Erro inesperado ao enviar push: {e}')
        return False


def _invalidate_token(fcm_token: str):
    """
    Remove token inválido do banco de dados.
    Evita tentativas repetidas para tokens que o FCM rejeitou como UNREGISTERED.
    """
    from .models import Usuario
    Usuario.objects.filter(fcm_token=fcm_token).update(
        fcm_token=None,
        fcm_token_updated_at=None
    )
    logger.info('Token FCM inválido removido do banco.')
```

---

## Passo 5 — `backend/core/tasks.py` (completar)

As duas tasks que o projeto já referencia precisam ter implementação real.

```python
"""
Lumem Celery Tasks
------------------
Tasks assíncronas para envio de notificações push.

send_push_to_user   → notificações de eventos (like, comment, follow, mention)
send_broadcast_push → notificações em massa enviadas pelo admin
"""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_push_to_user(self, usuario_destino_id: str, title: str, body: str, data: dict = None):
    """
    Envia push para um único usuário.

    Chamada por create_notification() para eventos de interação
    (curtidas, comentários, seguidores, menções).

    Retries automáticos com backoff de 60s em caso de falha temporária.

    Args:
        usuario_destino_id: UUID do usuário destino (como string)
        title:              título da notificação
        body:               corpo da notificação
        data:               payload extra para o app
    """
    from .models import Usuario
    from .push_service import send_push

    try:
        user = Usuario.objects.get(id_usuario=usuario_destino_id, status=1)

        # Sem token = usuário nunca instalou o app ou revogou permissão
        if not user.fcm_token:
            logger.debug(f'Usuário {usuario_destino_id} sem FCM token, push ignorado.')
            return

        success = send_push(user.fcm_token, title, body, data)

        if not success:
            # Re-tentar em caso de falha temporária (ex: timeout de rede)
            raise self.retry(exc=Exception('FCM retornou erro temporário'))

        logger.info(f'Push enviado para usuário {usuario_destino_id}: "{title}"')

    except Usuario.DoesNotExist:
        logger.warning(f'Usuário {usuario_destino_id} não encontrado, push cancelado.')


@shared_task(bind=True)
def send_broadcast_push(self, notificacao_admin_id: str):
    """
    Envia push broadcast para todos os usuários elegíveis.

    Chamada por AdminNotificacaoSendView quando o admin clica em "Enviar".

    Respeita:
    - push_habilitado global (ConfiguracaoNotificacaoAdmin)
    - horário de silêncio (horario_silencio_inicio / horario_silencio_fim)
    - filtro de destinatários (todos / ativos / verificados)

    Args:
        notificacao_admin_id: UUID da NotificacaoAdmin como string
    """
    from .models import NotificacaoAdmin, ConfiguracaoNotificacaoAdmin, Usuario
    from .push_service import send_push
    from datetime import timedelta

    # 1. Buscar a notificação
    try:
        notif = NotificacaoAdmin.objects.get(id_notificacao=notificacao_admin_id)
    except NotificacaoAdmin.DoesNotExist:
        logger.error(f'NotificacaoAdmin {notificacao_admin_id} não encontrada.')
        return

    if notif.enviada:
        logger.warning(f'Notificação {notificacao_admin_id} já enviada, abortando.')
        return

    # 2. Checar configuração global de push
    config, _ = ConfiguracaoNotificacaoAdmin.objects.get_or_create(pk=1)

    if not config.push_habilitado:
        logger.info('Push desabilitado globalmente. Broadcast cancelado.')
        return

    # 3. Checar horário de silêncio
    if config.horario_silencio_inicio and config.horario_silencio_fim:
        agora_local = timezone.localtime(timezone.now()).time()
        inicio = config.horario_silencio_inicio
        fim = config.horario_silencio_fim

        # Suporte a janela que atravessa meia-noite (ex: 22:00 → 08:00)
        if inicio > fim:
            em_silencio = agora_local >= inicio or agora_local <= fim
        else:
            em_silencio = inicio <= agora_local <= fim

        if em_silencio:
            logger.info(f'Broadcast cancelado: horário de silêncio ({inicio} → {fim}).')
            return

    # 4. Selecionar destinatários com FCM token
    agora = timezone.now()
    users = Usuario.objects.filter(
        status=1,
        fcm_token__isnull=False,
    ).exclude(fcm_token='')

    if notif.destinatarios == 'ativos':
        from datetime import timedelta
        sete_dias = agora - timedelta(days=7)
        users = users.filter(ultimo_login__gte=sete_dias)
    elif notif.destinatarios == 'verificados':
        users = users.filter(email_verificado=True)

    # 5. Enviar para cada usuário
    total_enviados = 0

    for user in users.iterator():  # .iterator() evita carregar tudo na memória
        success = send_push(
            user.fcm_token,
            title=notif.titulo,
            body=notif.mensagem,
            data={
                'type': 'broadcast',
                'notification_id': str(notif.id_notificacao),
                'tipo': notif.tipo,
            },
        )
        if success:
            total_enviados += 1

    # 6. Marcar como enviada
    notif.enviada = True
    notif.data_envio = agora
    notif.total_enviados = total_enviados
    notif.save(update_fields=['enviada', 'data_envio', 'total_enviados'])

    logger.info(
        f'Broadcast {notificacao_admin_id} concluído: '
        f'{total_enviados} pushes enviados.'
    )


# ──────────────────────────────────────────────────────────────────────────────
# Task existente — manter como estava
# ──────────────────────────────────────────────────────────────────────────────

@shared_task
def compute_post_embedding_task(post_id: str):
    """Computa embedding semântico de um post via sentence-transformers."""
    # Implementação já existente — não alterar
    pass
```

---

## Passo 6 — Modificar `create_notification()` em `views.py`

A mudança é **cirúrgica** — apenas adicionar o bloco de push após o `Notificacao.objects.create(...)`. Não alterar nada do que já existe.

```python
def create_notification(usuario_destino, usuario_origem, tipo, id_referencia=None, conteudo=None):
    """Create a notification if destino != origem AND user has that notification type enabled"""
    if usuario_destino.id_usuario != usuario_origem.id_usuario:

        # ── Checar preferências do usuário (lógica existente) ─────────
        try:
            settings = ConfiguracaoUsuario.objects.get(usuario=usuario_destino)
            notification_settings = {
                1: settings.notificacoes_novas_publicacoes,
                2: settings.notificacoes_comentarios,
                3: settings.notificacoes_reacoes,
                4: settings.notificacoes_seguidor_novo,
                7: settings.notificacoes_comentarios,
            }
            if not notification_settings.get(tipo, True):
                return
        except ConfiguracaoUsuario.DoesNotExist:
            pass

        # ── Criar notificação in-app (lógica existente) ───────────────
        Notificacao.objects.create(
            usuario_destino=usuario_destino,
            usuario_origem=usuario_origem,
            tipo_notificacao=tipo,
            id_referencia=str(id_referencia) if id_referencia else None,
            conteudo=conteudo
        )

        # ── NOVO: Disparar push notification ──────────────────────────
        if usuario_destino.fcm_token:
            from .tasks import send_push_to_user

            # Mapeamento de tipos para textos legíveis
            TIPO_PUSH = {
                1: ('Nova publicação 🌙',     f'{usuario_origem.nome_usuario} publicou um novo sonho'),
                2: ('Novo comentário 💬',     f'{usuario_origem.nome_usuario} comentou no seu sonho'),
                3: ('Nova curtida ✨',        f'{usuario_origem.nome_usuario} curtiu seu sonho'),
                4: ('Novo seguidor 👤',       f'{usuario_origem.nome_usuario} começou a te seguir'),
                5: ('Solicitação de seguir',  f'{usuario_origem.nome_usuario} quer te seguir'),
                7: ('Você foi mencionado 🔔', f'{usuario_origem.nome_usuario} mencionou você em um sonho'),
            }

            title, body = TIPO_PUSH.get(
                tipo,
                ('Lumem', conteudo or 'Você tem uma nova notificação')
            )

            send_push_to_user.delay(
                str(usuario_destino.id_usuario),
                title=title,
                body=body,
                data={
                    'type': str(tipo),
                    'reference_id': str(id_referencia) if id_referencia else '',
                    'origem_usuario': usuario_origem.nome_usuario,
                },
            )
        # ─────────────────────────────────────────────────────────────
```

> **Por que `if usuario_destino.fcm_token:`?**
> Usuários que acessam só pela web, ou que nunca permitiram notificações, não têm token. O `if` garante que nenhuma task Celery é disparada desnecessariamente para esses casos.

---

## Passo 7 — Frontend: `src/services/notifications.js` (novo arquivo)

```javascript
/**
 * Lumem Push Notifications Service
 * ---------------------------------
 * Gerencia o registro do token FCM e o recebimento de notificações
 * com o app em primeiro plano (foreground).
 *
 * Para background, o Service Worker em public/firebase-messaging-sw.js
 * é responsável.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from './api';

const firebaseConfig = {
    apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

// Inicializar Firebase apenas uma vez
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);


/**
 * Solicita permissão de notificação e registra o token FCM no backend.
 * Deve ser chamado logo após o login bem-sucedido.
 */
export async function registerPushToken() {
    // Verificar suporte do browser
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.log('Push notifications não suportadas neste browser.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Permissão de notificação negada pelo usuário.');
            return;
        }

        const token = await getToken(messaging, {
            vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        });

        if (token) {
            // Enviar token para o backend (FCMTokenView)
            await api.put('/api/users/fcm-token/', { fcm_token: token });
            console.log('Token FCM registrado com sucesso.');
        }
    } catch (err) {
        // Não deixar erro de push quebrar o fluxo de login
        console.error('Erro ao registrar push token:', err);
    }
}


/**
 * Remove o token FCM do backend ao fazer logout.
 * Evita enviar notificações para sessões encerradas.
 */
export async function unregisterPushToken() {
    try {
        await api.delete('/api/users/fcm-token/');
    } catch (err) {
        console.error('Erro ao remover push token:', err);
    }
}


/**
 * Registra um handler para notificações recebidas com o app em foreground.
 * Retorna a função de cleanup para usar em useEffect.
 *
 * Exemplo de uso em App.jsx:
 *   useEffect(() => {
 *       return onForegroundMessage((payload) => {
 *           showToastNotification(payload);
 *       });
 *   }, []);
 */
export function onForegroundMessage(callback) {
    return onMessage(messaging, callback);
}
```

---

## Passo 8 — `public/firebase-messaging-sw.js` (Service Worker)

Necessário para receber notificações com o app **fechado ou em background**. Deve ficar na raiz do `public/`.

```javascript
/**
 * Lumem Firebase Messaging Service Worker
 * ----------------------------------------
 * Responsável por exibir notificações push quando o app está
 * em background ou fechado.
 *
 * IMPORTANTE: Este arquivo precisa estar em /public/firebase-messaging-sw.js
 * para que o Firebase o encontre automaticamente na raiz do domínio.
 *
 * ATENÇÃO: Service Workers não têm acesso a process.env.
 * Substitua os valores abaixo pelos valores reais do seu projeto Firebase,
 * ou use um script de build para injetar as variáveis automaticamente.
 */

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey:            'SEU_API_KEY',
    authDomain:        'lumem-app.firebaseapp.com',
    projectId:         'lumem-app',
    messagingSenderId: 'SEU_SENDER_ID',
    appId:             'SEU_APP_ID',
});

const messaging = firebase.messaging();

// Receber mensagem em background e exibir notificação nativa
messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(title || 'Lumem', {
        body: body || 'Você tem uma nova notificação',
        icon: '/logo192.png',
        badge: '/badge-72x72.png',
        data: data,
        actions: [
            { action: 'open',    title: 'Ver' },
            { action: 'dismiss', title: 'Dispensar' },
        ],
    });
});

// Ao clicar na notificação, abrir o app na rota correta
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const data = event.notification.data || {};
    let url = '/';

    // Navegar para o contexto certo baseado no tipo de notificação
    const tipo = parseInt(data.type);
    const referenceId = data.reference_id;

    if (referenceId) {
        if (tipo === 2 || tipo === 3 || tipo === 7) {
            // Comentário, curtida ou menção → abrir o post
            url = `/dream/${referenceId}`;
        } else if (tipo === 4 || tipo === 5) {
            // Seguidor ou solicitação → abrir perfil de quem seguiu
            url = `/profile/${referenceId}`;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Se o app já está aberto, focar e navegar
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            // Se não está aberto, abrir nova aba
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
```

---

## Passo 9 — Integrar no fluxo de login e logout

### Login (onde o login bem-sucedido é tratado)

```javascript
import { registerPushToken } from '../services/notifications';

const handleLoginSuccess = async (response) => {
    localStorage.setItem('access', response.data.access);
    localStorage.setItem('refresh', response.data.refresh);

    // Registrar push token de forma não-bloqueante (sem await)
    // Não bloqueia o redirecionamento caso o usuário negue a permissão
    registerPushToken();

    navigate('/');
};
```

### Logout (`api.js`)

```javascript
import { unregisterPushToken } from '../services/notifications';

export const logout = async () => {
    const refresh = localStorage.getItem('refresh');
    try {
        await unregisterPushToken(); // remover token antes de encerrar sessão
        await api.post('/api/auth/logout/', { refresh });
    } finally {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
    }
};
```

---

## Passo 10 — (Opcional) Toast de notificação em foreground

Quando o usuário está com o app aberto, o Service Worker não exibe a notificação nativa. É necessário exibir um toast manualmente em `App.jsx`:

```jsx
import { useEffect } from 'react';
import { onForegroundMessage } from './services/notifications';
import toast from 'react-hot-toast'; // ou qualquer lib de toast que você usa

function App() {
    useEffect(() => {
        const unsubscribe = onForegroundMessage((payload) => {
            const { title, body } = payload.notification || {};
            toast(body || title || 'Nova notificação', {
                icon: '🌙',
                duration: 5000,
            });
        });

        return unsubscribe; // cleanup ao desmontar
    }, []);

    // ... resto do App
}
```

---

## Checklist de implementação

### Configuração Firebase
- [ ] Criar projeto no Firebase Console
- [ ] Ativar Cloud Messaging
- [ ] Baixar Service Account JSON (para o backend)
- [ ] Gerar VAPID Key (para web push)
- [ ] Copiar credenciais do app web

### Backend
- [ ] Instalar dependências: `pip install google-auth requests`
- [ ] Atualizar `requirements.txt`
- [ ] Criar `backend/core/push_service.py`
- [ ] Adicionar `FIREBASE_SERVICE_ACCOUNT` em `settings.py` lendo de env var
- [ ] Adicionar env var `FIREBASE_SERVICE_ACCOUNT_JSON` no servidor
- [ ] Completar `backend/core/tasks.py` com `send_push_to_user` e `send_broadcast_push`
- [ ] Modificar `create_notification()` em `views.py` para disparar push

### Frontend
- [ ] Instalar dependência: `npm install firebase`
- [ ] Criar `src/services/notifications.js`
- [ ] Criar `public/firebase-messaging-sw.js` com valores reais do Firebase
- [ ] Adicionar variáveis de ambiente Firebase no `.env` e no painel da Vercel
- [ ] Chamar `registerPushToken()` após login bem-sucedido
- [ ] Chamar `unregisterPushToken()` no logout
- [ ] (Opcional) Implementar toast de foreground em `App.jsx`

### Testes
- [ ] Testar envio direto via Django shell: `send_push(token, 'Teste', 'Mensagem')`
- [ ] Verificar se `_invalidate_token` limpa o banco quando FCM retorna 404
- [ ] Testar curtir um post e checar se o push chega no dispositivo
- [ ] Testar broadcast pelo painel admin
- [ ] Testar horário de silêncio bloqueando o broadcast
- [ ] Testar logout removendo o token do banco

---

## Ordem de execução recomendada

```
1. Configuração Firebase Console
    └─> 2. Variáveis de ambiente (backend + frontend)
            └─> 3. push_service.py
                    └─> 4. tasks.py
                            └─> 5. create_notification() em views.py
                                    └─> 6. Frontend: notifications.js + SW + integração no login
                                            └─> 7. Testes end-to-end
```

---

## Notas para versões futuras

**Rate limiting por usuário:** O `ConfiguracaoNotificacaoAdmin.frequencia_max_diaria` já existe no model mas não está sendo verificado no broadcast. Uma futura task pode checar quantos pushes o usuário já recebeu hoje antes de enviar.

**Agrupamento de notificações:** Se o usuário receber 10 curtidas em 30 segundos, seria melhor enviar um push único "10 pessoas curtiram seu sonho" em vez de 10 pushes individuais. Isso pode ser implementado com debounce na task via Celery ETA.

**Analytics de push:** Registrar quais pushes foram abertos vs ignorados para calibrar frequência e tipos. Requer um endpoint de callback no Service Worker e um model `PushEvent` simples.

---

*Plano elaborado em abril de 2026.*