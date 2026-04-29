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

// Validar se as configurações essenciais estão presentes
const isFirebaseConfigValid = firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId;

// Inicializar Firebase apenas uma vez (com proteção contra config ausente)
let app = null;
let messaging = null;

if (isFirebaseConfigValid) {
    try {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

        // Messaging só funciona em browsers com suporte a Service Workers
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            messaging = getMessaging(app);
        }
    } catch (err) {
        console.warn('Firebase não pôde ser inicializado:', err);
    }
} else {
    console.warn('Configuração do Firebase incompleta. Push notifications desabilitadas.');
}


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

    if (!messaging) {
        console.log('Firebase Messaging não inicializado.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Permissão de notificação negada pelo usuário.');
            return;
        }

        // Registrar o Service Worker explicitamente antes de pedir o token
        const swRegistration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
        );

        const token = await getToken(messaging, {
            vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
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
 * Exemplo de uso em App.js:
 *   useEffect(() => {
 *       return onForegroundMessage((payload) => {
 *           showToastNotification(payload);
 *       });
 *   }, []);
 */
export function onForegroundMessage(callback) {
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
}
