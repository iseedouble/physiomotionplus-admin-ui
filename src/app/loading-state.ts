import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
 selector: 'app-loading-state',
 imports: [ProgressSpinner],
 changeDetection: ChangeDetectionStrategy.OnPush,
 host: { class: 'block' },
 template: `
  <div role="status" class="flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted">
   <p-progressspinner aria-hidden="true" class="size-10 motion-reduce:hidden" strokeWidth="4"/>
   <span>{{label()}}</span>
  </div>
 `,
})
export class LoadingState {
 readonly label=input.required<string>();
}
