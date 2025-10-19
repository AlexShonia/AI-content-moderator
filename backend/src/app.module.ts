import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { LoggingModule } from './logging/logging.module';
import { AgentModule } from './agent/agent.module';


@Module({
  imports: [ConfigModule.forRoot(), SupabaseModule, LoggingModule, AgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
