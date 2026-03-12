import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';
import './i18n';

const GOOGLE_CLIENT_ID = '476192161837-jk2fu0s79v403rl9cqptkqp3cckpns69.apps.googleusercontent.com';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>
);
