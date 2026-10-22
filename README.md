# Conecta Segura

Aplicativo web de apoio e proteção com contatos de confiança, localização e acionamento SOS. PWA responsiva em português, com identidade roxa e rosa, tutorial de seis passos, narração opcional, texto maior, contraste e modo leitura.

O SOS funciona segurando por três segundos (toque, mouse, Enter ou Espaço) ou confirmando pelo botão de toque. Depois há cinco segundos para cancelar. Trocar de aba durante a contagem cancela o pedido. O aplicativo não liga para serviços públicos automaticamente.

## Versão pública no GitHub Pages

O Pages publica somente a interface estática. A demonstração, contatos locais, tipos de ocorrência, localização pelo navegador, links Google Maps, tutorial, acessibilidade e modo leitura funcionam sem backend. Não é necessário entrar no ChatGPT nem criar conta para explorar essa versão.

**Por padrão, login, mapa incorporado e SMS/WhatsApp automáticos estão pendentes e desativados.** O SOS de demonstração nunca envia mensagens. Nos contatos, os atalhos manuais abrem um rascunho real no SMS ou WhatsApp; você ainda precisa confirmar o envio no aplicativo correspondente. Abrir o rascunho não comprova envio nem entrega. Não use destinatários reais nos testes automatizados.

## Arquitetura

| Arquivo/diretório | Responsabilidade |
| --- | --- |
| `src/index.html`, `app.js`, `style.css` | Interface sem framework e sem pacotes de produção |
| `src/server.js`, `handler.js` | API, autenticação Firebase, validação, limites e integração Twilio |
| `scripts/compile.mjs` | Gera `worker/index.js`, com os recursos da interface incorporados |
| `scripts/local.mjs` | Servidor Node com SQLite, apenas em `127.0.0.1` |
| `drizzle/` | Migração SQLite/D1 |
| `scripts/build-pages.mjs`, `pwa.mjs` | Saída estática e recursos PWA relativos ao prefixo do repositório |
| `.github/workflows/pages.yml` | Testes, build e publicação automática |

O backend continua no repositório para implantação futura. A configuração genérica `.openai/hosting.json` declara somente D1/DB, sem identidade de Site anterior. O Pages não recebe esse arquivo, o Worker, bancos, variáveis privadas ou código de servidor.

## Executar o aplicativo completo

Use **Node.js 24**. Os comandos são compatíveis com Windows, Linux e macOS. Não há dependências de produção; o lockfile permite `npm ci` reproduzível.

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Abra `http://localhost:3000`. Se precisar configurar integrações, copie `.env.example` para `.env` (no PowerShell: `Copy-Item .env.example .env`) e preencha localmente. Nunca publique `.env` ou `.data/`. O SQLite é criado em `.data/conecta.sqlite` e a migração é aplicada na inicialização. Execute o build após alterar `src/`.

```sh
npm test
npm run validate
```

`npm test` recompila o Worker antes dos testes. `npm run validate` verifica o artefato do aplicativo completo gerado por `npm run build`.

## Gerar e testar o Pages

```sh
npm run build:pages
npm run preview:pages
```

Abra `http://localhost:4173/conecta-segura/`. Para um nome diferente, defina `PAGES_REPOSITORY` ao executar o preview. A pasta publicável é **somente `dist-pages/`**. Ela contém HTML, JS, CSS, ícones, manifesto, configuração pública, guia e service worker; não é necessário um servidor Node em produção.

Scripts, estilos, ícones, guia, registro do service worker e manifesto usam URLs relativas. `start_url`, `id` e `scope` resolvem para o diretório do aplicativo. O cache é separado pelo caminho e versionado pelo conteúdo. O tutorial técnico também está disponível offline após o primeiro carregamento bem-sucedido. Nenhuma API ou resposta de autenticação é armazenada no cache.

O build usa uma lista fechada de recursos e não lê `.env`. Sem backend, `runtime-config.js` contém apenas valores públicos seguros e não há requisições a `/api/config` ou `/api/alerts` no domínio do Pages.

## Publicação automática

Em Settings → Pages, a fonte deve ser **GitHub Actions**. O workflow executa em pushes para `main` e por acionamento manual em Actions. Ele usa Node 24, instala pelo lockfile, executa testes, verifica o build completo, gera a saída estática e publica apenas `dist-pages/`.

O job de build tem `contents: read`. Só o job de deploy recebe `pages: write` e `id-token: write`. Não é necessário salvar um token pessoal no repositório. Versões e configuração foram conferidas nas [instruções oficiais do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [setup-node](https://github.com/actions/setup-node) e [checkout](https://github.com/actions/checkout).

## Conectar um backend externo posteriormente

Nenhuma URL de backend de produção acompanha esta exportação. Para ligar os serviços:

1. Implante `worker/index.js` em um Worker com binding D1 chamado `DB`, aplicando `drizzle/0000_alerts.sql`, ou use um servidor Node com SQLite e HTTPS. `npm start` é um servidor local; para produção adapte deliberadamente host, URL externa e proxy confiável. Não confie em headers de identidade enviados pelo cliente.
2. Configure as variáveis secretas no servidor. Mantenha `LIVE_ALERTS_ENABLED=false` até completar autenticação e testes dos provedores.
3. No backend, configure `ALLOWED_ORIGINS` com a origem HTTPS exata do frontend (por exemplo, a origem indicada na URL real do Pages, sem caminho, barra final ou `*`). Várias origens são separadas por vírgula. A API recusa origens diferentes, responde a preflight somente para `GET`/`POST`, `Authorization` e `Content-Type`, e continua exigindo um Firebase ID token válido para alertas e consultas. CORS não substitui autenticação. Todos os projetos Pages da mesma conta compartilham a origem; não é possível restringir CORS por caminho.
4. Configure a variável pública do repositório **`PAGES_API_BASE_URL`** com a origem HTTPS real do backend e execute novamente o workflow. Sem credenciais na URL, caminho, query ou fragmento. Essa variável é pública e não deve conter segredos. Para build local, defina-a no ambiente do terminal; o build não carrega `.env` automaticamente.
5. O frontend buscará `/api/config` na origem externa e usará essa mesma base para alertas e consultas. A CSP gerada autoriza somente essa origem adicional. Falha ao carregar a configuração mantém a demonstração. Mesmo com configuração completa, cada sessão começa em demonstração; é necessário entrar e ativar envio real explicitamente.

## Login e mapa

Configure `FIREBASE_PUBLIC_CONFIG` no backend com a configuração pública do app Web, incluindo `apiKey`, `authDomain`, `projectId` e `appId`. Ative Google e Phone no Firebase Authentication e autorize o domínio exato do frontend. Use os números de teste do Firebase antes de SMS reais. O login por telefone exige reCAPTCHA e código SMS; digitar um número não autentica. A sessão usa `browserSessionPersistence`, e a API verifica o ID token com `accounts:lookup`.

`GOOGLE_MAPS_BROWSER_KEY` é uma chave pública de navegador. Restrinja-a por Maps JavaScript API e pelos referenciadores HTTP reais do frontend. O link universal Google Maps funciona sem chave. O navegador pede permissão para GPS; negar a permissão mantém o aplicativo utilizável. Apenas posições com menos de 60 segundos entram nas mensagens. O acompanhamento local dura até 15 minutos em primeiro plano.

## SMS e WhatsApp automáticos

Twilio é chamada exclusivamente no servidor. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` e, para WhatsApp, `TWILIO_WHATSAPP_FROM` e `TWILIO_WHATSAPP_CONTENT_SID`. O remetente WhatsApp usa prefixo `whatsapp:`. O template aprovado deve usar `{{1}}` para nome, `{{2}}` para ocorrência e `{{3}}` para mapa ou localização indisponível. Os destinatários devem aceitar receber mensagens. Confira capacidades, regiões, cotas, saldo e aprovação no provedor antes de ativar `LIVE_ALERTS_ENABLED=true`.

Pedidos são reservados atomicamente antes do envio. Repetir o mesmo UUID retorna o resultado existente, sem reenviar. Há limite de um pedido por 30 segundos e dez por 24 horas por UID. Não existe reenvio automático após resultado incerto. Consulte o status antes de criar outro pedido. Limites e idempotência não substituem controles antifraude e de orçamento dos provedores.

A interface distingue demonstração, solicitação, processamento, fila, enviado sem entrega confirmada, entregue, lido, falha e resultado incerto. Encerrar a visualização não recolhe mensagens. Não foram realizados login real, OTP ou entrega de mensagens na revisão automatizada.

## Dados e limites da PWA

Contatos e preferências ficam no `localStorage` deste navegador, separados pelo caminho do app e pelo UID/demonstração. Não há sincronização nem criptografia de aplicação. A posição fica em memória e pode ser apagada em Localização. O modo leitura não apaga histórico, mensagens ou notificações.

O banco guarda UUID, UID, horário e resultados por nome/canal/status/SID, sem corpo de mensagem, coordenadas ou telefone. Registros com mais de 24 horas são eliminados na próxima criação de alerta; não há tarefa periódica de limpeza. Provedores recebem os dados necessários ao envio e têm suas próprias políticas de retenção.

Instalação depende do navegador: Safari → Compartilhar → Adicionar à Tela de Início; Chrome Android → menu → Instalar aplicativo. A PWA não modifica a tela de bloqueio, não usa botões físicos e não garante GPS ou SOS em segundo plano. Login, mapas e envios automáticos precisam de internet e de serviços configurados. A interface pode funcionar offline após a primeira visita; SMS manual depende da operadora e confirmação, e WhatsApp precisa de conexão. Instalação em aparelho físico não foi validada nesta revisão.

## Testes e publicação segura

Os testes usam SQLite em memória, provedores simulados e contatos fictícios. Cobrem autenticação, origem/CORS, validação, consentimento, limites, idempotência, separação por usuário, falhas de provedor, contatos, teclado/pressão/cancelamento do SOS, GPS negado, modo offline, prefixo de projeto, manifesto e cache do service worker. Nenhuma mensagem real é enviada e nenhuma ligação é feita.

Arquivos `.env`, bancos, logs, caches, ferramentas locais de publicação e saídas geradas estão ignorados. A cópia inicial não continha histórico Git. Não foi atribuída uma licença ao projeto; a escolha cabe ao proprietário.

Fontes para configurar os serviços: [Firebase Google](https://firebase.google.com/docs/auth/web/google-signin), [Firebase telefone](https://firebase.google.com/docs/auth/web/phone-auth), [Maps JS](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Twilio mensagens](https://www.twilio.com/docs/messaging/api/message-resource).
