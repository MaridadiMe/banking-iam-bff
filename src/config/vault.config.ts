import { Logger } from '@nestjs/common';
import axios from 'axios';

export async function fetchSecretsFromVault() {
  const VAULT_ADDR = process.env.VAULT_ADDR;
  const ROLE_ID = process.env.VAULT_ROLE_ID;
  const SECRET_ID = process.env.VAULT_SECRET_ID;
  const SECRET_PATH = process.env.VAULT_SECRET_PATH || 'edx-imt';

  try {
    Logger.debug('Attempting to fetch from the vault', 'Vault Config');

    // 1. Authenticate to Vault via AppRole
    const loginRes = await axios.post<{ auth: { client_token: string } }>(
      `${VAULT_ADDR}/v1/auth/approle/login`,
      {
        role_id: ROLE_ID,
        secret_id: SECRET_ID,
      },
    );

    const clientToken = loginRes.data.auth.client_token;

    // 2. Fetch secrets from Vault KV store
    const secretRes = await axios.get<{
      data: { data: Record<string, unknown> };
    }>(`${VAULT_ADDR}/v1/secret/data/${SECRET_PATH}`, {
      headers: {
        'X-Vault-Token': clientToken,
      },
    });

    const secrets = secretRes.data.data.data;

    // 3. Inject into process.env
    for (const [key, value] of Object.entries(secrets)) {
      process.env[key] = String(value);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Logger.error(
      `[Vault] Failed to fetch secrets:: ${message}`,
      'Vault Config',
    );
    Logger.warn(`[Vault] Error: ${message}`);
  }
}
