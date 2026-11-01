import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { CareService, CareError, CareMessage } from './care.service';

@Component({
  selector: 'app-care-conversation',
  imports: [FormsModule, ButtonModule, TextareaModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mt-5 space-y-4 border-t border-line pt-5"
      aria-label="Private conversation / Conversation privée"
    >
      <div class="flex flex-wrap justify-between gap-2">
        <h2 class="font-semibold">
          {{ care.t('Private video conversation', 'Conversation privée sur la vidéo') }}
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted" role="status">{{ status() }}</span>
          <button pButton text type="button" (click)="refreshMessages()">
            {{ care.t('Refresh', 'Actualiser') }}
          </button>
        </div>
      </div>
      <p class="text-sm text-muted">
        {{
          care.t(
            'Visible only to you and your connected physio or client.',
            'Visible uniquement par vous et votre physiothérapeute ou client connecté.'
          )
        }}
      </p>
      @if (hasOlder()) {
        <button pButton text type="button" [disabled]="loadingOlder()" (click)="older()">
          {{ care.t('Load earlier messages', 'Charger les messages précédents') }}
        </button>
      }
      <div
        class="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-canvas p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        @for (message of ordered(); track message.id) {
          <article
            class="max-w-[90%] rounded-xl border border-line bg-white p-3"
            [class.ml-auto]="message.senderRole === (care.isPhysio ? 'physio' : 'client')"
          >
            <p class="mb-1 text-xs font-medium">
              {{
                message.senderRole === 'physio'
                  ? care.t('Physio', 'Physiothérapeute')
                  : care.t('Client', 'Client')
              }}
              · <time>{{ message.createdAt | date: 'short' }}</time>
            </p>
            <p class="whitespace-pre-wrap break-words text-sm">{{ message.body }}</p>
          </article>
        } @empty {
          <p class="text-sm text-muted">
            {{
              care.t(
                'No messages yet. Ask a question about this video.',
                'Aucun message. Posez une question sur cette vidéo.'
              )
            }}
          </p>
        }
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-red-700">{{ error() }}</p>
      }
      <form class="space-y-3" (ngSubmit)="send()">
        <label class="block text-sm font-medium" [for]="'message-' + threadId()">{{
          care.t('Message', 'Message')
        }}</label>
        <textarea
          pTextarea
          class="w-full"
          rows="3"
          maxlength="4000"
          [id]="'message-' + threadId()"
          name="message"
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
          [disabled]="sending() || closed()"
        ></textarea>
        <div class="flex justify-between gap-3">
          <span class="text-xs text-muted">{{ draft().length }} / 4000</span
          ><button
            pButton
            type="submit"
            [loading]="sending()"
            [disabled]="!draft().trim() || sending() || closed()"
          >
            {{ care.t('Send', 'Envoyer') }}
          </button>
        </div>
      </form>
    </section>
  `,
})
export class Conversation {
  readonly care = inject(CareService);
  readonly threadId = input.required<string>();
  readonly messages = signal<CareMessage[]>([]);
  readonly ordered = computed(() => [...this.messages()].sort((a, b) => a.sequence - b.sequence));
  readonly draft = signal('');
  readonly error = signal('');
  readonly status = signal('');
  readonly sending = signal(false);
  readonly closed = signal(false);
  readonly hasOlder = signal(false);
  readonly loadingOlder = signal(false);
  private pending: { id: string; body: string } | null = null;
  private generation = 0;
  private refreshSerial = 0;
  private lastUpdateVersion = this.care.updateVersion();
  constructor() {
    effect((onCleanup) => {
      const id = this.threadId();
      this.care.auth.user();
      const generation = ++this.generation;
      this.messages.set([]);
      this.draft.set('');
      this.pending = null;
      this.error.set('');
      this.closed.set(false);
      this.hasOlder.set(false);
      this.sending.set(false);
      this.loadingOlder.set(false);
      untracked(() => void this.refreshMessages(generation, id));
      onCleanup(() => {
        this.generation++;
      });
    });
    effect(() => {
      const version = this.care.updateVersion();
      if (version === this.lastUpdateVersion) return;
      this.lastUpdateVersion = version;
      untracked(() => void this.refreshMessages());
    });
  }
  async refreshMessages(generation = this.generation, id = this.threadId()): Promise<void> {
    const serial = ++this.refreshSerial;
    this.status.set(this.care.t('Updating…', 'Mise à jour…'));
    try {
      const list = await this.care.request<CareMessage[]>(
        `/threads/${encodeURIComponent(id)}/messages`,
      );
      if (generation !== this.generation || serial !== this.refreshSerial) return;
      this.merge(list);
      if (list.length === 50) this.hasOlder.set(true);
      this.closed.set(false);
      this.status.set(this.care.t('Up to date', 'À jour'));
      this.error.set('');
    } catch (failure) {
      if (generation !== this.generation || serial !== this.refreshSerial) return;
      if (failure instanceof CareError && [403, 404].includes(failure.status)) {
        this.closed.set(true);
        this.messages.set([]);
      }
      this.status.set(this.care.t('Could not refresh', 'Actualisation impossible'));
      this.error.set(this.care.error(failure));
    }
  }
  private merge(list: CareMessage[]) {
    this.messages.update((old) => [...new Map([...old, ...list].map((m) => [m.id, m])).values()]);
  }
  async older() {
    if (this.loadingOlder()) return;
    const generation = this.generation;
    this.loadingOlder.set(true);
    try {
      const before = this.ordered()[0]?.sequence ?? 0;
      const list = await this.care.request<CareMessage[]>(
        `/threads/${this.threadId()}/messages?before=${before}`,
      );
      if (generation === this.generation) {
        this.merge(list);
        this.hasOlder.set(list.length === 50);
      }
    } catch (e) {
      if (generation === this.generation) this.error.set(this.care.error(e));
    } finally {
      if (generation === this.generation) this.loadingOlder.set(false);
    }
  }
  async send() {
    if (this.sending() || !this.draft().trim() || this.closed()) return;
    const generation = this.generation;
    const body = this.draft().trim();
    if (this.pending?.body !== body) this.pending = { id: crypto.randomUUID(), body };
    this.sending.set(true);
    this.error.set('');
    try {
      const message = await this.care.request<CareMessage>(
        `/threads/${this.threadId()}/messages`,
        'POST',
        this.pending,
      );
      if (generation === this.generation) {
        this.merge([message]);
        this.draft.set('');
        this.pending = null;
        this.care.announceUpdate(true);
      }
    } catch (e) {
      if (generation === this.generation) this.error.set(this.care.error(e));
    } finally {
      if (generation === this.generation) this.sending.set(false);
    }
  }
}
