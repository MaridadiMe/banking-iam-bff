import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ⚠️ FLAG BEFORE RUNNING: the FSP codes supplied were `013` (EXIM), `014`
 * (CRDB), `015` (VODACOM), `015` (YAS) — `015` was given twice. `016` is
 * assumed here for YAS since it's very likely a typo, but CONFIRM the real
 * YAS code before this migration ships against a real environment —
 * `fspCode` is a unique constraint, so getting it wrong means a later
 * correction migration. See task doc "Open Questions" #3.
 */
export class SeedFsps1786562883202 implements MigrationInterface {
  name = 'SeedFsps1786562883202';

  private readonly fsps = [
    {
      id: '3a774fef-6279-4a3d-8a46-91d0c71f7c6b',
      fspCode: '013',
      fspName: 'EXIM',
      fspType: 'INTERNAL',
      routingChannel: 'CBS_DIRECT',
    },
    {
      id: '8c7d97f9-5a01-4f8d-b971-0444b1e96114',
      fspCode: '014',
      fspName: 'CRDB',
      fspType: 'BANK',
      routingChannel: 'TIPS',
    },
    {
      id: '52e0a38a-3b71-4e35-b58c-d8d512f24d9f',
      fspCode: '015',
      fspName: 'VODACOM',
      fspType: 'WALLET',
      routingChannel: 'TIPS',
    },
    {
      id: '9bb27169-5317-471a-8244-49a9b7003f5c',
      fspCode: '016', // assumed — see class-level warning above
      fspName: 'YAS',
      fspType: 'WALLET',
      routingChannel: 'TIPS',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const fsp of this.fsps) {
      await queryRunner.query(`
        INSERT INTO "FSPS" ("id", "fspCode", "fspName", "fspType", "isActive", "supportsAccountLookup", "routingChannel")
        VALUES ('${fsp.id}', '${fsp.fspCode}', '${fsp.fspName}', '${fsp.fspType}', 1, 1, '${fsp.routingChannel}')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "FSPS" WHERE "id" IN (${this.fsps.map((f) => `'${f.id}'`).join(', ')})
    `);
  }
}
