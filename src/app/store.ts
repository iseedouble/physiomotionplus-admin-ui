import { Injectable, signal, inject, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
export interface Exercise {id:string;name:string;description:string;video:string;clientExerciseId?:string;}
export interface RehabModule {id:string;name:string;description:string;area:string;status:'Draft'|'Published';exercises:Exercise[];version:number;}
export interface Client {id:number;name:string;initials:string;email:string;moduleIds:string[];}
export interface Message {id:number;clientId:number;from:'client'|'physio';body:string;}
@Injectable({providedIn:'root'})
export class Store {
 readonly fr=signal(false);
 private readonly doc=inject(DOCUMENT);
 constructor(){effect(()=>{this.doc.documentElement.lang=this.fr()?'fr':'en';});}
 t(en:string,fr:string){return this.fr()?fr:en;}
 // Modules are loaded from the admin API. No local seed data.
 readonly modules=signal<RehabModule[]>([]);
 readonly clients=signal<Client[]>([]);
 readonly messages=signal<Message[]>([]);
}
