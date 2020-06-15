import * as React from 'react';
import { NotificationsContext } from '@app/Notifications/Notifications';
import { ServiceContext } from '@app/Shared/Services/Services';
import { Button, DataListAction, DataListCell, DataListCheck, DataListItemCells, DataListItemRow, Toolbar, ToolbarContent, ToolbarItem, Dropdown, DropdownItem, DropdownPosition, KebabToggle, Text } from '@patternfly/react-core';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { filter, first, map } from 'rxjs/operators';
import { Recording, RecordingState } from './RecordingList';
import { RecordingsDataTable } from './RecordingsDataTable';

export interface ActiveRecordingsListProps {
  archiveEnabled: boolean;
}

export const ActiveRecordingsList: React.FunctionComponent<ActiveRecordingsListProps> = (props) => {
  const context = React.useContext(ServiceContext);
  const routerHistory = useHistory();

  const [recordings, setRecordings] = React.useState([]);
  const [headerChecked, setHeaderChecked] = React.useState(false);
  const [checkedIndices, setCheckedIndices] = React.useState([] as number[]);
  const [openAction, setOpenAction] = React.useState(-1);
  const { url } = useRouteMatch();

  const tableColumns: string[] = [
    'Name',
    'Start Time',
    'Duration',
    'State',
  ];

  const handleRowCheck = (checked, index) => {
    if (checked) {
      setCheckedIndices(ci => ([...ci, index]));
    } else {
      setHeaderChecked(false);
      setCheckedIndices(ci => ci.filter(v => v !== index));
    }
  };

  const handleHeaderCheck = (checked) => {
    setHeaderChecked(checked);
    setCheckedIndices(checked ? Array.from(new Array(recordings.length), (x, i) => i) : []);
  };

  const handleCreateRecording = () => {
    routerHistory.push(`${url}/create`);
  };

  const handleArchiveRecordings = () => {
    recordings.forEach((r: Recording, idx) => {
      if (checkedIndices.includes(idx)) {
        handleRowCheck(false, idx);
        context.commandChannel.sendMessage('save', [ r.name ]);
      }
    });
  };

  const handleStopRecordings = () => {
    recordings.forEach((r: Recording, idx) => {
      if (checkedIndices.includes(idx)) {
        handleRowCheck(false, idx);
        if (r.state === RecordingState.RUNNING || r.state === RecordingState.STARTING) {
          context.commandChannel.sendMessage('stop', [ r.name ]);
        }
      }
    });
    context.commandChannel.sendMessage('list');
  };

  const handleDeleteRecordings = () => {
    recordings.forEach((r: Recording, idx) => {
      if (checkedIndices.includes(idx)) {
        handleRowCheck(false, idx);
        context.commandChannel.sendMessage('delete', [ r.name ]);
      }
    });
    context.commandChannel.sendMessage('list');
  };

  React.useEffect(() => {
    const sub = context.commandChannel.onResponse('list')
      .pipe(
        filter(m => m.status === 0),
        map(m => m.payload),
      )
      .subscribe(recordings => setRecordings(recordings));
    return () => sub.unsubscribe();
  }, [context.commandChannel]);

  React.useEffect(() => {
    context.commandChannel.sendMessage('list');
    const id = window.setInterval(() => context.commandChannel.sendMessage('list'), 5000);
    return () => window.clearInterval(id);
  }, [context.commandChannel]);

  const RecordingRow = (props) => {
    return (
      <DataListItemRow>
        <DataListCheck aria-labelledby="table-row-1-1" name={`row-${props.index}-check`} onChange={(checked) => handleRowCheck(checked, props.index)} isChecked={checkedIndices.includes(props.index)} />
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`table-row-${props.index}-1`}>
              {props.recording.name}
            </DataListCell>,
            <DataListCell key={`table-row-${props.index}-2`}>
              <ISOTime timeStr={props.recording.startTime} />
            </DataListCell>,
            <DataListCell key={`table-row-${props.index}-3`}>
              <RecordingDuration duration={props.recording.duration} />
            </DataListCell>,
            // TODO make row expandable and render report in collapsed iframe
            <DataListCell key={`table-row-${props.index}-4`}>
              {props.recording.state}
            </DataListCell>
          ]}
        />
        <RecordingActions index={props.index} recording={props.recording} isOpen={props.index === openAction} setOpen={o => setOpenAction(o ? props.index : -1)} />
      </DataListItemRow>
    );
  };

  const ISOTime = (props) => {
    const fmt = new Date(props.timeStr).toISOString();
    return (<span>{fmt}</span>);
  };

  const RecordingDuration = (props) => {
    const str = props.duration === 0 ? 'Continuous' : `${props.duration / 1000}s`
    return (<span>{str}</span>);
  };

  const isStopDisabled = () => {
    if (!checkedIndices.length) {
      return true;
    }
    const filtered = recordings.filter((r: Recording, idx: number) => checkedIndices.includes(idx));
    const anyRunning = filtered.some((r: Recording) => r.state === RecordingState.RUNNING || r.state == RecordingState.STARTING);
    return !anyRunning;
  };

  const RecordingsToolbar = () => {
    const buttons = [
      <Button key="create" variant="primary" onClick={handleCreateRecording}>Create</Button>
    ];
    if (props.archiveEnabled) {
      buttons.push((
        <Button key="archive" variant="secondary" onClick={handleArchiveRecordings} isDisabled={!checkedIndices.length}>Archive</Button>
      ));
    }
    buttons.push((
      <Button key="stop" variant="tertiary" onClick={handleStopRecordings} isDisabled={isStopDisabled()}>Stop</Button>
    ));
    buttons.push((
      <Button key="delete" variant="danger" onClick={handleDeleteRecordings} isDisabled={!checkedIndices.length}>Delete</Button>
    ));

    return (
      <Toolbar id="active-recordings-toolbar">
        <ToolbarContent>
        {
          buttons.map((btn, idx) => (
              <ToolbarItem key={idx}>
                { btn }
              </ToolbarItem>
          ))
        }
        </ToolbarContent>
      </Toolbar>
    );
  };

  return (<>
    <RecordingsDataTable
        listTitle="Active Flight Recordings"
        toolbar={<RecordingsToolbar />}
        tableColumns={tableColumns}
        isHeaderChecked={headerChecked}
        onHeaderCheck={handleHeaderCheck}
    >
      {
        recordings.map((r, idx) => <RecordingRow key={idx} recording={r} index={idx}/>)
      }
    </RecordingsDataTable>
  </>);
};

export interface RecordingActionsProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  index: number;
  recording: Recording;
}

export const RecordingActions: React.FunctionComponent<RecordingActionsProps> = (props) => {
  const context = React.useContext(ServiceContext);
  const notifications = React.useContext(NotificationsContext);
  const [grafanaEnabled, setGrafanaEnabled] = React.useState(false);
  const [uploadIds, setUploadIds] = React.useState([] as string[]);

  React.useEffect(() => {
    const sub = context.commandChannel.grafanaDatasourceUrl()
      .pipe(first())
      .subscribe(() => setGrafanaEnabled(true));
    return () => sub.unsubscribe();
  }, [context.commandChannel]);

  React.useEffect(() => {
    const sub = context.commandChannel.onResponse('upload-recording')
      .pipe(
        filter(m => !!m.id && uploadIds.includes(m.id)),
        first()
      )
      .subscribe(resp => {
        const id = resp.id || '';
        setUploadIds(ids => [...ids.slice(0, ids.indexOf(id)), ...ids.slice(ids.indexOf(id) + 1, ids.length)]);
        if (resp.status === 0) {
          notifications.success('Upload Success', `Recording "${props.recording.name}" uploaded`);
          context.commandChannel.grafanaDashboardUrl().pipe(first()).subscribe(url => window.open(url, '_blank'));
        } else {
          notifications.danger('Upload Failed', `Recording "${props.recording.name}" could not be uploaded`);
        }
      });
    return () => sub.unsubscribe();
  }, [context.commandChannel, props.recording.name, notifications, uploadIds]);

  const grafanaUpload = () => {
    context.commandChannel.grafanaDatasourceUrl().pipe(first()).subscribe(url => {
      notifications.info('Upload Started', `Recording "${props.recording.name}" uploading...`);
      const id = context.commandChannel.createMessageId();
      setUploadIds(ids => [...ids, id]);
      context.commandChannel.sendMessage('upload-recording', [ props.recording.name, `${url}/load` ], id);
    });
  };

  const getActionItems = () => {
    const actionItems = [
      <DropdownItem key="download" component={
        <Text onClick={() => context.api.downloadRecording(props.recording)} >
          Download Recording
        </Text>
        }>
      </DropdownItem>,
      <DropdownItem key="report" component={
        <Text onClick={() => context.api.downloadReport(props.recording)} >
          Download Report
        </Text>
        }>
      </DropdownItem>
    ];
    if (grafanaEnabled) {
      actionItems.push(
        <DropdownItem key="grafana" component={
          <Text onClick={grafanaUpload} >
            View in Grafana ...
          </Text>
          }>
        </DropdownItem>
      );
    }
    return actionItems;
  };

  return (
    <DataListAction
      aria-labelledby={`dropdown-actions-item-${props.index} dropdown-actions-action-${props.index}`}
      id={`dropdown-actions-action-${props.index}`}
      aria-label="Actions"
    >
      <Dropdown
        isPlain
        position={DropdownPosition.right}
        isOpen={props.isOpen}
        onSelect={() => props.setOpen(!props.isOpen)}
        toggle={<KebabToggle onToggle={props.setOpen} />}
        dropdownItems={getActionItems()}
      />
    </DataListAction>
  );
};
