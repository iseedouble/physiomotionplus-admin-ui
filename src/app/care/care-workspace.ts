import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { DialogModule } from "primeng/dialog";
import { CareService, Connection, Physio, Thread } from "./care.service";
import { Conversation } from "./conversation";

@Component({
  selector: "app-care-workspace",
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    Conversation,
    RouterLink,
  ],
  templateUrl: "./care-workspace.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CareWorkspace {
  readonly care = inject(CareService);
  private readonly conversation = viewChild(Conversation);
  readonly directory = signal<Physio[]>([]);
  readonly profileName = signal("");
  readonly clinic = signal("");
  readonly discoverable = signal(false);
  readonly email = signal("");
  readonly inviteUrl = signal("");
  readonly invitation = signal("");
  readonly notice = signal("");
  readonly error = signal("");
  readonly busy = signal(false);
  readonly status = signal("");
  readonly selected = signal<Thread | null>(null);
  readonly clientToDelete = signal<Connection | null>(null);
  readonly deleteError = signal("");
  readonly clients = computed(() =>
    this.care
      .connections()
      .filter((c) => c.status === "pending" || c.status === "active"),
  );
  readonly directoryMore = signal(false);
  readonly moreConnections = signal(false);
  readonly moreThreads = signal(false);
  private generation = 0;
  private refreshSerial = 0;
  readonly active = computed(() =>
    this.care
      .connections()
      .find((c) => c.status === "active" || c.status === "pending"),
  );
  readonly visibleThreads = computed(() =>
    this.care
      .threads()
      .filter((t) =>
        this.care
          .connections()
          .some((c) => c.id === t.connectionId && c.status === "active"),
      ),
  );
  constructor() {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    this.invitation.set(fragment.get("invite") ?? "");
    if (fragment.has("invite"))
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    effect((onCleanup) => {
      const user = this.care.auth.user();
      const generation = ++this.generation;
      this.selected.set(null);
      this.clientToDelete.set(null);
      this.error.set("");
      this.directory.set([]);
      this.inviteUrl.set("");
      this.moreConnections.set(false);
      this.moreThreads.set(false);
      if (!user) return;
      onCleanup(() => {
        this.generation++;
      });
      untracked(() => void this.refreshSummary(generation));
      untracked(
        () =>
          void this.run(async () => {
            if (this.care.isPhysio) {
              const profile =
                await this.care.request<Partial<Physio>>("/profile");
              this.profileName.set(profile.name ?? user.displayName ?? "");
              this.clinic.set(profile.clinic ?? "");
              this.discoverable.set(profile.discoverable ?? false);
            } else await this.loadDirectory(false);
          }),
      );
    });
    effect(() => {
      const current = this.selected();
      if (current && !this.visibleThreads().some((t) => t.id === current.id))
        this.selected.set(null);
    });
  }
  async refresh(): Promise<void> {
    await Promise.all([
      this.refreshSummary(),
      this.conversation()?.refreshMessages(),
    ]);
  }
  async refreshSummary(generation = this.generation): Promise<void> {
    const serial = ++this.refreshSerial;
    this.status.set(this.care.t("Updating…", "Mise à jour…"));
    try {
      const [connections, threads] = await Promise.all([
        this.care.request<Connection[]>("/connections"),
        this.care.request<Thread[]>("/threads"),
      ]);
      if (generation !== this.generation || serial !== this.refreshSerial)
        return;
      this.care.connections.set(connections);
      this.care.threads.set(threads);
      this.moreConnections.set(connections.length === 100);
      this.moreThreads.set(threads.length === 100);
      this.status.set(this.care.t("Up to date", "À jour"));
      this.error.set("");
    } catch (failure) {
      if (generation !== this.generation || serial !== this.refreshSerial)
        return;
      this.status.set(
        this.care.t("Could not refresh", "Actualisation impossible"),
      );
      this.error.set(this.care.error(failure));
    }
  }
  async run(action: () => Promise<unknown>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      await action();
    } catch (e) {
      this.error.set(this.care.error(e));
    } finally {
      this.busy.set(false);
    }
  }
  async loadDirectory(more: boolean) {
    const after = more ? this.directory().at(-1)?.id : "";
    const list = await this.care.request<Physio[]>(
      "/directory" + (after ? "?after=" + encodeURIComponent(after) : ""),
    );
    this.directory.update((old) => (more ? [...old, ...list] : list));
    this.directoryMore.set(list.length === 50);
  }
  more() {
    void this.run(() => this.loadDirectory(true));
  }
  private merge<T extends { id: string; updatedAt: number }>(
    old: T[],
    list: T[],
  ): T[] {
    return [...new Map([...old, ...list].map((x) => [x.id, x])).values()].sort(
      (a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id),
    );
  }
  olderConnections() {
    void this.run(async () => {
      const list = await this.care.request<Connection[]>(
        "/connections?after=" + this.care.connections().at(-1)!.id,
      );
      this.care.connections.update((old) => this.merge(old, list));
      this.moreConnections.set(list.length === 100);
    });
  }
  olderThreads() {
    void this.run(async () => {
      const list = await this.care.request<Thread[]>(
        "/threads?after=" + this.care.threads().at(-1)!.id,
      );
      this.care.threads.update((old) => this.merge(old, list));
      this.moreThreads.set(list.length === 100);
    });
  }
  request(physioId: string) {
    void this.run(async () => {
      await this.care.request("/connections", "POST", {
        physioId,
        invitation: this.invitation() || undefined,
      });
      await this.refreshSummary();
      this.invitation.set("");
      this.notice.set(
        this.care.t(
          "Request sent. Your physio will review it.",
          "Demande envoyée. Votre physiothérapeute l’examinera.",
        ),
      );
    });
  }
  decide(id: string, status: string) {
    void this.run(async () => {
      await this.care.request("/connections/" + id, "PATCH", { status });
      await this.refreshSummary();
    });
  }
  async deleteClient(): Promise<void> {
    const client = this.clientToDelete();
    if (!client || this.busy()) return;
    this.busy.set(true);
    this.deleteError.set("");
    try {
      await this.care.request("/connections/" + client.id, "PATCH", {
        status: "ended",
      });
      this.clientToDelete.set(null);
      await this.refreshSummary();
      this.notice.set(this.care.t("Client removed.", "Client supprimé."));
    } catch (failure) {
      this.deleteError.set(this.care.error(failure));
    } finally {
      this.busy.set(false);
    }
  }
  saveProfile() {
    void this.run(async () => {
      await this.care.request("/profile", "PUT", {
        name: this.profileName(),
        clinic: this.clinic(),
        discoverable: this.discoverable(),
      });
      this.notice.set(this.care.t("Profile saved.", "Profil enregistré."));
    });
  }
  invite() {
    void this.run(async () => {
      const result = await this.care.request<{
        url: string;
        emailSent?: boolean;
      }>("/invitations", "POST", { email: this.email() });
      this.inviteUrl.set(result.url);
      this.notice.set(
        result.emailSent
          ? this.care.t(
              "Invitation email sent.",
              "Invitation envoyée par courriel.",
            )
          : this.care.t(
              "Invitation created. Copy this link and share it with the client using their email address.",
              "Invitation créée. Copiez ce lien et transmettez-le au client à son adresse courriel.",
            ),
      );
    });
  }
  copyInvite() {
    void this.run(async () => {
      await navigator.clipboard.writeText(this.inviteUrl());
      this.notice.set(
        this.care.t("Invitation link copied.", "Lien d’invitation copié."),
      );
    });
  }
  label(status: string) {
    return (
      (
        {
          pending: this.care.t("Pending", "En attente"),
          active: this.care.t("Connected", "Connecté"),
          ended: this.care.t("Ended", "Terminée"),
          declined: this.care.t("Declined", "Refusée"),
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
