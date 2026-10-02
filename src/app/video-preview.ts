import { ChangeDetectionStrategy, Component, effect, inject, model, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AdminApiService } from './api.service';
import { Store } from './store';
import { LoadingState } from './loading-state';

export interface VideoPreviewSelection { exerciseId: string; name: string; description: string; }

@Component({
 selector: 'app-video-preview',
 imports: [ButtonModule, DialogModule, LoadingState],
 changeDetection: ChangeDetectionStrategy.OnPush,
 template: `
  <p-dialog [header]="selected()?.name ?? s.t('Video preview','Aperçu vidéo')"
   [visible]="!!selected()" (visibleChange)="!$event && selected.set(null)"
   [closeAriaLabel]="s.t('Close preview','Fermer l’aperçu')" [modal]="true" [draggable]="false"
   [style]="{width:'740px',maxWidth:'calc(100vw - 24px)'}">
   @if(selected(); as video){
    <p class="mb-4 text-sm text-muted">{{s.t('Client video preview','Aperçu de la vidéo côté client')}}</p>
    <div class="relative overflow-hidden rounded-xl" [attr.aria-busy]="loading()">
    @if(url(); as source){
     <video class="aspect-video w-full rounded-xl bg-black" [src]="source" controls playsinline
      preload="auto" [attr.aria-label]="video.name" (canplay)="loading.set(false)"
      (waiting)="loading.set(true)" (playing)="loading.set(false)"
      (error)="loading.set(false); playbackError.set(true)">
      {{s.t('Your browser does not support video playback.','Votre navigateur ne prend pas en charge la lecture vidéo.')}}
     </video>
    }
    @if(loading()){
     <div class="pointer-events-none flex aspect-video w-full items-center justify-center bg-canvas/95" [class.absolute]="!!url()" [class.inset-0]="!!url()">
      <app-loading-state [label]="s.t('Loading video…','Chargement de la vidéo…')"/>
     </div>
    }
    </div>
    @if(error() || playbackError()){
     <p role="alert" class="mt-3 text-sm text-red-700">{{error() || s.t('Could not play this video. Retry to get a fresh link.','Impossible de lire cette vidéo. Réessayez pour obtenir un nouveau lien.')}}</p>
     <button pButton text type="button" class="mt-2" (click)="retry()">{{s.t('Retry video','Réessayer la vidéo')}}</button>
    }
    @if(video.description){<p class="mt-5 whitespace-pre-line text-sm leading-6 text-muted">{{video.description}}</p>}
   }
  </p-dialog>
 `,
})
export class VideoPreview {
 readonly selected=model<VideoPreviewSelection|null>(null);
 protected readonly s=inject(Store);
 private readonly api=inject(AdminApiService);
 protected readonly url=signal('');
 protected readonly loading=signal(false);
 protected readonly error=signal('');
 protected readonly playbackError=signal(false);
 private readonly attempt=signal(0);

 constructor(){
  effect(onCleanup=>{
   const selection=this.selected();
   this.attempt();
   const controller=new AbortController();
   onCleanup(()=>controller.abort());
   this.url.set('');
   this.error.set('');
   this.playbackError.set(false);
   this.loading.set(!!selection);
   if(selection)void this.load(selection.exerciseId,controller.signal);
  });
 }

 protected retry(){this.attempt.update(value=>value+1);}

 private async load(exerciseId:string,signal:AbortSignal){
  try{
   const link=await this.api.getVideoPlaybackLink(exerciseId,signal);
   if(!signal.aborted)this.url.set(link.url);
  }catch(error){
   if(!signal.aborted){
    this.error.set(error instanceof Error?error.message:this.s.t('Could not load video.','Impossible de charger la vidéo.'));
    this.loading.set(false);
   }
  }
 }
}
