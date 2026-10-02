import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Store } from './store';
import { AdminAuthService } from './auth.service';
import { Login } from './login';
@Component({selector:'app-root',imports:[RouterLink,RouterLinkActive,RouterOutlet,ButtonModule,Login],changeDetection:ChangeDetectionStrategy.OnPush,template:`
@if(!auth.ready()){<main class="flex min-h-screen items-center justify-center bg-canvas"><i class="pi pi-spin pi-spinner text-3xl text-sage"></i></main>}@else if(!auth.user()){<app-admin-login/>}@else{
<div class="min-h-screen">
 <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-white p-6 lg:flex">
  <a routerLink="/modules" class="flex items-center gap-2 text-lg font-bold"><span class="flex size-9 items-center justify-center rounded-xl bg-forest text-lime"><i class="pi pi-wave-pulse"></i></span>physiomotion<span class="-ml-2 text-sage">+</span></a>
  <span class="ml-11 mt-1 text-[9px] tracking-[3px] text-muted">PHYSIO STUDIO</span>
  <p class="eyebrow mt-14 mb-4">{{s.t('YOUR PRACTICE','VOTRE PRATIQUE')}}</p>
  <nav class="space-y-2">
   @for (item of nav;track item.path) {
    <a [routerLink]="item.path" routerLinkActive="bg-[#eaf0e3] text-forest" ariaCurrentWhenActive="page" class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted hover:bg-canvas"><i [class]="'pi '+item.icon"></i>{{s.t(item.en,item.fr)}}</a>
   }
  </nav>
  <div class="mt-auto rounded-2xl bg-[#f1f4e9] p-4"><i class="pi pi-heart text-sage"></i><p class="mt-3 text-sm font-medium">{{s.t('Care, one step at a time.','Accompagner, un pas à la fois.')}}</p><p class="mt-2 text-xs leading-5 text-muted">{{s.t('A little structure. More room for your clients.','Un peu de structure. Plus de place pour vos clients.')}}</p></div>
  <div class="mt-6 flex gap-3 border-t border-line pt-5"><span class="flex size-10 items-center justify-center rounded-full bg-[#efe7de] text-sm">{{initials()}}</span><div><p class="text-sm font-semibold">{{displayName()}}</p><p class="text-xs text-muted">{{s.t('Signed-in administrator','Administration')}}</p></div></div>
 </aside>
 <div class="lg:ml-60">
  <header class="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-5 sm:px-10">
   <span class="text-sm text-muted">{{s.t('A calmer space to manage your care.','Un espace serein pour organiser vos soins.')}}</span>
   <div class="flex items-center gap-4"><span class="rounded-full border border-line px-3 py-1 text-[10px] tracking-wider">POC</span><div role="group" aria-label="Language / Langue" class="flex rounded-full border border-line p-1"><button pButton text rounded type="button" [attr.aria-pressed]="!s.fr()" [class.bg-forest]="!s.fr()" [class.text-white]="!s.fr()" (click)="s.fr.set(false)">EN</button><button pButton text rounded type="button" [attr.aria-pressed]="s.fr()" [class.bg-forest]="s.fr()" [class.text-white]="s.fr()" (click)="s.fr.set(true)">FR</button></div></div>
  </header>
  <nav class="flex gap-2 overflow-x-auto border-b border-line bg-white px-5 py-3 lg:hidden">@for(item of nav;track item.path){<a [routerLink]="item.path" routerLinkActive="bg-[#eaf0e3]" class="whitespace-nowrap rounded-lg px-4 py-2 text-sm">{{s.t(item.en,item.fr)}}</a>}</nav>
  <main class="mx-auto max-w-[1500px] px-5 py-8 sm:px-10"><router-outlet/></main>
  <footer class="mx-5 border-t border-line py-6 text-xs text-muted sm:mx-10">{{s.t('Video files are stored privately.','Les vidéos sont stockées de façon privée.')}}</footer>
 </div>
</div>}`})
export class App {
 readonly s=inject(Store);
 readonly auth=inject(AdminAuthService);
 readonly displayName=computed(()=>this.auth.user()?.displayName || this.auth.user()?.email || this.s.t('Administrator','Administrateur'));
 readonly initials=computed(()=>this.displayName().split(/[\s@]+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase());
 readonly nav=[{path:'/modules',en:'Rehab modules',fr:'Modules de réadaptation',icon:'pi-th-large'},{path:'/videos',en:'Video library',fr:'Vidéothèque',icon:'pi-video'},{path:'/clients',en:'Clients',fr:'Clients',icon:'pi-users'},{path:'/messages',en:'Private messages',fr:'Messages privés',icon:'pi-comments'}];
}
