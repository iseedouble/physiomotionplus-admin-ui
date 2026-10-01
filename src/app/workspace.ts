import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { Store, RehabModule, Exercise } from './store';
import { AdminApiService, AdminJwtTestResponse, AdminVideo } from './api.service';
import { VideoPreview, VideoPreviewSelection } from './video-preview';

@Component({selector:'app-workspace',imports:[FormsModule,ButtonModule,InputTextModule,TextareaModule,DialogModule,SelectModule,VideoPreview],templateUrl:'./workspace.html',changeDetection:ChangeDetectionStrategy.OnPush})
export class Workspace {
 readonly s=inject(Store);
 readonly api=inject(AdminApiService);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 readonly section=this.route.snapshot.data['section'] as string;
 readonly search=signal('');
 readonly filter=signal('All');
 readonly selected=signal<string|null>(null);
 readonly clientId=signal<number|null>(this.s.clients().find(c=>c.id===Number(this.route.snapshot.queryParamMap.get('client')))?.id ?? null);
 readonly client=computed(()=>this.s.clients().find(c=>c.id===this.clientId()));
 readonly conversation=computed(()=>this.s.messages().filter(m=>m.clientId===this.clientId()));
 readonly modules=computed(()=>this.s.modules().filter(m=>(this.filter()==='All'||m.status===this.filter())&&(m.name+' '+m.description+' '+m.area).toLowerCase().includes(this.search().toLowerCase())));
 readonly clients=computed(()=>this.s.clients().filter(c=>(c.name+' '+c.email).toLowerCase().includes(this.search().toLowerCase())));
 readonly current=computed(()=>this.s.modules().find(m=>m.id===this.selected()));
 readonly published=computed(()=>this.s.modules().filter(m=>m.status==='Published').length);
 readonly totalExercises=computed(()=>this.s.modules().reduce((n,m)=>n+m.exercises.length,0));
 readonly loading=signal(false);
 readonly saving=signal(false);
 readonly dataError=signal('');
 readonly libraryMode=signal(false);
 readonly editor=signal(false);
 readonly draft=signal<RehabModule>({id:'',name:'',description:'',area:'Ankle',status:'Draft',exercises:[],version:0});
 readonly exerciseEditor=signal(false);
 readonly exerciseDraft=signal<Exercise>({id:'',name:'',description:'',video:''});
 readonly videos=signal<AdminVideo[]>([]);
 readonly videosLoadError=signal('');
 readonly videoBusy=signal(false);
 readonly videoError=signal('');
 readonly videoNotice=signal('');
 readonly videoFile=signal<File|null>(null);
 readonly preview=signal<VideoPreviewSelection|null>(null);
 previewVideo(video:AdminVideo){this.preview.set({exerciseId:video.exerciseId,name:video.filename,description:''});}
 previewExercise(exercise:Exercise){this.preview.set({exerciseId:exercise.clientExerciseId||exercise.id,name:exercise.name,description:exercise.description});}
 readonly deletePending=signal(false);
 readonly currentVideo=computed(()=>this.videos().find(video=>video.exerciseId===this.exerciseDraft().clientExerciseId));
 readonly existingVideoOptions=computed(()=>this.videos().map(video=>({label:video.filename+' · '+video.exerciseId,value:video.exerciseId})));
 linkVideo(id:string|null){this.exerciseDraft.update(e=>({...e,clientExerciseId:id||e.id}));this.videoFile.set(null);this.deletePending.set(false);}
 readonly detailOpen=signal(false);
 readonly reply=signal('');
 readonly notice=signal('');
 readonly apiBusy=signal(false);
 readonly apiResult=signal<AdminJwtTestResponse|null>(null);
 readonly apiError=signal('');
 readonly areaOptions=computed(()=>[{label:this.s.t('Ankle','Cheville'),value:'Ankle'},{label:this.s.t('Shoulder','Épaule'),value:'Shoulder'},{label:this.s.t('Back','Dos'),value:'Back'},{label:this.s.t('Knee','Genou'),value:'Knee'}]);
 areaLabel(area:string){return this.areaOptions().find(a=>a.value===area)?.label || area;}
 status(status:string){return status==='Published'?this.s.t('Published','Publié'):this.s.t('Draft','Brouillon');}
 openModule(m?:RehabModule){this.dataError.set('');this.draft.set(m?{...structuredClone(m),description:m.description??''}:{id:crypto.randomUUID(),name:'',description:'',area:'Ankle',status:'Draft',exercises:[],version:0});this.editor.set(true);}
 updateDraft(field:'name'|'description'|'area',value:string){this.draft.update(d=>({...d,[field]:value}));}
 async saveModule(){if(!this.draft().name.trim())return;const saved=await this.persist(this.draft());if(saved){this.selected.set(saved.id);this.editor.set(false);}}
 openDetail(m:RehabModule){this.selected.set(m.id);this.detailOpen.set(true);this.notice.set('');}
 async togglePublish(){const m=this.current();if(!m)return;if(!m.exercises.length){this.notice.set(this.s.t('Add an exercise before publishing.','Ajoutez un exercice avant de publier.'));return;}await this.persist({...m,status:m.status==='Draft'?'Published':'Draft'});}
 constructor(){void this.loadModules();if(this.section==='modules')void this.loadVideos();}
 async loadModules(){this.loading.set(true);this.dataError.set('');try{this.s.modules.set(await this.api.listModules());}catch(error){this.dataError.set(error instanceof Error?error.message:'Could not load modules.');}finally{this.loading.set(false);}}
 private async persist(module:RehabModule):Promise<RehabModule|null>{
  if(this.saving()||this.loading())return null;
  this.saving.set(true);this.dataError.set('');
  try{const saved=await this.api.saveModule(module);this.s.modules.update(ms=>ms.some(m=>m.id===saved.id)?ms.map(m=>m.id===saved.id?saved:m):[...ms,saved]);return saved;}
  catch(error){this.dataError.set(error instanceof Error?error.message:'Could not save changes.');return null;}
  finally{this.saving.set(false);}
 }
 openExercise(e?:Exercise){this.libraryMode.set(false);const id=crypto.randomUUID();this.exerciseDraft.set(e?{...e}:{id,name:'',description:'',video:'',clientExerciseId:id});this.videoFile.set(null);this.videoError.set('');this.videoNotice.set('');this.dataError.set('');this.deletePending.set(false);this.exerciseEditor.set(true);}
 openLibraryVideo(video:AdminVideo){this.openExercise({id:video.exerciseId,name:video.filename,description:'',video:'',clientExerciseId:video.exerciseId});this.libraryMode.set(true);}
 updateExercise(field:'name'|'description',value:string){this.exerciseDraft.update(e=>({...e,[field]:value}));}
 async saveExercise(close=true):Promise<boolean>{
  if(close&&this.videoFile()){await this.uploadVideo();const uploaded=!this.videoFile()&&!this.videoError();if(uploaded)this.exerciseEditor.set(false);return uploaded;}
  const e=this.exerciseDraft();const m=this.current();if(!m||!e.name.trim()||this.libraryMode())return false;
  const saved=await this.persist({...m,exercises:m.exercises.some(x=>x.id===e.id)?m.exercises.map(x=>x.id===e.id?e:x):[...m.exercises,e]});
  if(saved&&close)this.exerciseEditor.set(false);return !!saved;
 }
 async move(index:number,delta:number){const m=this.current();if(!m)return;const list=[...m.exercises];if(index+delta<0||index+delta>=list.length)return;[list[index],list[index+delta]]=[list[index+delta],list[index]];await this.persist({...m,exercises:list});}
 async removeExercise(id:string){const m=this.current();if(!m)return;await this.persist({...m,status:m.exercises.length===1?'Draft':m.status,exercises:m.exercises.filter(e=>e.id!==id)});}
 assigned(id:number){return this.s.modules().filter(m=>this.s.clients().find(c=>c.id===id)?.moduleIds.includes(m.id));}
 toggleAssignment(moduleId:string){this.s.clients.update(cs=>cs.map(c=>c.id===this.clientId()?{...c,moduleIds:c.moduleIds.includes(moduleId)?c.moduleIds.filter(id=>id!==moduleId):[...c.moduleIds,moduleId]}:c));}
 messageClient(id:number){this.router.navigate(['/messages'],{queryParams:{client:id}});}
 chooseClient(id:number){this.clientId.set(id);this.reply.set('');}
 latest(id:number){return this.s.messages().filter(m=>m.clientId===id).at(-1)?.body || this.s.t('No messages yet','Aucun message');}
 async testApi(){this.apiBusy.set(true);this.apiError.set('');try{this.apiResult.set(await this.api.testProtectedEndpoint());}catch(error){this.apiResult.set(null);this.apiError.set(error instanceof Error?error.message:this.s.t('Admin API request failed.','La requête API admin a échoué.'));}finally{this.apiBusy.set(false);}}
 async loadVideos(){this.videosLoadError.set('');try{this.videos.set(await this.api.listVideos());}catch(error){this.videosLoadError.set(error instanceof Error?error.message:'Could not load videos.');}}
 onVideoPicked(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0]??null;this.videoError.set('');this.videoNotice.set('');if(file&&file.size>250*1024*1024){this.videoFile.set(null);this.videoError.set(this.s.t('Video exceeds 250 MB.','La vidéo dépasse 250 Mo.'));return;}this.videoFile.set(file);}
 async uploadVideo(){const exerciseId=this.exerciseDraft().clientExerciseId;const file=this.videoFile();if(!exerciseId||!file||this.videoBusy()||this.saving())return;if(!this.libraryMode()&&!await this.saveExercise(false))return;this.videoBusy.set(true);this.videoError.set('');this.videoNotice.set('');try{const uploaded=await this.api.uploadVideo(exerciseId,file);this.videos.update(videos=>[...videos.filter(video=>video.exerciseId!==exerciseId),uploaded]);this.videoFile.set(null);this.videoNotice.set(this.s.t('Video uploaded for this exercise ID.','Vidéo téléversée pour cet identifiant d’exercice.'));}catch(error){this.videoError.set(error instanceof Error?error.message:'Upload failed.');}finally{this.videoBusy.set(false);}}
 async deleteVideo(){const exerciseId=this.exerciseDraft().clientExerciseId;if(!exerciseId)return;if(!this.deletePending()){this.deletePending.set(true);return;}this.videoBusy.set(true);this.videoError.set('');try{await this.api.deleteVideo(exerciseId);this.videos.update(videos=>videos.filter(video=>video.exerciseId!==exerciseId));this.videoNotice.set(this.s.t('Video deleted.','Vidéo supprimée.'));this.deletePending.set(false);}catch(error){this.videoError.set(error instanceof Error?error.message:'Deletion failed.');}finally{this.videoBusy.set(false);}}
}
