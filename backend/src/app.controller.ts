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
import { AppService } from './app.service';
import { SubLogService } from './submission-log.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly subLogService: SubLogService) { }

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
    const result = await this.appService.moderateSubmission(file, body);

    const type = (body?.type as string | undefined)?.toLowerCase();
    await this.subLogService.addLog(
      type as string,
      body?.text ? body?.text : null,
      result.analysis,
      result.classification,
      result.explanation ? result.explanation : null,
    );

    return result;
  }
}
