import { MigrationInterface, QueryRunner } from 'typeorm';

// Default operational values, read via ConfigurationsService.get(key)
// instead of hardcoding (Phase 6). Ops can tune these from the front end
// without a redeploy.
export class SeedConfigurations1786562884202 implements MigrationInterface {
  name = 'SeedConfigurations1786562884202';

  private readonly configs = [
    {
      id: '04c157fc-1616-4f7d-ba3b-830c730ef34e',
      key: 'accountLookupValidityMinutes',
      value: '10',
    },
    {
      id: 'fbc6dccb-6d2e-48da-a8a9-c6f0f7bb1dbe',
      key: 'accountLookupTimeoutMs',
      value: '15000',
    },
    {
      id: '4f0f2e9c-2b30-4504-be7b-52a40fd06bc0',
      key: 'transferPostingTimeoutMs',
      value: '20000',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const config of this.configs) {
      await queryRunner.query(`
        INSERT INTO "CONFIGURATIONS" ("id", "key", "value")
        VALUES ('${config.id}', '${config.key}', '${config.value}')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "CONFIGURATIONS" WHERE "id" IN (${this.configs.map((c) => `'${c.id}'`).join(', ')})
    `);
  }
}
