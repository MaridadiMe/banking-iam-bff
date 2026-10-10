import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Configuration } from '../entities/configuration.entity';
import { Repository } from 'typeorm';
import { ConfigDto } from '../dtos/config.dto';
import { UpdateConfigDto } from '../dtos/update-config.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ConfigurationRepository {
  private readonly logger = new Logger(ConfigurationRepository.name);
  constructor(
    @InjectRepository(Configuration)
    private readonly configRepository: Repository<Configuration>,
  ) {}

  private configCache: Pick<Configuration, 'key' | 'value'>[] = [];

  async getConfigurationFromLocalCache(
    key: string,
  ): Promise<Pick<Configuration, 'key' | 'value'> | undefined> {
    if (!this.configExistsInLocalCache(key)) {
      this.logger.debug(
        `Configuration: ${key} Does Not Exist in Local Cache. Refreshing`,
      );
      await this.refreshLocalCache();
    }
    return this.configCache.find((config) => config.key === key);
  }

  addConfigurationOnLocalCache(config: { key: string; value: string }) {
    if (this.getConfigIndexInLocalCache(config.key) > -1) {
      const index = this.getConfigIndexInLocalCache(config.key);
      this.configCache[index].value = config.value;
    } else {
      this.configCache.push(config);
    }
  }

  private configExistsInLocalCache(key: string): boolean {
    return this.getConfigIndexInLocalCache(key) > -1;
  }

  private getConfigIndexInLocalCache(key: string) {
    const existingIndex = this.configCache.findIndex(
      (conf) => conf.key === key,
    );
    return existingIndex;
  }

  // 10-minute refresh: low-frequency operational tweaks, unlike FSP's
  // 1-minute kill-switch cache (Phase 2). Kept as a separate cache
  // mechanism deliberately — they serve different freshness needs.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshLocalCache() {
    this.logger.debug(`Refreshing Configurations`);
    try {
      const configs = await this.configRepository.find({
        select: { key: true, value: true },
      });
      if (configs.length > 0) {
        this.configCache = configs;
      }
    } catch (error) {
      this.logger.error(`Error Refreshing Configurations: ${error}`);
    }
  }

  async saveConfiguration(conf: ConfigDto) {
    let existingConfig: Configuration | null;

    try {
      existingConfig = await this.configRepository.findOneBy({ key: conf.key });

      if (!existingConfig) {
        const conf_ = this.configRepository.create(conf);
        const savedConfig = await this.configRepository.save(conf_);
        this.addConfigurationOnLocalCache({
          key: savedConfig.key,
          value: savedConfig.value,
        });
        return savedConfig;
      }

      const updatedConfig = await this.configRepository.save({
        ...existingConfig,
        value: conf.value,
      });
      this.addConfigurationOnLocalCache({
        key: updatedConfig.key,
        value: updatedConfig.value,
      });
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Error While Saving Config: ${error}`);
      throw new InternalServerErrorException(`Error While Saving Config`);
    }
  }

  async getConfigs() {
    return await this.configRepository.find();
  }

  async exists(id: string) {
    return await this.configRepository.exists({ where: { id } });
  }

  async deleteConfigById(id: string) {
    return await this.configRepository.delete({ id });
  }

  async updateConfig(id: string, conf: UpdateConfigDto) {
    try {
      const config = await this.configRepository.findOneBy({ id });
      return await this.configRepository.save({ ...config, ...conf });
    } catch (error) {
      this.logger.error(`Error While Updating Config: ${error}`);
      throw new InternalServerErrorException(`Error While Updating Config`);
    }
  }
}
