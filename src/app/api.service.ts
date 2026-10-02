import { Injectable } from '@angular/core';
import { getIdToken } from 'firebase/auth';
import type { RehabModule } from './store';
import { adminAuth } from './firebase';
import { environment } from '../environments/environment';

export interface AdminVideo { exerciseId: string; filename: string; contentType: string; size: number; uploadedAt: string; folderPath?: string; }
export interface VideoPlaybackLink { url: string; expiresAt: string; contentType: string; }

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly apiUrl = environment.apiBaseUrl;
  private videoError(response: Response, action: string): Error {
    if (response.status === 403) return new Error('This account is not allowed to manage videos. Configure VIDEO_ALLOWED_ADMIN_UIDS in the admin API.');
    return new Error(action + ' (' + response.status + ')');
  }
  private async authHeaders(): Promise<HeadersInit> {
    const user = adminAuth.currentUser;
    if (!user) throw new Error('You must be signed in first.');
    return { Authorization: 'Bearer ' + await getIdToken(user) };
  }
  async listModules(): Promise<RehabModule[]> {
    const response = await fetch(this.apiUrl + '/api/admin/modules', {headers: await this.authHeaders(), cache: 'no-store'});
    if (!response.ok) throw new Error('Could not load modules (' + response.status + ')');
    return response.json();
  }

  async saveModule(module: RehabModule): Promise<RehabModule> {
    const response = await fetch(this.apiUrl + '/api/admin/modules/' + encodeURIComponent(module.id), {
      method: 'PUT', headers: {...await this.authHeaders(), 'Content-Type': 'application/json'}, body: JSON.stringify(module)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Could not save module (' + response.status + ')');
    }
    return response.json();
  }

  async listVideos(): Promise<AdminVideo[]> {
    const response = await fetch(this.apiUrl + '/api/admin/videos', { headers: await this.authHeaders() });
    if (!response.ok) throw this.videoError(response, 'Could not load videos');
    return response.json() as Promise<AdminVideo[]>;
  }

  async getVideoPlaybackLink(exerciseId: string, signal: AbortSignal): Promise<VideoPlaybackLink> {
    const response = await fetch(this.apiUrl + '/api/admin/videos/' + encodeURIComponent(exerciseId) + '/preview', {
      headers: await this.authHeaders(), cache: 'no-store', signal,
    });
    if (!response.ok) throw this.videoError(response, 'Could not load video preview');
    return response.json() as Promise<VideoPlaybackLink>;
  }

  async uploadVideo(exerciseId: string, file: File): Promise<AdminVideo> {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(this.apiUrl + '/api/admin/videos/' + encodeURIComponent(exerciseId), {
      method: 'PUT',
      headers: await this.authHeaders(),
      body,
    });
    if (!response.ok) throw this.videoError(response, 'Video upload failed');
    return response.json() as Promise<AdminVideo>;
  }

  async deleteVideo(exerciseId: string): Promise<void> {
    const response = await fetch(this.apiUrl + '/api/admin/videos/' + encodeURIComponent(exerciseId), {
      method: 'DELETE',
      headers: await this.authHeaders(),
    });
    if (!response.ok) throw this.videoError(response, 'Video deletion failed');
  }
}
