import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LoggingService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async addSubmissionLog(type: string, text: string, analysis: string, classification: string, explanation: string) {
        const { data, error } = await this.supabaseService.supabase
            .from('submission-result-logs')
            .insert([{ type, text, analysis, classification, explanation }]);

        if (error) throw error;
        return data;
    }
}
