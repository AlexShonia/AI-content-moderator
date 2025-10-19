import {
    Body,
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgentService } from "./agent.service";
import { LoggingService } from 'src/logging/logging.service';


@Controller()
export class AgentController {
    constructor(private readonly agentService: AgentService, private readonly loggingService: LoggingService) { }

    @Post('submit')
    @UseInterceptors(FileInterceptor('file'))
    async submit(
        @UploadedFile() file: any | undefined,
        @Body() body: any,
    ) {
        const result = await this.agentService.moderateSubmission(file, body);

        const type = (body?.type as string | undefined)?.toLowerCase();
        await this.loggingService.addSubmissionLog(
            type as string,
            body?.text ? body?.text : null,
            result.analysis,
            result.classification,
            result.explanation ? result.explanation : null,
        );

        return result;
    }
}
