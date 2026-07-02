// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * Thin openid-client v6 wrapper.
 *
 * Discovery results are cached per `issuer+clientId` so we don't repeat the
 * OIDC discovery round-trip on every request.
 */
import * as oidcClient from 'openid-client';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OidcClaims {
  email: string;
  emailVerified: boolean | undefined;
  name: string | undefined;
}

export interface OidcVerifier {
  authUrl(p: { state: string; nonce: string; codeVerifier: string }): Promise<string>;
  verify(p: { callbackUrl: string; state: string; nonce: string; codeVerifier: string }): Promise<OidcClaims>;
}

// Cache discovered OIDC configurations to avoid repeated network round-trips.
const configCache = new Map<string, oidcClient.Configuration>();

async function getConfig(cfg: OidcConfig): Promise<oidcClient.Configuration> {
  const cacheKey = `${cfg.issuer}::${cfg.clientId}`;
  const cached = configCache.get(cacheKey);
  if (cached) return cached;

  const config = await oidcClient.discovery(
    new URL(cfg.issuer),
    cfg.clientId,
    cfg.clientSecret,
  );
  configCache.set(cacheKey, config);
  return config;
}

export function createOidcVerifier(cfg: OidcConfig): OidcVerifier {
  return {
    async authUrl({ state, nonce, codeVerifier }) {
      const config = await getConfig(cfg);

      // PKCE S256 challenge derived from the verifier
      const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);

      const url = oidcClient.buildAuthorizationUrl(config, {
        response_type: 'code',
        scope: 'openid email profile',
        redirect_uri: cfg.redirectUri,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      return url.href;
    },

    async verify({ callbackUrl, state, nonce, codeVerifier }) {
      const config = await getConfig(cfg);

      // authorizationCodeGrant validates:
      //   - ID token signature via JWKS
      //   - iss (issuer)
      //   - aud (audience = clientId)
      //   - exp (expiry)
      //   - nonce (via expectedNonce)
      //   - state (via expectedState)
      //   - PKCE code_verifier exchange
      const tokens = await oidcClient.authorizationCodeGrant(
        config,
        new URL(callbackUrl),
        {
          pkceCodeVerifier: codeVerifier,
          expectedState: state,
          expectedNonce: nonce,
        },
      );

      const claims = tokens.claims();
      if (!claims) throw new Error('SSO: no ID token claims returned');

      const email = claims.email as string | undefined;
      if (!email) throw new Error('SSO: ID token missing email claim');

      return {
        email,
        emailVerified: claims.email_verified as boolean | undefined,
        name: claims.name as string | undefined,
      };
    },
  };
}
