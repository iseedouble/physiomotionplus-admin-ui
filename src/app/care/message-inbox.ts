import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { CareService, Thread } from "./care.service";

interface InboxPage {
  items: Thread[];
  nextCursor: string;
}

@Component({
  selector: "app-message-inbox",
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, InputTextModule],
  templateUrl: "./message-inbox.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageInbox {
  readonly care = inject(CareService);
  readonly items = signal<Thread[]>([]);
  readonly selectedId = signal("");
  readonly selected = computed(() =>
    this.items().find((t) => t.id === this.selectedId()),
  );
  readonly search = signal("");
  readonly loading = signal(false);
  readonly error = signal("");
  readonly cursor = signal("");
  readonly refreshed = signal(false);
  readonly visible = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.items().filter((t) =>
      [t.clientName, t.title, t.lastMessagePreview ?? ""]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  });
  private generation = 0;

  constructor() {
    effect((onCleanup) => {
      const user = this.care.auth.user();
      const generation = ++this.generation;
      this.items.set([]);
      this.selectedId.set("");
      this.cursor.set("");
      this.loading.set(false);
      this.refreshed.set(false);
      this.error.set("");
      onCleanup(() => {
        this.generation++;
      });
      if (user) untracked(() => void this.load(false, generation));
    });
  }

  async load(more = false, generation = this.generation): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set("");
    const after = more ? this.cursor() : "";
    try {
      const page = await this.care.request<InboxPage>(
        "/inbox" + (after ? "?after=" + encodeURIComponent(after) : ""),
      );
      if (generation !== this.generation) return;
      this.items.update((old) =>
        more
          ? [...new Map([...old, ...page.items].map((t) => [t.id, t])).values()]
          : page.items,
      );
      this.cursor.set(page.nextCursor);
      this.refreshed.set(true);
    } catch (error) {
      if (generation === this.generation)
        this.error.set(this.care.error(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  }
}
