import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private client: SupabaseClient;

    constructor() {
        const url = process.env.SUPABASE_URL as string;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY as string;
        this.client = createClient(url, key);
    }

    get supabase() {
        return this.client;
    }

}
