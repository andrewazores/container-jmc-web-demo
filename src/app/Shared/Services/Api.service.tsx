/*
 * Copyright (c) 2020 Red Hat, Inc.
 * 
 * The Universal Permissive License (UPL), Version 1.0
 * 
 * Subject to the condition set forth below, permission is hereby granted to any
 * person obtaining a copy of this software, associated documentation and/or data
 * (collectively the "Software"), free of charge and under any and all copyright
 * rights in the Software, and any and all patent rights owned or freely
 * licensable by each licensor hereunder covering either (i) the unmodified
 * Software as contributed to or provided by such licensor, or (ii) the Larger
 * Works (as defined below), to deal in both
 * 
 * (a) the Software, and
 * (b) any piece of software and/or hardware listed in the lrgrwrks.txt file if
 * one is included with the Software (each a "Larger Work" to which the Software
 * is contributed by such licensors),
 * 
 * without restriction, including without limitation the rights to copy, create
 * derivative works of, display, perform, and distribute the Software and make,
 * use, sell, offer for sale, import, export, have made, and have sold the
 * Software and the Larger Work(s), and to sublicense the foregoing rights on
 * either these or other terms.
 * 
 * This license is subject to the following condition:
 * The above copyright notice and either this complete permission notice or at
 * a minimum a reference to the UPL must be included in all copies or
 * substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { from, Observable, ObservableInput, of, ReplaySubject } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { catchError, combineLatest, concatMap, first, flatMap, map, tap } from 'rxjs/operators';

export class ApiService {

  private readonly token = new ReplaySubject<string>(1);
  private readonly authMethod = new ReplaySubject<string>(1);
  readonly authority: string;

   constructor() {
      let apiAuthority = process.env.CONTAINER_JFR_AUTHORITY;
      if (!apiAuthority) {
        apiAuthority = '';
      }
      window.console.log(`Using API authority ${apiAuthority}`);
      this.authority = apiAuthority;
   }

  checkAuth(token: string, method: string): Observable<boolean> {
    return fromFetch(`${this.authority}/api/v1/auth`, {
      credentials: 'include',
      mode: 'cors',
      method: 'POST',
      body: null,
      headers: this.getHeaders(token, method)
    })
    .pipe(
      map(response => {
        if (!this.authMethod.isStopped) {
          this.authMethod.next(response.ok ? method : (response.headers.get('X-WWW-Authenticate') || ''));
        }
        return response.ok;
      }),
      catchError((e: Error): ObservableInput<boolean> => {
        window.console.error(JSON.stringify(e));
        this.authMethod.complete();
        return of(false);
      }),
      first(),
      tap(v => {
        if (v) {
          this.authMethod.next(method);
          this.authMethod.complete();
          this.token.next(token);
        }
      })
    );
  }

  getAuthMethod(): Observable<string> {
    return this.authMethod.asObservable();
  }

  getToken(): Observable<string> {
    return this.token.asObservable();
  }

  downloadReport(recording: SavedRecording): void {
    this.getToken().pipe(
      combineLatest(this.getAuthMethod()),
      first()
    ).subscribe(auths =>
      fromFetch(recording.reportUrl, {
        credentials: 'include',
        mode: 'cors',
        headers: this.getHeaders(auths[0], auths[1]),
      })
      .pipe(concatMap(resp => resp.blob()))
      .subscribe(resp =>
        this.downloadFile(
          `${recording.name}.report.html`,
          resp,
          'text/html')
      )
    );
  }

  downloadRecording(recording: SavedRecording): void {
    this.getToken().pipe(
      combineLatest(this.getAuthMethod()),
      first()
    ).subscribe(auths =>
      fromFetch(recording.downloadUrl, {
        credentials: 'include',
        mode: 'cors',
        headers: this.getHeaders(auths[0], auths[1]),
      })
      .pipe(concatMap(resp => resp.blob()))
      .subscribe(resp =>
        this.downloadFile(
          recording.name + (recording.name.endsWith('.jfr') ? '' : '.jfr'),
          resp,
          'application/octet-stream')
      )
    );
  }

  uploadRecording(file: File): Observable<string> {
    const payload = new window.FormData(); // as multipart/form-data
    payload.append('recording', file);

    return this.getToken().pipe(
      combineLatest(this.getAuthMethod()),
      first(),
      flatMap(auths =>
        fromFetch(`/api/v1/recordings`, {
          credentials: 'include',
          mode: 'cors',
          body: payload,
          headers: this.getHeaders(auths[0], auths[1]),
        })),
      concatMap(resp => from(resp.text()))
    );
  }

  private getHeaders(token: string, method: string): Headers {
    const headers = new window.Headers();
    if (!!token && !!method) {
      headers.append('Authorization', `${method} ${token}`)
    }
    return headers;
  }

  private downloadFile(filename: string, data: BlobPart, type: string): void {
    const blob = new window.Blob([ data ], { type } );
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url));
  }

}

export interface SavedRecording {
  name: string;
  downloadUrl: string;
  reportUrl: string;
}

export interface Recording extends SavedRecording {
  id: number;
  state: RecordingState;
  duration: number;
  startTime: number;
  continuous: boolean;
  toDisk: boolean;
  maxSize: number;
  maxAge: number;
}

export enum RecordingState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
}

export const isActiveRecording = (toCheck: SavedRecording): toCheck is Recording => {
  return (toCheck as Recording).state !== undefined;
}
