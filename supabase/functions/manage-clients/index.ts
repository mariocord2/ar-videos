// Edge Function: só o admin (app_metadata.role = "admin") pode chamar.
// Ações: create | reset | delete
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BUCKET = "ar";
const EMAIL_DOMAIN = "ar.app"; // login "joao" -> e-mail interno "joao@ar.app"

function genPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user } } = await sb.auth.getUser(token);
  if (user?.app_metadata?.role !== "admin") return json({ error: "Acesso negado" }, 403);

  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    const name = String(body.name ?? "").trim();
    const login = String(body.login ?? "").trim().toLowerCase();
    if (!name) return json({ error: "Informe o nome" }, 400);
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) return json({ error: "Login: 3-32 caracteres (a-z, 0-9, . _ -)" }, 400);
    const password = String(body.password ?? "") || genPassword();
    if (password.length < 6) return json({ error: "Senha com no mínimo 6 caracteres" }, 400);

    const id = crypto.randomUUID();
    const { data, error } = await sb.auth.admin.createUser({
      email: `${login}@${EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
      app_metadata: { role: "client", client_id: id },
    });
    if (error) return json({ error: error.message }, 400);

    const { error: e2 } = await sb.from("clients").insert({ id, name, login, user_id: data.user.id });
    if (e2) {
      await sb.auth.admin.deleteUser(data.user.id);
      return json({ error: e2.message }, 400);
    }
    return json({ id, name, login, password });
  }

  const { data: client } = await sb.from("clients").select("*").eq("id", body.id).maybeSingle();
  if (!client) return json({ error: "Cliente não encontrado" }, 404);

  if (body.action === "reset") {
    const password = String(body.password ?? "") || genPassword();
    if (password.length < 6) return json({ error: "Senha com no mínimo 6 caracteres" }, 400);
    const { error } = await sb.auth.admin.updateUserById(client.user_id, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ login: client.login, password });
  }

  if (body.action === "delete") {
    for (const dir of [client.id, `${client.id}/images`, `${client.id}/videos`]) {
      const { data: files } = await sb.storage.from(BUCKET).list(dir, { limit: 1000 });
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${dir}/${f.name}`);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    }
    await sb.auth.admin.deleteUser(client.user_id);
    await sb.from("clients").delete().eq("id", client.id);
    return json({ ok: true });
  }

  return json({ error: "Ação inválida" }, 400);
});
