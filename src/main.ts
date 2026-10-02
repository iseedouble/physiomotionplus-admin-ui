import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { App } from './app/app';
import { Workspace } from './app/workspace';
const theme = definePreset(Aura,{semantic:{primary:{50:'#f0f5ef',100:'#dce8dc',200:'#b9d0bb',300:'#91b296',400:'#66886f',500:'#406d54',600:'#315841',700:'#254b37',800:'#203d30',900:'#193328',950:'#101f19'}}});
bootstrapApplication(App,{providers:[provideRouter([
 {path:'',pathMatch:'full',redirectTo:'modules'},
 {path:'modules/:moduleId/exercises',component:Workspace,data:{section:'exercises'}},
 {path:'modules',component:Workspace,data:{section:'modules'}},
 {path:'clients',component:Workspace,data:{section:'clients'}},
 {path:'messages',component:Workspace,data:{section:'messages'}},
 {path:'**',redirectTo:'modules'}
],withComponentInputBinding()),providePrimeNG({theme:{preset:theme,options:{darkModeSelector:false,cssLayer:{name:'primeng',order:'theme, base, primeng, components, utilities'}}}})]}).catch(console.error);
