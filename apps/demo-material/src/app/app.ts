import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { environment } from '../environments/environment';
import { isSupabaseConfigured } from '@pidrang/demo-shared';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected hasSupabaseConfig = isSupabaseConfigured(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
}
