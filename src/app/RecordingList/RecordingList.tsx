import * as React from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Text, TextVariants } from '@patternfly/react-core';
import { ServiceContext } from '@app/Shared/Services/Services';
import { TargetView } from '@app/TargetView/TargetView';
import { ActiveRecordingsList } from './ActiveRecordingsList';
import { ArchivedRecordingsList } from './ArchivedRecordingsList';

export interface Recording {
  id: number;
  name: string;
  state: RecordingState;
  startTime: number;
  duration: number;
  continuous: boolean;
  toDisk: boolean;
  maxSize: number;
  maxAge: number;
  downloadUrl: string;
  reportUrl: string;
}

export enum RecordingState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
}

export const RecordingList = (props) => {
  const context = React.useContext(ServiceContext);
  const [activeTab, setActiveTab] = React.useState(0);
  const [archiveEnabled, setArchiveEnabled] = React.useState(false);

  React.useEffect(() => {
    const sub = context.commandChannel.isArchiveEnabled().subscribe(enabled => setArchiveEnabled(enabled));
    return () => sub.unsubscribe();
  }, []);

  return (
    <TargetView pageTitle="Recordings">
      <Card>
        <CardBody>
          {
            archiveEnabled ? (
              <Tabs activeKey={activeTab} onSelect={(evt, idx) => setActiveTab(Number(idx))}>
                <Tab eventKey={0} title="Active Recordings">
                  <ActiveRecordingsList archiveEnabled={true}/>
                </Tab>
                <Tab eventKey={1} title="Archived Recordings">
                  <ArchivedRecordingsList />
                </Tab>
              </Tabs>
            ) : (
              <>
                <CardHeader><Text component={TextVariants.h4}>Active Recordings</Text></CardHeader>
                <ActiveRecordingsList archiveEnabled={false}/>
              </>
            )
          }
        </CardBody>
      </Card>
    </TargetView>
  );
};
