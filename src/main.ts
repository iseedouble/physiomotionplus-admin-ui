import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { AdminTheme } from './app/theme';
import { App } from './app/app';
import { Workspace } from './app/workspace';
bootstrapApplication(App,{providers:[provideRouter([
 {path:'',pathMatch:'full',redirectTo:'modules'},
 {path:'modules/:moduleId/exercises',component:Workspace,data:{section:'exercises'}},
 {path:'modules',component:Workspace,data:{section:'modules'}},
 {path:'videos',component:Workspace,data:{section:'videos'}},
 {path:'clients',loadComponent:()=>import('./app/care/care-workspace').then(m=>m.CareWorkspace)},
 {path:'messages',loadComponent:()=>import('./app/care/care-workspace').then(m=>m.CareWorkspace)},
 {path:'**',redirectTo:'modules'}
],withComponentInputBinding()),providePrimeNG({theme:{preset:AdminTheme,options:{darkModeSelector:false,cssLayer:{name:'primeng',order:'theme, base, primeng, components, utilities'}}}})]}).catch(console.error);
