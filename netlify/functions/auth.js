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

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${proto}://${host}/api/callback`);
  authorizeUrl.searchParams.set("scope", "repo,user");
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
