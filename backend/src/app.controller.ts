import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { AppService } from './app.service';
import { moderateContent } from './agent';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('submit')
  @UseInterceptors(FileInterceptor('file'))
  async submit(
    @UploadedFile() file: any | undefined,
    @Body() body: any,
  ) {
    return await this.appService.moderateSubmission(file, body);
  }
}
