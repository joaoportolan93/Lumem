# Lumem

Lumem é uma rede social para sonhadores: compartilhe seus sonhos, curta e comente os sonhos de outras pessoas, e conecte-se com uma comunidade de pessoas que acreditam no poder dos sonhos.

## ✨ Funcionalidades

- **Feed de sonhos** – veja os sonhos publicados pelas pessoas que você segue.
- **Publicar sonho** – crie e compartilhe um sonho com título, descrição e visibilidade pública ou privada.
- **Curtidas e comentários** – interaja com os sonhos de outros usuários.
- **Explorar** – descubra novos usuários e siga quem inspira você.
- **Notificações** – receba alertas de curtidas, comentários e novos seguidores.
- **Comunidades** – participe de grupos temáticos de sonhadores.
- **Perfil** – veja seus sonhos publicados e seus seguidores.

## 🚀 Como rodar

### Pré-requisitos

- [Flutter SDK](https://flutter.dev/docs/get-started/install) (versão 3.x ou superior)
- Dart SDK (incluso no Flutter)
- Android Studio ou Xcode (para emulador/simulador)
- Backend da API rodando (veja o repositório `backend/`)

### Configuração

1. Copie o arquivo de variáveis de ambiente:
   ```bash
   cp mobile/.env.example mobile/.env
   ```
2. Preencha `API_BASE_URL` com a URL do seu backend (ex.: `http://10.0.2.2:8000/api/`).

### Instalação e execução

```bash
cd mobile
flutter pub get
flutter run
```

## 🗂️ Estrutura do projeto

```
mobile/
├── lib/
│   ├── main.dart          # Ponto de entrada
│   ├── app.dart           # Configuração de rotas e tema
│   ├── models/            # Modelos de dados (Dream, User, …)
│   ├── services/          # Comunicação com a API
│   ├── views/
│   │   ├── screens/       # Telas do app
│   │   └── widgets/       # Componentes reutilizáveis
│   └── util/              # Utilitários, constantes e tema
├── android/               # Configurações Android
├── ios/                   # Configurações iOS
└── web/                   # Configurações Web (PWA)
```

## 📄 Licença

Este projeto é de uso acadêmico/educacional.
