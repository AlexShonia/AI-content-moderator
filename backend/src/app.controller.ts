import {
  Controller,
  Get,
} from '@nestjs/common';
import { AppService } from './app.service';
import { LoggingService } from './logging/logging.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly LoggingService: LoggingService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

}
