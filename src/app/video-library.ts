import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AdminVideo } from './api.service';
import { Store } from './store';
import { LoadingState } from './loading-state';

@Component({
 selector: 'app-video-library',
 imports: [DatePipe, FormsModule, ButtonModule, InputTextModule, LoadingState],
 templateUrl: './video-library.html',
 changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoLibrary {
 readonly s=inject(Store);
 readonly videos=input.required<AdminVideo[]>();
 readonly loading=input(false);
 readonly error=input('');
 readonly preview=output<AdminVideo>();
 readonly manage=output<AdminVideo>();
 readonly reload=output<void>();
 readonly path=signal('');
 readonly search=signal('');
 readonly breadcrumbs=computed(()=>this.path().split('/').filter(Boolean).map((label,index,parts)=>({label,path:parts.slice(0,index+1).join('/')})));
 readonly missingFolders=computed(()=>this.videos().some(video=>video.folderPath===undefined));
 readonly contents=computed(()=>{
  const path=this.path();
  const query=this.search().trim().toLowerCase();
  const folders=new Map<string,number>();
  const videos:AdminVideo[]=[];
  for(const video of this.videos()){
   const folder=video.folderPath??'';
   if(path && folder!==path && !folder.startsWith(path+'/'))continue;
   if(query){
    if((video.filename+' '+video.exerciseId+' '+folder).toLowerCase().includes(query))videos.push(video);
    continue;
   }
   if(folder===path){videos.push(video);continue;}
   const child=folder.slice(path?path.length+1:0).split('/')[0];
   if(child)folders.set(child,(folders.get(child)??0)+1);
  }
  return {
   folders:[...folders].sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>({name,count,path:path?path+'/'+name:name})),
   videos:videos.sort((a,b)=>a.filename.localeCompare(b.filename)),
  };
 });
 openFolder(path:string){this.path.set(path);this.search.set('');}
}
