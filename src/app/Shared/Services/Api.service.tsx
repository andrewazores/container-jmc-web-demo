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
import { TargetService } from './Target.service';
import { Notifications } from '@app/Notifications/Notifications';

class HttpError extends Error {
  readonly httpResponse: Response;

  constructor(httpResponse: Response) {
    super(httpResponse.statusText);
    this.httpResponse = httpResponse;
  }
}

const isHttpError = (toCheck: any): toCheck is HttpError => {
  if (!(toCheck instanceof Error)) {
    return false;
  }
  return (toCheck as HttpError).httpResponse !== undefined;
}

export class ApiService {

  private readonly token = new ReplaySubject<string>(1);
  private readonly authMethod = new ReplaySubject<string>(1);
  readonly authority: string;

   constructor(
     private readonly target: TargetService,
     private readonly notifications: Notifications
   ) {
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
      headers: this.getAuthHeaders(token, method),
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

  createRecording(
    { recordingName, events, duration  }: { recordingName: string; events: string; duration?: number }
    ): Observable<boolean> {
      const form = new window.FormData();
      form.append('recordingName', recordingName);
      form.append('events', events);
      if (!!duration && duration > 0) {
        form.append('duration', String(duration));
      }
      return this.target.target().pipe(concatMap(targetId =>
        this.sendRequest(`targets/${encodeURIComponent(targetId)}/recordings`, {
          method: 'POST',
          body: form,
        }).pipe(
          tap(resp => {
            if (resp.ok) {
              this.notifications.success('Recording created');
            }
          }),
          map(resp => resp.ok),
          first(),
        )));
  }

  createSnapshot(): Observable<boolean> {
    return this.target.target().pipe(concatMap(targetId =>
      this.sendRequest(`targets/${encodeURIComponent(targetId)}/snapshot`, {
        method: 'POST',
      }).pipe(
        tap(resp => {
          if (resp.ok) {
            this.notifications.success('Recording created');
          }
        }),
        map(resp => resp.ok),
        first(),
      )
    ));
  }

  archiveRecording(recordingName: string): Observable<boolean> {
    return this.target.target().pipe(concatMap(targetId =>
      this.sendRequest(
        `targets/${encodeURIComponent(targetId)}/recordings/${encodeURIComponent(recordingName)}`,
        {
          method: 'PATCH',
          body: 'SAVE',
        }
      ).pipe(
        map(resp => resp.ok),
        first(),
      )
    ));
  }

  stopRecording(recordingName: string): Observable<boolean> {
    return this.target.target().pipe(concatMap(targetId =>
      this.sendRequest(
        `targets/${encodeURIComponent(targetId)}/recordings/${encodeURIComponent(recordingName)}`,
        {
          method: 'PATCH',
          body: 'STOP',
        }
      ).pipe(
        map(resp => resp.ok),
        first(),
      )
    ));
  }

  deleteRecording(recordingName: string): Observable<boolean> {
    return this.target.target().pipe(concatMap(targetId =>
      this.sendRequest(
        `targets/${encodeURIComponent(targetId)}/recordings/${encodeURIComponent(recordingName)}`,
        {
          method: 'DELETE',
        }
      ).pipe(
        map(resp => resp.ok),
        first(),
      )
    ));
  }

  deleteArchivedRecording(recordingName: string): Observable<boolean> {
    return this.sendRequest(`recordings/${encodeURIComponent(recordingName)}`, {
      method: 'DELETE'
    }).pipe(
      map(resp => resp.ok),
      first(),
    );
  }

  uploadActiveRecordingToGrafana(recordingName: string): Observable<boolean> {
    return this.target.target().pipe(concatMap(targetId =>
      this.sendRequest(
        `targets/${encodeURIComponent(targetId)}/recordings/${encodeURIComponent(recordingName)}/upload`,
        {
          method: 'POST',
        }
      ).pipe(
        map(resp => resp.ok),
        first()
      )
    ));
  }

  uploadArchivedRecordingToGrafana(recordingName: string): Observable<boolean> {
    return this.sendRequest(
        `recordings/${encodeURIComponent(recordingName)}/upload`,
        {
          method: 'POST',
        }
      ).pipe(
        map(resp => resp.ok),
        first()
      )
    ;
  }

  deleteCustomEventTemplate(templateName: string): Observable<void> {
    return this.sendRequest(`templates/${encodeURIComponent(templateName)}`, {
      method: 'DELETE',
      body: null,
    })
    .pipe(
      map(response => {
        if (!response.ok) {
          throw response.statusText;
        }
      }),
      catchError((): ObservableInput<void> => of()),
    );
  }

  addCustomEventTemplate(file: File): Observable<boolean> {
    const body = new window.FormData();
    body.append('template', file);
    return this.sendRequest(`templates`, {
      method: 'POST',
      body,
    })
    .pipe(
      map(response => {
        if (!response.ok) {
          throw response.statusText;
        }
        return true;
      }),
      catchError((): ObservableInput<boolean> => of(false)),
    );
  }

  doGet<T>(path: string): Observable<T> {
    return this.sendRequest(path, { method: 'GET' }).pipe(map(resp => resp.json()), concatMap(from), first());
  }

  getAuthMethod(): Observable<string> {
    return this.authMethod.asObservable();
  }

  getToken(): Observable<string> {
    return this.token.asObservable();
  }

  downloadReport(recording: SavedRecording): void {
    this.getHeaders().subscribe(headers => {
      const req = () =>
        fromFetch(recording.reportUrl, {
          credentials: 'include',
          mode: 'cors',
          headers,
        })
          .pipe(
            map(resp => {
              if (resp.ok) return resp;
              throw new HttpError(resp);
            }),
            catchError(err => this.handleError<Response>(err, req)),
            concatMap(resp => resp.blob()),
          );
      req().subscribe(resp =>
        this.downloadFile(
          `${recording.name}.report.html`,
          resp,
          'text/html')
      )
    });
  }

  downloadRecording(recording: SavedRecording): void {
    this.getHeaders().subscribe(headers => {
      const req = () => fromFetch(recording.downloadUrl, {
        credentials: 'include',
        mode: 'cors',
        headers,
      })
        .pipe(
          map(resp => {
            if (resp.ok) return resp;
            throw new HttpError(resp);
          }),
          catchError(err => this.handleError<Response>(err, req)),
          concatMap(resp => resp.blob()),
        );
      req().subscribe(resp =>
        this.downloadFile(
          recording.name + (recording.name.endsWith('.jfr') ? '' : '.jfr'),
          resp,
          'application/octet-stream')
      )
    });
  }

  downloadTemplate(template: EventTemplate): void {
    this.target.target().pipe(concatMap(targetId => {
      const url = `targets/${encodeURIComponent(targetId)}/templates/${encodeURIComponent(template.name)}/type/${encodeURIComponent(template.type)}`;
      return this.sendRequest(url)
        .pipe(concatMap(resp => resp.text()));
    }))
    .subscribe(resp => {
      this.downloadFile(
        `${template.name}.xml`,
        resp,
        'application/jfc+xml')
    });
  }

  uploadRecording(file: File): Observable<string> {
    const body = new window.FormData(); // as multipart/form-data
    body.append('recording', file);
    return this.sendRequest('recordings', {
        method: 'POST',
        body,
      })
      .pipe(
        concatMap(resp => {
          if (resp.ok) {
            return from(resp.text());
          }
          throw resp.statusText;
        }),
      );
  }

  getHeaders(): Observable<Headers> {
    return this.getToken().pipe(
      combineLatest(this.getAuthMethod()),
      map(auths => this.getAuthHeaders(auths[0], auths[1])),
      combineLatest(this.target.target()),
      first(),
      concatMap(parts => {
        const headers = parts[0];
        const target = parts[1];
        if (!!target && this.target.hasCredentials(target)) {
          const credentials = this.target.getCredentials(target);
          if (credentials) {
            headers.set('X-JMX-Authorization', `Basic ${this.target.getCredentials(target)}`);
          }
        }
        return of(headers);
      })
    );
  }

  private sendRequest(path: string, config?: RequestInit): Observable<Response> {
    const req = () => this.getHeaders().pipe(
      concatMap(headers =>
        fromFetch(`${this.authority}/api/v1/${path}`, {
          credentials: 'include',
          mode: 'cors',
          headers,
          ...config,
        }),
      ),
      map(resp => {
        if (resp.ok) return resp;
        throw new HttpError(resp);
      }),
      catchError(err => this.handleError<Response>(err, req)),
    );
    return req();
  }

  private getAuthHeaders(token: string, method: string): Headers {
    const headers = new window.Headers();
    if (!!token && !!method) {
      headers.set('Authorization', `${method} ${token}`)
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

  private handleError<T>(error: Error, retry: () => Observable<T>): ObservableInput<T> {
    if (isHttpError(error)) {
      if (error.httpResponse.status === 407) {
        const jmxAuthScheme = error.httpResponse.headers.get('X-JMX-Authenticate');
        if (jmxAuthScheme === 'Basic') {
          this.target.setAuthFailure();
          return this.target.authRetry().pipe(
            flatMap(() => retry())
          );
        }
      }
      this.notifications.danger(`Request failed (Status ${error.httpResponse.status})`, error.message)
      throw error;
    }
    this.notifications.danger(`Request failed`, error.message);
    throw error;
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

export interface EventTemplate {
  name: string;
  description: string;
  provider: string;
  type: 'CUSTOM' | 'TARGET';
}
