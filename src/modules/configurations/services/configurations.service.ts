import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigurationRepository } from '../repositories/configuration.repository';
import { ConfigDto } from '../dtos/config.dto';
import { UpdateConfigDto } from '../dtos/update-config.dto';

@Injectable()
export class ConfigurationsService {
  private readonly logger = new Logger(ConfigurationsService.name);

  constructor(private readonly configRepository: ConfigurationRepository) {}

  async addConfig(conf: ConfigDto) {
    try {
      const config = await this.configRepository.saveConfiguration(conf);
      return {
        status: 'OK',
        data: config,
      };
    } catch (error) {
      this.logger.error(`Error While Saving Config: ${error}`);
      throw new InternalServerErrorException(`Error While Saving Config`);
    }
  }

  async getConfigs() {
    try {
      const configs = await this.configRepository.getConfigs();
      return {
        status: 'OK',
        data: configs,
      };
    } catch (error) {
      this.logger.error(`Error While Fetching Configs: ${error}`);
      throw new InternalServerErrorException(`Error While Fetching Configs`);
    }
  }

  async updateConfig(id: string, conf: UpdateConfigDto) {
    return await this.configRepository.updateConfig(id, conf);
  }

  async deleteConfig(id: string) {
    try {
      await this.configRepository.deleteConfigById(id);
    } catch {
      throw new InternalServerErrorException(`Error While Deleting Config`);
    }
  }

  async get(key: string) {
    /**
     * Used by the application internally
     */
    return await this.configRepository.getConfigurationFromLocalCache(key);
  }
}
