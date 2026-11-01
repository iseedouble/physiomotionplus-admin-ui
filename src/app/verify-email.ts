import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { ButtonModule } from 'primeng/button';
import { AdminAuthService } from './auth.service';
import { Store } from './store';

@Component({
  selector: 'app-verify-email',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 sm:px-10" aria-label="Email verification">
      <p class="min-w-0 flex-1">
        {{ s.t('Verify your email to use private care. We will send a link to', 'Vérifiez votre adresse courriel pour utiliser les soins privés. Nous enverrons un lien à') }}
        <strong>{{ auth.user()?.email }}</strong>.
      </p>
      <button pButton type="button" size="small" [loading]="sending()" [disabled]="sending() || checking()" (click)="send()">
        {{ s.t('Send verification email', 'Envoyer le courriel de vérification') }}
      </button>
      <button pButton type="button" size="small" severity="secondary" outlined [loading]="checking()" [disabled]="sending() || checking()" (click)="check()">
        {{ s.t('I verified my email', 'J’ai vérifié mon courriel') }}
      </button>
      @if (message()) { <p class="w-full" role="status">{{ message() }}</p> }
      @if (error()) { <p class="w-full text-red-700" role="alert">{{ error() }}</p> }
    </section>
  `,
})
export class VerifyEmail {
  readonly auth = inject(AdminAuthService);
  readonly s = inject(Store);
  readonly sending = signal(false);
  readonly checking = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  async send() {
    this.sending.set(true);
    this.message.set('');
    this.error.set('');
    try {
      await this.auth.sendVerification();
      this.message.set(this.s.t('Verification email sent. Open its link, then return here.', 'Courriel de vérification envoyé. Ouvrez le lien, puis revenez ici.'));
    } catch (failure) {
      this.error.set(failure instanceof FirebaseError && failure.code === 'auth/too-many-requests'
        ? this.s.t('Please wait before requesting another email.', 'Veuillez patienter avant de demander un autre courriel.')
        : this.s.t('Could not send the verification email. Please try again.', 'Impossible d’envoyer le courriel de vérification. Veuillez réessayer.'));
    } finally {
      this.sending.set(false);
    }
  }

  async check() {
    this.checking.set(true);
    this.message.set('');
    this.error.set('');
    try {
      if (await this.auth.refreshVerification()) {
        window.location.reload();
      } else {
        this.message.set(this.s.t('Your email is not verified yet. Open the link in the email first.', 'Votre courriel n’est pas encore vérifié. Ouvrez d’abord le lien reçu.'));
      }
    } catch {
      this.error.set(this.s.t('Could not check verification. Please try again.', 'Impossible de vérifier le statut. Veuillez réessayer.'));
    } finally {
      this.checking.set(false);
    }
  }
}
