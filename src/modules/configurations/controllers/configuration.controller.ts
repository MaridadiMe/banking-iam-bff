import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigurationsService } from '../services/configurations.service';
import { ConfigDto } from '../dtos/config.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateConfigDto } from '../dtos/update-config.dto';
import { Scopes } from 'src/modules/auth/decorators/scopes.decorator';

// The reference repo (loans-decision-engine) left these unguarded — fine
// for an internal-only loans engine, but EDX_IMT is partner-facing, so
// this is locked to an internal/ops scope.
@ApiTags('Configurations')
@ApiBearerAuth()
@Controller('configurations')
export class ConfigurationController {
  constructor(private readonly configService: ConfigurationsService) {}

  @Post()
  @Scopes('imt:config:admin')
  async createConfiguration(@Body() config: ConfigDto) {
    return await this.configService.addConfig(config);
  }

  @Patch(':id')
  @Scopes('imt:config:admin')
  async updateConfiguration(
    @Param('id') id: string,
    @Body() config: UpdateConfigDto,
  ) {
    return await this.configService.updateConfig(id, config);
  }

  @Get()
  @HttpCode(200)
  @Scopes('imt:config:admin')
  async getConfig() {
    return await this.configService.getConfigs();
  }

  @Delete(':id')
  @HttpCode(204)
  @Scopes('imt:config:admin')
  async deleteConfig(@Param('id') id: string) {
    return await this.configService.deleteConfig(id);
  }
}
