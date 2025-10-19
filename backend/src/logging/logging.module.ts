import { Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { SupabaseModule } from '../supabase/supabase.module'; // if it depends on SupabaseService

@Module({
    imports: [SupabaseModule],
    providers: [LoggingService],
    exports: [LoggingService],
})
export class LoggingModule { }
