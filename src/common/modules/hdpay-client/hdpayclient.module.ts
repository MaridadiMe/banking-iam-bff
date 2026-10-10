import { Module } from '@nestjs/common';
import { RestClientModule } from '../rest-client/rest-client.module';
import { HdpayClientService } from './hdpayclient.service';

@Module({
  imports: [RestClientModule],
  providers: [HdpayClientService],
  exports: [HdpayClientService],
})
export class HdpayClientModule {}
