import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { LoggingModule } from 'src/logging/logging.module';

@Module({
    imports: [LoggingModule],
    providers: [AgentService],
    controllers: [AgentController],
})
export class AgentModule { }
