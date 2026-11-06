import {
  afterRenderEffect,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { ButtonModule } from "primeng/button";
import { AdminApiService } from "../api.service";
import { CareService, Thread } from "./care.service";
import { Conversation } from "./conversation";

@Component({
  selector: "app-private-video-message",
  imports: [RouterLink, ButtonModule, Conversation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/messages"
      class="mb-6 inline-flex items-center gap-2 text-sm font-medium text-sage"
      ><i class="pi pi-arrow-left" aria-hidden="true"></i
      >{{ care.t("Back to messages", "Retour aux messages") }}</a
    >
    @if (thread(); as current) {
      <header class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-widest text-sage">
          {{ current.clientName }}
        </p>
        <h1 class="mt-2 break-words text-3xl font-medium">
          {{ current.title }}
        </h1>
        <p class="mt-3 text-sm text-muted">
          {{
            care.t(
              "Private video conversation with this client.",
              "Conversation privée avec ce client au sujet de cette vidéo."
            )
          }}
        </p>
      </header>
      <div class="max-w-5xl space-y-6">
        <section [attr.aria-label]="care.t('Video', 'Vidéo')">
          @if (videoUrl(); as url) {
            <video
              [src]="url"
              class="aspect-video w-full rounded-2xl bg-black"
              [attr.aria-label]="current.title"
              controls
              playsinline
              preload="metadata"
              (error)="videoError.set(true)"
            ></video>
          } @else if (videoLoading()) {
            <p
              role="status"
              class="flex aspect-video items-center justify-center rounded-2xl bg-canvas text-sm text-muted"
            >
              {{ care.t("Loading video…", "Chargement de la vidéo…") }}
            </p>
          }
          @if (videoError()) {
            <div
              role="status"
              class="rounded-xl border border-line bg-canvas p-5 text-sm text-muted"
            >
              <p>
                {{
                  care.t(
                    "The video could not be loaded. You can still read and reply to the conversation below.",
                    "La vidéo n’a pas pu être chargée. Vous pouvez toujours lire la conversation et y répondre ci-dessous."
                  )
                }}
              </p>
              <button
                pButton
                text
                type="button"
                class="mt-2"
                (click)="retryVideo()"
              >
                {{ care.t("Retry video", "Réessayer la vidéo") }}
              </button>
            </div>
          }
        </section>
        <section
          id="comments"
          #commentSection
          class="surface scroll-mt-6 p-5 sm:p-7"
          aria-labelledby="private-comments-title"
        >
          <h2 id="private-comments-title" class="text-xl font-medium">
            {{
              care.t(
                "Comments from " + current.clientName,
                "Commentaires de " + current.clientName
              )
            }}
          </h2>
          <app-care-conversation [threadId]="current.id" />
        </section>
      </div>
    } @else if (loading()) {
      <p role="status" class="surface p-8 text-sm text-muted">
        {{ care.t("Loading conversation…", "Chargement de la conversation…") }}
      </p>
    } @else {
      <section role="alert" class="surface space-y-4 p-8">
        <h1 class="text-2xl font-medium">
          {{ care.t("Conversation unavailable", "Conversation indisponible") }}
        </h1>
        <p class="text-sm text-muted">{{ error() }}</p>
        <button pButton type="button" (click)="reload()">
          {{ care.t("Try again", "Réessayer") }}
        </button>
      </section>
    }
  `,
})
export class PrivateVideoMessage {
  readonly threadId = input.required<string>();
  readonly care = inject(CareService);
  private readonly api = inject(AdminApiService);
  readonly thread = signal<Thread | null>(null);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly videoUrl = signal("");
  readonly videoLoading = signal(false);
  readonly videoError = signal(false);
  private readonly commentSection =
    viewChild<ElementRef<HTMLElement>>("commentSection");
  private generation = 0;
  private controller?: AbortController;

  constructor() {
    afterRenderEffect(() => {
      const section = this.commentSection();
      if (section && window.location.hash === "#comments")
        section.nativeElement.scrollIntoView({ block: "start" });
    });
    effect((onCleanup) => {
      this.threadId();
      const user = this.care.auth.user();
      onCleanup(() => {
        this.generation++;
        this.controller?.abort();
      });
      if (user) untracked(() => void this.reload());
    });
  }

  async reload(): Promise<void> {
    const generation = ++this.generation;
    const id = this.threadId();
    this.controller?.abort();
    this.thread.set(null);
    this.videoUrl.set("");
    this.videoError.set(false);
    this.loading.set(true);
    this.error.set("");
    try {
      const thread = await this.care.request<Thread>(
        "/threads/" + encodeURIComponent(id),
      );
      if (generation !== this.generation) return;
      this.thread.set(thread);
      void this.loadVideo(thread, generation);
    } catch (error) {
      if (generation === this.generation)
        this.error.set(this.care.error(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  retryVideo(): void {
    const thread = this.thread();
    if (thread) void this.loadVideo(thread, this.generation);
  }

  private async loadVideo(thread: Thread, generation: number): Promise<void> {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    this.videoUrl.set("");
    this.videoLoading.set(true);
    this.videoError.set(false);
    try {
      const link = await this.api.getVideoPlaybackLink(
        thread.videoId,
        AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      );
      if (generation === this.generation && !controller.signal.aborted)
        this.videoUrl.set(link.url);
    } catch {
      if (generation === this.generation && !controller.signal.aborted)
        this.videoError.set(true);
    } finally {
      if (generation === this.generation && !controller.signal.aborted)
        this.videoLoading.set(false);
    }
  }
}
