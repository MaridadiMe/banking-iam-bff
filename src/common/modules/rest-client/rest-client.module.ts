import { Module } from '@nestjs/common';
import { RestclientService } from './restclient.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [RestclientService],
  exports: [RestclientService],
})
export class RestClientModule {}
