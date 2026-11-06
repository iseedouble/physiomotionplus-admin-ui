import { Injectable, effect, inject, signal } from "@angular/core";
import { AdminAuthService as AuthService } from "../auth.service";
import {
  adminAuth as firebaseAuth,
  adminFirebaseApp as firebaseApp,
} from "../firebase";
import { Store } from "../store";
import { environment } from "../../environments/environment";

export interface Physio {
  id: string;
  name: string;
  clinic: string;
  discoverable: boolean;
}
export interface Connection {
  id: string;
  clientId: string;
  physioId: string;
  clientName: string;
  physioName: string;
  status: "pending" | "active" | "declined" | "ended";
  updatedAt: number;
}
export interface Thread {
  id: string;
  connectionId: string;
  title: string;
  clientName: string;
  physioName: string;
  updatedAt: number;
}
export interface CareMessage {
  id: string;
  body: string;
  senderRole: string;
  senderId: string;
  sequence: number;
  createdAt: number;
}
export class CareError extends Error {
  constructor(
    readonly status: number,
    readonly reason = "",
  ) {
    super(`Care request failed (${status})`);
  }
}

@Injectable({ providedIn: "root" })
export class CareService {
  readonly auth = inject(AuthService);
  private readonly i18n = inject(Store);
  readonly isPhysio = true;
  readonly connections = signal<Connection[]>([]);
  readonly threads = signal<Thread[]>([]);
  private readonly base = environment.apiBaseUrl + "/api/care";
  constructor() {
    // Retire registrations left by the previous notification implementation.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          for (const registration of registrations) {
            const worker =
              registration.active ??
              registration.waiting ??
              registration.installing;
            if (
              worker &&
              new URL(worker.scriptURL).pathname === "/firebase-messaging-sw.js"
            ) {
              const subscription =
                await registration.pushManager.getSubscription();
              await subscription?.unsubscribe();
              await registration.unregister();
            }
          }
        })
        .catch(() => {});
    }
    let owner: string | undefined;
    effect(() => {
      const uid = this.auth.user()?.uid ?? "";
      if (uid !== owner) {
        owner = uid;
        this.connections.set([]);
        this.threads.set([]);
      }
    });
  }
  t(en: string, fr: string): string {
    return this.i18n.fr() ? fr : en;
  }
  error(error: unknown): string {
    if (error instanceof CareError) {
      if (error.status === 401)
        return this.t(
          "Your session has expired. Sign in again.",
          "Votre session a expiré. Reconnectez-vous.",
        );
      if (
        error.status === 403 &&
        error.reason === "This account is not an authorized physio."
      )
        return this.t(
          "Your physio account is not authorized. Contact your administrator.",
          "Votre compte physio n’est pas autorisé. Contactez votre administrateur.",
        );
      if (
        error.status === 403 &&
        error.reason === "Verify your email before using private care."
      )
        return this.t(
          "Verify your email, then refresh your account to continue.",
          "Vérifiez votre courriel, puis actualisez votre compte.",
        );
      if (error.status === 403 && /membership/.test(error.reason))
        return this.t(
          "Your current membership does not include private comments.",
          "Votre abonnement actuel ne comprend pas les commentaires privés.",
        );
      if (error.status === 403 && /[Cc]onnect/.test(error.reason))
        return this.t(
          "Connect with a physio and wait for approval before starting this conversation.",
          "Connectez-vous à un physio et attendez son approbation pour commencer cette conversation.",
        );
      if (error.status === 403)
        return this.t(
          "Access unavailable. Verify your email, active connection and membership.",
          "Accès indisponible. Vérifiez votre courriel, votre connexion et votre abonnement.",
        );
      if (error.status === 409)
        return this.t(
          "This request has changed or you already have an active or pending connection. Reload and try again.",
          "Cette demande a changé ou une connexion est déjà active ou en attente. Rechargez et réessayez.",
        );
      if (error.status === 429)
        return this.t(
          "Please wait a moment before trying again.",
          "Veuillez patienter avant de réessayer.",
        );
      if (error.status === 400)
        return this.t(
          "Check the entered details. Invitation links must match your verified email and expire after seven days.",
          "Vérifiez les renseignements. Les invitations doivent correspondre à votre courriel vérifié et expirent après sept jours.",
        );
    }
    return this.t(
      "Could not complete the request. Please try again.",
      "Impossible de terminer la demande. Veuillez réessayer.",
    );
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new CareError(401);
    const token = await user.getIdToken();
    const response = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (firebaseAuth.currentUser?.uid !== user.uid) throw new CareError(401);
    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new CareError(response.status, details?.message ?? "");
    }
    return response.json() as Promise<T>;
  }
}
