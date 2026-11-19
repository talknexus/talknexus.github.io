import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  const bytes = new Uint8Array(hash);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function respond(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export default {
  fetch: withSupabase(
    { auth: ["user", "publishable"] },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return respond({ error: "Method not allowed." }, 405);
      }

      const body = await req.json().catch(() => null);

      if (!body || typeof body.action !== "string") {
        return respond({ error: "Invalid request." }, 400);
      }

      // LOGIN: authenticate using either username or email.
      if (body.action === "login") {
        if (
          typeof body.identifier !== "string" ||
          typeof body.password !== "string" ||
          body.identifier.trim().length === 0 ||
          body.identifier.trim().length > 320 ||
          body.password.length === 0 ||
          body.password.length > 1024
        ) {
          return respond(
            { error: "Incorrect username/email or password." },
            401,
          );
        }

        const identifier = body.identifier.trim();
        let email = "";
        if (identifier.includes("@")) {
          // Email login. The email is used internally for authentication.
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
            return respond(
              { error: "Incorrect username/email or password." },
              401,
            );
          }

          email = identifier;
        } else {
          // Username login. Only alphanumeric usernames are accepted.
          if (!/^[a-zA-Z0-9]{3,24}$/.test(identifier)) {
            return respond(
              { error: "Incorrect username/email or password." },
              401,
            );
          }

          const { data: profile, error: profileError } =
            await ctx.supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("username", identifier.toLowerCase())
              .maybeSingle();

          if (profileError || !profile) {
            console.error("Username lookup failed:", {
              code: profileError?.code ?? null,
              message: profileError?.message ?? "Profile not found",
            });

            return respond(
              { error: "Incorrect username/email or password." },
              401,
            );
          }

          const { data: userData, error: userError } =
            await ctx.supabaseAdmin.auth.admin.getUserById(profile.id);

          if (userError || !userData.user?.email) {
            console.error("Auth user lookup failed:", {
              code: userError?.code ?? null,
              message: userError?.message ?? "Auth user or email not found",
            });

            return respond(
              { error: "Incorrect username/email or password." },
              401,
            );
          }

          email = userData.user.email;
        }

        // Authenticate through Supabase Auth using the resolved email.
        const { data: authData, error: authError } =
          await ctx.supabase.auth.signInWithPassword({
            email,
            password: body.password,
          });

        if (authError || !authData.session) {
          console.error("Password authentication failed:", {
            code: authError?.code ?? null,
            message: authError?.message ?? "No session returned",
          });

          return respond(
            { error: "Incorrect username/email or password." },
            401,
          );
        }

        // Return only session credentials, never the account email.
        return respond({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          expires_at: authData.session.expires_at,
          token_type: authData.session.token_type,
        });
      }

      // CREATE: browser requests a temporary handoff code.
      if (body.action === "create") {
        if (ctx.authMode !== "user" || !ctx.userClaims?.id) {
          return respond({ error: "You must be signed in." }, 401);
        }

        if (
          typeof body.code_challenge !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(body.code_challenge)
        ) {
          return respond({ error: "Invalid code challenge." }, 400);
        }

        const code = generateCode();
        const codeHash = await hashCode(code);
        const expiresAt = new Date(Date.now() + 120_000).toISOString();

        const { data: created, error } = await ctx.supabaseAdmin.rpc(
          "create_desktop_auth_code",
          {
            p_code_hash: codeHash,
            p_code_challenge: body.code_challenge,
            p_user_id: ctx.userClaims.id,
            p_expires_at: expiresAt,
          },
        );

        if (error) {
          console.error("Could not create desktop auth code:", {
            code: error.code,
            message: error.message,
          });

          return respond({ error: "Could not start desktop login." }, 500);
        }

        if (!created) {
          return respond(
            {
              error:
                "Cooldown active. Please wait 10 seconds before trying again.",
            },
            429,
          );
        }

        return respond({
          code,
          expires_at: expiresAt,
        });
      }

      // REDEEM: desktop proves possession of the original verifier.
      if (body.action === "redeem") {
        if (
          typeof body.code !== "string" ||
          !/^[a-f0-9]{64}$/.test(body.code) ||
          typeof body.verifier !== "string" ||
          !/^[A-Za-z0-9._~-]{43,128}$/.test(body.verifier)
        ) {
          return respond({ error: "Invalid or expired code." }, 400);
        }

        const codeHash = await hashCode(body.code);
        const challenge = await createChallenge(body.verifier);
        const now = new Date().toISOString();

        const { data: redeemed, error: redeemError } =
          await ctx.supabaseAdmin
            .from("desktop_auth_codes")
            .update({ consumed_at: now })
            .eq("code_hash", codeHash)
            .eq("code_challenge", challenge)
            .is("consumed_at", null)
            .gt("expires_at", now)
            .select("user_id")
            .maybeSingle();

        if (redeemError || !redeemed) {
          return respond({ error: "Invalid or expired code." }, 400);
        }

        const { data: userData, error: userError } =
          await ctx.supabaseAdmin.auth.admin.getUserById(
            redeemed.user_id,
          );

        const email = userData.user?.email;

        if (userError || !email) {
          console.error("Could not retrieve desktop auth user.");
          return respond(
            { error: "Could not complete desktop login." },
            500,
          );
        }

        const { data: linkData, error: linkError } =
          await ctx.supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
          });

        const tokenHash = linkData.properties?.hashed_token;

        if (linkError || !tokenHash) {
          console.error("Could not generate desktop auth token.");
          return respond(
            { error: "Could not complete desktop login." },
            500,
          );
        }

        return respond({
          token_hash: tokenHash,
          type: "magiclink",
        });
      }

      return respond({ error: "Unknown action." }, 400);
    },
  ),
};