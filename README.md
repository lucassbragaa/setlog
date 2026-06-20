# Setlog

Set log avançado, offline-first, para musculação. A primeira fatia funcional já permite ajustar carga, repetições e RIR, classificar o set, registrá-lo e iniciar o cronômetro de descanso automaticamente.

## Executar

```bash
npm install
npm start
```

No iPhone, instale o Expo Go e leia o QR code exibido pelo Expo. O computador e o telefone precisam estar na mesma rede. Para abrir a versão de navegador, use `npm run web`.

## Gerar a PWA

```bash
npm run build:web
```

O site pronto para publicação será criado em `dist`. Ele inclui manifesto instalável, armazenamento local e cache offline.

### Publicar gratuitamente no Cloudflare Pages

1. Envie este repositório para o GitHub.
2. No Cloudflare Pages, conecte o repositório.
3. Use `npm run build:web` como comando de build.
4. Use `dist` como diretório de saída.
5. Abra o endereço publicado no Safari e escolha **Compartilhar → Adicionar à Tela de Início**.

## Estratégia para iPhone

- Desenvolvimento e uso inicial gratuitos: Expo Go.
- Alternativa instalável sem App Store: PWA adicionada à Tela de Início.
- Aplicativo independente distribuído pela App Store: exige as condições vigentes do Apple Developer Program.
- Apple Watch: fase posterior, isolada do núcleo do produto; requer toolchain nativo da Apple e não faz parte do fluxo gratuito via Expo Go.

## Primeira arquitetura

- Expo SDK 56 + React Native + TypeScript estrito.
- Dados de domínio separados da interface em `src/types`.
- Interface mobile escura e otimizada para uso durante o treino.
- Sem HealthKit.
- Próxima etapa: persistência local, múltiplos exercícios e histórico real.
