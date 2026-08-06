/**
 * Passo 2 do OAuth do GitHub para o Decap CMS.
 *
 * O GitHub devolve um `code` a esta rota. Trocamo-lo por um token e
 * entregamo-lo a janela que abriu o popup, pelo protocolo postMessage
 * que o Decap espera:
 *
 *   1. popup  -> opener : "authorizing:github"
 *   2. opener -> popup  : qualquer mensagem (handshake)
 *   3. popup  -> opener : "authorization:github:success:{json}"
 */

/** Serializa a resposta para o opener e fecha o popup. */
function renderBridge(status, payload, origin) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Limpa o state: ja foi usado.
      "Set-Cookie": "dlx_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    },
    body: `<!doctype html><html><body><p>Completing sign-in…</p><script>
(function () {
  var message = ${JSON.stringify(message)};
  var origin = ${JSON.stringify(origin)};
  function send() { window.opener.postMessage(message, origin); }
  if (!window.opener) { document.body.textContent = "No opener window — close this tab and retry."; return; }
  window.addEventListener("message", send, { once: true });
  window.opener.postMessage("authorizing:github", origin);
})();
</script></body></html>`
  };
}

exports.handler = async (event) => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { statusCode: 500, body: "GitHub OAuth environment variables are not configured." };
  }

  const proto = event.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${event.headers.host}`;
  const { code, state } = event.queryStringParameters || {};

  if (!code) {
    return renderBridge("error", { message: "Missing authorization code." }, origin);
  }

  const cookieState = /dlx_oauth_state=([a-f0-9]+)/.exec(event.headers.cookie || "")?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return renderBridge("error", { message: "State mismatch — sign-in was not started here." }, origin);
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });

    const data = await response.json();
    if (!response.ok || data.error || !data.access_token) {
      return renderBridge("error", { message: data.error_description || "Token exchange failed." }, origin);
    }

    return renderBridge("success", { token: data.access_token, provider: "github" }, origin);
  } catch (error) {
    return renderBridge("error", { message: `Token exchange failed: ${error.message}` }, origin);
  }
};
