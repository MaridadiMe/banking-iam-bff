import { Module } from '@nestjs/common';
import { ConfigurationsService } from './services/configurations.service';
import { ConfigurationRepository } from './repositories/configuration.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuration } from './entities/configuration.entity';
import { ConfigurationController } from './controllers/configuration.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Configuration])],
  providers: [ConfigurationsService, ConfigurationRepository],
  controllers: [ConfigurationController],
  exports: [ConfigurationRepository, ConfigurationsService],
})
export class ConfigurationsModule {}
