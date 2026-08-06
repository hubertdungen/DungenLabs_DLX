/**
 * Passo 1 do OAuth do GitHub para o Decap CMS.
 *
 * O Decap abre esta rota numa janela popup. Nos redirecionamos para o
 * GitHub com um `state` aleatorio, que guardamos num cookie HttpOnly
 * para o callback poder confirmar que a resposta pertence a este pedido.
 */
const crypto = require("crypto");

exports.handler = async (event) => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return { statusCode: 500, body: "GITHUB_OAUTH_CLIENT_ID is not configured." };
  }

  const proto = event.headers["x-forwarded-proto"] || "https";
  const host = event.headers.host;
  const state = crypto.randomBytes(16).toString("hex");

  // `public_repo` chega para um repositorio publico e nao da ao token
  // qualquer acesso aos repositorios privados da conta. So subir para
  // `repo` (via GITHUB_OAUTH_SCOPE) se o repositorio for privado —
  // e nesse caso o token passa a alcancar TODOS os privados, que e
  // exactamente o que se quer evitar.
  const scope = process.env.GITHUB_OAUTH_SCOPE || "public_repo";

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${proto}://${host}/api/callback`);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return {
    statusCode: 302,
    headers: {
      Location: authorizeUrl.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `dlx_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    },
    body: ""
  };
};
