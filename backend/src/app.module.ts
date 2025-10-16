import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import { SubLogService } from './submission-log.service';


@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, SubLogService, SupabaseService],
})
export class AppModule { }
