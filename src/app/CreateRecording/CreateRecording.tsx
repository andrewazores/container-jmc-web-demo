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
import * as React from 'react';
import { NotificationsContext } from '@app/Notifications/Notifications';
import { ServiceContext } from '@app/Shared/Services/Services';
import { TargetView } from '@app/TargetView/TargetView';
import { Card, CardBody, Tab, Tabs } from '@patternfly/react-core';
import { StaticContext } from 'react-router';
import { RouteComponentProps, useHistory, withRouter } from 'react-router-dom';
import { filter, first } from 'rxjs/operators';
import { CustomRecordingForm } from './CustomRecordingForm';
import { SnapshotRecordingForm } from './SnapshotRecordingForm';

export interface CreateRecordingProps {
  recordingName?: string;
  template?: string;
  eventSpecifiers?: string[];
}

export interface EventTemplate {
  name: string;
  description: string;
  provider: string;
}

const Comp: React.FunctionComponent< RouteComponentProps<{}, StaticContext, CreateRecordingProps>> = (props) => {
  const context = React.useContext(ServiceContext);
  const notifications = React.useContext(NotificationsContext);
  const history = useHistory();

  const [activeTab, setActiveTab] = React.useState(0);

  const handleSubmit = (command: string, args: string[]): void => {
    const id = context.commandChannel.createMessageId();
    context.commandChannel.onResponse(command).pipe(
      filter(m => m.id === id),
      first(),
      )
      .subscribe((msg) => {
          if (msg.status === 0) {
            notifications.success('Recording created');
            history.push('/recordings');
          } else {
            notifications.danger(`Request failed (Status ${msg.status})`, msg.payload)
          }
      });
    context.commandChannel.sendMessage(command, args, id);
  };

  return (
    <TargetView pageTitle="Create Recording" breadcrumbs={[{ title: 'Recordings', path: '/recordings' }]}>
      <Card>
        <CardBody>
          <Tabs activeKey={activeTab} onSelect={(evt, idx) => setActiveTab(Number(idx))}>
            <Tab eventKey={0} title="Custom Flight Recording">
              <CustomRecordingForm onSubmit={handleSubmit}
                recordingName={props?.location?.state?.recordingName}
                template={props?.location?.state?.template}
                eventSpecifiers={props?.location?.state?.eventSpecifiers}
              />
            </Tab>
            <Tab eventKey={1} title="Snapshot Recording">
              <SnapshotRecordingForm onSubmit={handleSubmit} />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </TargetView>
  );

};

export const CreateRecording = withRouter(Comp);
