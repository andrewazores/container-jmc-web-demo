import { Component, OnInit, OnDestroy } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ListConfig } from 'patternfly-ng/list';
import { Subscription } from 'rxjs';
import { CommandChannelService, ResponseMessage } from 'src/app/command-channel.service';
import { ConfirmationDialogComponent } from 'src/app/confirmation-dialog/confirmation-dialog.component';
import { first } from 'rxjs/operators';
import { NotificationService, NotificationType } from 'patternfly-ng/notification';
import { HttpClient } from '@angular/common/http';
import { SavedRecording, UploadResponse } from '../recording-list.component';

@Component({
  selector: 'app-archived-recording-list',
  templateUrl: './archived-recording-list.component.html'
})
export class ArchivedRecordingListComponent implements OnInit, OnDestroy {

  recordings: SavedRecording[] = [];
  listConfig: ListConfig;
  grafanaEnabled = false;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private svc: CommandChannelService,
    private modalSvc: BsModalService,
    private notifications: NotificationService,
    private http: HttpClient,
  ) {
    this.listConfig = {
      useExpandItems: true
    };
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.svc.onResponse('list-saved')
        .subscribe(r => {
          if (r.status === 0) {
            this.recordings = r.payload;
          }
        })
    );

    this.subscriptions.push(
      this.svc.onResponse('delete-saved')
        .subscribe(r => {
          if (r.status === 0) {
            this.refreshList();
          }
        })
    );

    this.subscriptions.push(
      this.svc.onResponse('save')
        .subscribe(r => {
          if (r.status === 0) {
            this.refreshList();
          }
        })
    );

    this.subscriptions.push(
      this.svc.grafanaDatasourceUrl().pipe(
        first()
      ).subscribe(() => this.grafanaEnabled = true)
    );

    this.subscriptions.push(
      this.svc.onResponse('upload-saved')
        .subscribe((r: ResponseMessage<UploadResponse>) => {
          if (r.status === 0) {
            this.notifications.message(
              NotificationType.SUCCESS, 'Upload success', null, false, null, null
            );
            this.http.get('/grafana_dashboard_url')
              .subscribe((url: { grafanaDashboardUrl: string }) => window.open(url.grafanaDashboardUrl, '_blank'));
          }
        })
    );

    this.refreshList();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  refreshList(): void {
    this.svc.sendMessage('list-saved');
  }

  delete(name: string): void {
    this.modalSvc.show(ConfirmationDialogComponent, {
      initialState: {
        destructive: true,
        title: 'Confirm Deletion',
        message: 'Are you sure you would like to delete this recording? ' +
        'Once deleted, recordings can not be retrieved and the data is lost.'
      }
    }).content.onAccept().subscribe(() => this.svc.sendMessage('delete-saved', [ name ]));
  }

  grafanaUpload(name: string): void {
    this.svc.grafanaDatasourceUrl().pipe(
      first()
    ).subscribe(grafana => {
      this.notifications.message(
        NotificationType.INFO, 'Upload started', null, false, null, null
      );
      this.svc.sendMessage('upload-saved', [ name, `${grafana}/load` ]);
    });
  }

  reportLoaded(spinner: HTMLDivElement, frame: HTMLIFrameElement): void {
    spinner.hidden = true;
    frame.hidden = false;
  }

}
