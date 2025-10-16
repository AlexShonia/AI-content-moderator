import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class SubLogService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async addLog(type: string, text: string, analysis: string, classification: string, explanation: string) {
        const { data, error } = await this.supabaseService.supabase
            .from('submission-result-logs')
            .insert([{ type, text, analysis, classification, explanation }]);

        if (error) throw error;
        return data;
    }
}
