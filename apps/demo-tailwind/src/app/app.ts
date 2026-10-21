import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AppLayout } from './layout/app-layout';
import { environment } from '../environments/environment';
import { isSupabaseConfigured } from '@pidrang/demo-shared';

@Component({
  imports: [RouterModule, AppLayout],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly appName = 'Pidrang Tailwind';
  protected hasSupabaseConfig = isSupabaseConfigured(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
}
