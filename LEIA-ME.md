# Santuário — duelo de mestres

Jogo online para 2 pessoas com login, convite por link e partidas em tempo real.
Regras do jogo base + expansão Sensei's Path (32 cartas), validadas no servidor.

- **Front-end:** `web/` (Vite + React). O build pronto fica em `web/dist/`.
- **Back-end:** Supabase, projeto `santuario-jogo` (já criado e configurado).
  Os arquivos em `supabase/` são só registro do que foi aplicado no banco.

## Publicar na Vercel (uma vez)

No terminal (Windows: PowerShell), dentro da pasta `web`:

```
npx vercel --prod
```

Na primeira vez ele pede login na Vercel (abre o navegador) e faz algumas perguntas:
aceite os padrões (framework Vite, build `npm run build`, saída `dist`).
No fim ele mostra o endereço, tipo `https://santuario-xxxx.vercel.app`.

## Depois de publicar: 1 ajuste no Supabase (obrigatório)

Supabase → projeto **santuario-jogo** → Authentication → URL Configuration:

1. **Site URL:** cole o endereço da Vercel.
2. **Redirect URLs:** adicione `https://SEU-ENDERECO.vercel.app/**`

Sem isso, o link de confirmação de e-mail manda as pessoas para `localhost`.

Opcional: em Authentication → Sign In / Providers → Email, desligar **Confirm email**
deixa o cadastro instantâneo (sem precisar clicar no e-mail). O e-mail padrão do
Supabase tem limite baixo de envios por hora; para muitos jogadores, configure um SMTP.

## Trocar o nome do jogo
`web/src/pages/Lobby.tsx` → `GAME_TITLE`, e o `<title>` em `web/index.html`.
