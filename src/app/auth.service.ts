import { Injectable, signal } from '@angular/core';
import { GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { adminAuth } from './firebase';

@Injectable({providedIn:'root'})
export class AdminAuthService {
 readonly user=signal<User|null>(null);
 readonly ready=signal(false);
 constructor(){onAuthStateChanged(adminAuth,user=>{this.user.set(user);this.ready.set(true);});}
 async signIn(email:string,password:string){await signInWithEmailAndPassword(adminAuth,email.trim(),password);}
 async signInWithGoogle(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(adminAuth,provider);}
 async reset(email:string){await sendPasswordResetEmail(adminAuth,email.trim());}
 async signOut(){await signOut(adminAuth);}
}
