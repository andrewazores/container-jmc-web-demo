import * as React from 'react';
import { distinctUntilChanged, filter, first } from 'rxjs/operators';
import { Card, CardBody, CardHeader, Grid, GridItem, PageSection, Select, SelectOption, SelectVariant, Text, TextVariants, Title } from '@patternfly/react-core';
import { ContainerNodeIcon } from '@patternfly/react-icons';
import { ServiceContext } from '@app/Shared/Services/Services';

export interface TargetSelectProps {
  isCompact?: boolean;
  allowDisconnect?: boolean;
}

interface Target {
  connectUrl: string;
  alias: string;
  port: number;
}

export const TargetSelect = (props: TargetSelectProps) => {
  const context = React.useContext(ServiceContext);
  const [selected, setSelected] = React.useState('');
  const [targets, setTargets] = React.useState([]);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    const sub = context.commandChannel.onResponse('scan-targets').subscribe(msg => setTargets(msg.payload));
    return () => sub.unsubscribe();
  }, []);

  React.useEffect(() => {
    const sub = context.commandChannel.onResponse('connect').pipe(filter(m => m.status === 0)).subscribe(m => setSelected(m.payload));
    return () => sub.unsubscribe();
  }, []);

  React.useEffect(() => {
    const sub = context.commandChannel.isReady()
      .pipe(filter(v => !!v), first())
      .subscribe(() => context.commandChannel.sendMessage('scan-targets', []));
    return () => sub.unsubscribe();
  }, []);

  React.useEffect(() => {
    const sub = context.commandChannel.onResponse('is-connected').pipe(distinctUntilChanged()).subscribe(connection => {
      const msg = connection.payload;
      if (msg == 'false') {
        setSelected('');
      } else {
        setSelected(msg);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  React.useEffect(() => {
    const sub = context.commandChannel.isReady().pipe(filter(v => v!!), first()).subscribe(() => {
      context.commandChannel.sendMessage('is-connected');
    });
    return () => sub.unsubscribe();
  }, []);

  const connect = (target: Target) => {
    context.commandChannel.sendMessage('connect', [ `${target.connectUrl}:${target.port}` ]);
  };

  const disconnect = () => {
    setSelected('');
    context.commandChannel.sendMessage('disconnect');
  };

  const onSelect = (evt, selection, isPlaceholder) => {
    if (isPlaceholder) {
      disconnect();
    } else {
      connect(selection);
    }
    // FIXME setting the expanded state to false seems to cause an "unmounted component" error
    // in the browser console
    setExpanded(false);
  };

  return (<>
      <Grid>
        <GridItem span={props.isCompact ? 2 : 8}>
          <Card>
            <CardHeader>
              <Text component={TextVariants.h4}>
                Target JVM
              </Text>
            </CardHeader>
            <CardBody>
              <Select
                toggleIcon={<ContainerNodeIcon />}
                variant={SelectVariant.single}
                selections={selected}
                onSelect={onSelect}
                onToggle={setExpanded}
                isExpanded={expanded}
                aria-label="Select Input"
              >
              {
                (props.allowDisconnect ? [<SelectOption key='placeholder' value='Select Target...' isPlaceholder={true} />] : [])
                  .concat(
                    targets.map((t: Target) => (
                      <SelectOption
                        key={t.connectUrl}
                        value={t}
                        isPlaceholder={false}
                      >{`${t.alias} (${t.connectUrl}:${t.port})`}</SelectOption>
                    ))
                )
              }
              </Select>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
  </>);

}
