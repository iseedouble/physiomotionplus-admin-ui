import { Injectable, effect, inject, signal } from '@angular/core';
import { AdminAuthService as AuthService } from '../auth.service';
import { adminAuth as firebaseAuth, adminFirebaseApp as firebaseApp } from '../firebase';
import { Store } from '../store';
import { environment } from '../../environments/environment';

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
  status: 'pending' | 'active' | 'declined' | 'ended';
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
  constructor(readonly status: number, readonly reason = '') {
    super(`Care request failed (${status})`);
  }
}

@Injectable({ providedIn: 'root' })
export class CareService {
  readonly auth = inject(AuthService);
  private readonly i18n = inject(Store);
  readonly isPhysio = true;
  readonly connections = signal<Connection[]>([]);
  readonly threads = signal<Thread[]>([]);
  readonly notificationState = signal<'off' | 'on' | 'unavailable'>('off');
  readonly notificationNotice = signal('');
  readonly newUpdate = signal(false);
  readonly updateVersion = signal(0);
  private readonly base = environment.apiBaseUrl + '/api/care';
  private pushToken = '';
  private owner = '';
  private epoch = 0;
  private pushWork: Promise<unknown> = Promise.resolve();
  private foregroundStop?: () => void;
  constructor() {
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible' && this.owner) this.announceUpdate();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('online', () => {
      if (this.owner) this.announceUpdate(true);
    });
    effect(() => {
      const uid = this.auth.user()?.uid ?? '';
      if (uid !== this.owner) {
        const previousOwner = this.owner;
        const hadToken = !!this.pushToken;
        this.owner = uid;
        this.epoch++;
        this.connections.set([]);
        this.threads.set([]);
        this.notificationState.set('off');
        this.notificationNotice.set('');
        this.newUpdate.set(false);
        this.foregroundStop?.();
        this.foregroundStop = undefined;
        const epoch = this.epoch;
        this.pushWork = this.pushWork
          .catch(() => {})
          .then(async () => {
            let registeredOwner = '';
            try {
              registeredOwner = localStorage.getItem('care-push-owner') ?? '';
            } catch {
              /* Storage is optional. */
            }
            if (
              'Notification' in window &&
              Notification.permission === 'granted' &&
              (registeredOwner !== uid || (hadToken && previousOwner !== uid))
            ) {
              await this.clearBrowserToken();
            }
            if (epoch !== this.epoch || !uid) return;
            try {
              if (
                localStorage.getItem('care-push:' + uid) === 'on' &&
                Notification.permission === 'granted'
              )
                await this.registerNotifications(epoch, false);
            } catch {
              /* Optional notifications must not block sign-in. */
            }
          });
      }
    });
  }
  private lastUpdateAt = 0;
  announceUpdate(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastUpdateAt < 1000) return;
    this.lastUpdateAt = now;
    this.updateVersion.update((version) => version + 1);
  }
  t(en: string, fr: string): string {
    return this.i18n.fr() ? fr : en;
  }
  error(error: unknown): string {
    if (error instanceof CareError) {
      if (error.status === 403 && error.reason === 'This account is not an authorized physio.')
        return this.t(
          'This account is not on the admin API allowlist. Add its Firebase UID to CARE_PHYSIO_UIDS and restart the admin API.',
          'Ce compte ne figure pas dans la liste autorisée de l’API admin. Ajoutez son UID Firebase à CARE_PHYSIO_UIDS et redémarrez l’API admin.',
        );
      if (error.status === 403 && error.reason === 'Verify your email before using private care.')
        return this.t(
          'Verify your email before using private care.',
          'Vérifiez votre adresse courriel avant d’utiliser les soins privés.',
        );
      if (error.status === 403)
        return this.t(
          'Access unavailable. Verify your email, active connection and membership.',
          'Accès indisponible. Vérifiez votre courriel, votre connexion et votre abonnement.',
        );
      if (error.status === 409)
        return this.t(
          'This request has changed or you already have an active or pending connection. Reload and try again.',
          'Cette demande a changé ou une connexion est déjà active ou en attente. Rechargez et réessayez.',
        );
      if (error.status === 429)
        return this.t(
          'Please wait a moment or close another open conversation.',
          'Veuillez patienter ou fermer une autre conversation ouverte.',
        );
      if (error.status === 400)
        return this.t(
          'Check the entered details. Invitation links must match your verified email and expire after seven days.',
          'Vérifiez les renseignements. Les invitations doivent correspondre à votre courriel vérifié et expirent après sept jours.',
        );
    }
    return this.t(
      'Could not complete the request. Please try again.',
      'Impossible de terminer la demande. Veuillez réessayer.',
    );
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new CareError(401);
    const token = await user.getIdToken();
    const response = await fetch(this.base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (firebaseAuth.currentUser?.uid !== user.uid) throw new CareError(401);
    if (!response.ok) {
      const details = await response.json().catch(() => null) as { message?: string } | null;
      throw new CareError(response.status, details?.message ?? '');
    }
    return response.json() as Promise<T>;
  }
  async enableNotifications(): Promise<void> {
    const epoch = this.epoch;
    // Request from the user's click, before asynchronous SDK loading loses the browser gesture.
    if (!('Notification' in window)) {
      this.notificationState.set('unavailable');
      return;
    }
    const permission = Notification.requestPermission();
    this.pushWork = this.pushWork
      .catch(() => {})
      .then(async () => {
        await permission;
        await this.registerNotifications(epoch, false);
      });
    await this.pushWork;
  }
  private async registerNotifications(currentEpoch: number, ask: boolean): Promise<void> {
    if (currentEpoch !== this.epoch) return;
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) {
      this.notificationState.set('unavailable');
      this.notificationNotice.set(
        this.t(
          'Notifications are not supported in this browser.',
          'Ce navigateur ne prend pas en charge les notifications.',
        ),
      );
      return;
    }
    const response = await fetch('/care-config.json', { cache: 'no-store' });
    const config = (await response.json()) as { vapidKey?: string };
    if (!config.vapidKey) {
      this.notificationNotice.set(
        this.t(
          'Notifications have not been configured yet.',
          'Les notifications ne sont pas encore configurées.',
        ),
      );
      return;
    }
    if ((ask ? await Notification.requestPermission() : Notification.permission) !== 'granted') {
      this.notificationNotice.set(
        this.t(
          'Notifications are blocked. You can change this in your browser settings.',
          'Les notifications sont bloquées. Vous pouvez modifier ce choix dans votre navigateur.',
        ),
      );
      return;
    }
    const worker = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebaseApp), {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: worker,
    });
    if (currentEpoch !== this.epoch) {
      await this.clearBrowserToken();
      return;
    }
    await this.request('/device', 'PUT', { token });
    if (currentEpoch !== this.epoch) return;
    this.pushToken = token;
    this.notificationState.set('on');
    this.notificationNotice.set('');
    try {
      localStorage.setItem('care-push:' + this.owner, 'on');
      localStorage.setItem('care-push-owner', this.owner);
    } catch {
      /* Storage may be disabled. */
    }
    const { onMessage } = await import('firebase/messaging');
    this.foregroundStop?.();
    this.foregroundStop = onMessage(getMessaging(firebaseApp), () => {
      if (currentEpoch !== this.epoch) return;
      this.newUpdate.set(true);
      this.announceUpdate(true);
    });
  }
  async disableNotifications(): Promise<void> {
    try {
      localStorage.removeItem('care-push:' + this.owner);
    } catch {
      /* Storage may be disabled. */
    }
    this.foregroundStop?.();
    this.foregroundStop = undefined;
    if (this.pushToken) await this.request('/device', 'DELETE', { token: this.pushToken });
    await this.clearBrowserToken();
    this.notificationState.set('off');
  }
  private async clearBrowserToken(): Promise<void> {
    this.pushToken = '';
    try {
      localStorage.removeItem('care-push-owner');
    } catch {
      /* Storage is optional. */
    }
    try {
      const { isSupported, getMessaging, deleteToken } = await import('firebase/messaging');
      if (await isSupported()) await deleteToken(getMessaging(firebaseApp));
    } catch {
      /* No registered token on this device. */
    }
  }
}
