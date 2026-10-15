# AR Vídeos (MindAR + Supabase, 100% gratuito)

- `index.html` – **usuário (cliente)**: login/senha → câmera → vídeo toca sobre a imagem reconhecida.
- `admin.html` – **administrador**: cria clientes (gera login e senha), e cadastra imagens + vídeos de cada um.
- `supabase/functions/manage-clients` – Edge Function (criar/redefinir/excluir cliente; só o admin chama).
- `supabase-setup.sql` – bucket privado, tabela `clients` e policies (RLS).
- `config.js` – URL e chave anon do Supabase.

## Setup
1. Crie um projeto gratuito em supabase.com.
2. Rode `supabase-setup.sql` no SQL Editor.
3. Authentication > Providers > Email: desligue "Allow new users to sign up" e "Confirm email".
4. Authentication > Users: crie o usuário administrador e rode o `update auth.users ...` comentado no fim do SQL.
5. Publique a função: `supabase functions deploy manage-clients` (CLI) — ou peça para o Claude publicar.
6. Preencha `config.js` (Settings > API).
7. Hospede esta pasta no GitHub Pages ou Cloudflare Pages (HTTPS obrigatório para a câmera).

## Fluxo
1. Admin entra em `admin.html` → "Novo cliente" → recebe link, login e senha para repassar.
2. Admin abre o cliente → cadastra imagens e vídeos (o `.mind` é compilado no navegador).
3. Cliente entra em `index.html` com o login/senha, toca "Abrir câmera" e aponta para as imagens.

## Isolamento
Storage privado: cada cliente só lê a pasta `{client_id}/` (policy RLS pelo `client_id` do JWT). Só o admin escreve. Vídeos são entregues por URLs assinadas temporárias.

## Limites do plano gratuito
- Supabase: 1 GB de storage (somado entre todos os clientes), 50 MB por arquivo, ~5 GB/mês de tráfego, 50 mil usuários ativos/mês. Comprima os vídeos (MP4 H.264, ~720p).
- Projetos gratuitos pausam após 1 semana sem uso.
- Imagens-alvo boas: muito detalhe e contraste, sem áreas lisas ou padrões repetitivos.
