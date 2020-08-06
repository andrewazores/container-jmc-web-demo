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
import { ServiceContext } from '@app/Shared/Services/Services';
import { EventTemplate } from '@app/Shared/Services/Api.service';
import { ActionGroup, Button, FileUpload, Form, FormGroup, Modal, ModalVariant, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem, TextInput } from '@patternfly/react-core';
import { PlusIcon } from '@patternfly/react-icons';
import { Table, TableBody, TableHeader, TableVariant, IAction, IRowData, IExtraData, ISortBy, SortByDirection, sortable } from '@patternfly/react-table';
import { useHistory } from 'react-router-dom';
import { concatMap, filter, first, map } from 'rxjs/operators';

export const EventTemplates = () => {
  const context = React.useContext(ServiceContext);
  const history = useHistory();

  const [templates, setTemplates] = React.useState([] as EventTemplate[]);
  const [filteredTemplates, setFilteredTemplates] = React.useState([] as EventTemplate[]);
  const [filterText, setFilterText] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState(undefined as File | undefined);
  const [uploadFilename, setUploadFilename] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [fileRejected, setFileRejected] = React.useState(false);
  const [sortBy, setSortBy] = React.useState({} as ISortBy);

  const tableColumns = [
    { title: 'Name', transforms: [ sortable ] },
    'Description',
    { title: 'Provider', transforms: [ sortable ] },
    { title: 'Type', transforms: [ sortable ] },
  ];

  React.useEffect(() => {
    let filtered;
    if (!filterText) {
      filtered = templates;
    } else {
      const ft = filterText.trim().toLowerCase();
      filtered = templates.filter((t: EventTemplate) => t.name.toLowerCase().includes(ft) || t.description.toLowerCase().includes(ft) || t.provider.toLowerCase().includes(ft));
    }
    const { index, direction } = sortBy;
    if (typeof index === 'number') {
      const keys = ['name', 'description', 'provider', 'type'];
      const key = keys[index];
      const sorted = filtered.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0));
      filtered = direction === SortByDirection.asc ? sorted : sorted.reverse();
    }
    setFilteredTemplates([...filtered]);
  }, [filterText, templates, sortBy]);

  const refreshTemplates = () => {
    context.target.target().pipe(concatMap(target => context.api.doGet<EventTemplate[]>(`targets/${encodeURIComponent(target)}/templates`))).subscribe(setTemplates);
  };

  React.useEffect(() => {
    refreshTemplates();
  }, [context.commandChannel]);

  const displayTemplates = React.useMemo(
    () => filteredTemplates.map((t: EventTemplate) => ([ t.name, t.description, t.provider, t.type.charAt(0).toUpperCase() + t.type.slice(1).toLowerCase() ])),
    [filteredTemplates]
  );

  const handleDelete = (rowData) => {
    context.api.deleteCustomEventTemplate(rowData[0]).subscribe(refreshTemplates);
  };

  const actionResolver = (rowData: IRowData, extraData: IExtraData) => {
    if (typeof extraData.rowIndex == 'undefined') {
      return [];
    }
    let actions = [
      {
        title: 'Create Recording...',
        onClick: (event, rowId, rowData) => history.push({ pathname: '/recordings/create', state: { template: rowData[0], templateType: String(rowData[3]).toUpperCase() } }),
      },
    ] as IAction[];

    const template: EventTemplate = filteredTemplates[extraData.rowIndex];
    if ((template.name !== 'ALL')||(template.type !== 'TARGET')) {
      actions = actions.concat([
          {
            title: 'Download',
            onClick: (event, rowId) => context.target.target().pipe(first()).subscribe(target => context.api.downloadTemplate(target, filteredTemplates[rowId])),
          }
      ]);
    };
    if (template.type === 'CUSTOM') {
      actions = actions.concat([
          {
            isSeparator: true,
          },
          {
            title: 'Delete',
            onClick: (event, rowId, rowData) => handleDelete(rowData)
          }
      ]);
    }
    return actions;
  };

  const handleModalToggle = () => {
    setModalOpen(v => {
      if (v) {
        setUploadFile(undefined);
        setUploadFilename('');
        setUploading(false);
      }
      return !v;
    });
  };

  const handleFileChange = (value, filename) => {
    setFileRejected(false);
    setUploadFile(value);
    setUploadFilename(filename);
  };

  const handleUploadSubmit = () => {
    if (!uploadFile) {
      window.console.error('Attempted to submit template upload without a file selected');
      return;
    }
    setUploading(true);
    context.api.addCustomEventTemplate(uploadFile).subscribe(success => {
      setUploading(false);
      if (success) {
        setUploadFile(undefined);
        setUploadFilename('');
        refreshTemplates();
        setModalOpen(false);
      }
    });
  };

  const handleUploadCancel = () => {
    setUploadFile(undefined);
    setUploadFilename('');
    setModalOpen(false);
  };

  const handleFileRejected = () => {
    setFileRejected(true);
  };

  const handleSort = (event, index, direction) => {
    setSortBy({ index, direction });
  };

  return (<>
    <Toolbar id="event-templates-toolbar">
      <ToolbarContent>
        <ToolbarGroup variant="filter-group">
          <ToolbarItem>
            <TextInput name="templateFilter" id="templateFilter" type="search" placeholder="Filter..." aria-label="Event template filter" onChange={setFilterText}/>
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup variant="icon-button-group">
          <ToolbarItem>
            <Button variant="plain" aria-label="add" onClick={handleModalToggle}><PlusIcon /></Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
    <Table aria-label="Event Templates table"
      variant={TableVariant.compact}
      cells={tableColumns}
      rows={displayTemplates}
      actionResolver={actionResolver}
      sortBy={sortBy}
      onSort={handleSort}
    >
      <TableHeader />
      <TableBody />
    </Table>

    <Modal
      isOpen={modalOpen}
      variant={ModalVariant.large}
      showClose={true}
      onClose={handleModalToggle}
      title="Create Custom Event Template"
      description="Create a customized event template. This is a specialized XML file with the extension .jfc, typically created using JDK Mission Control, which defines a set of events and their options to configure. Not all customized templates are applicable to all targets -- a template may specify a custom application event type, which is only available in targets running the associated application."
      >
      <Form>
        <FormGroup
          label="Template XML"
          isRequired
          fieldId="template"
          validated={fileRejected ? 'error' : 'default'}
        >
          <FileUpload
            id="template-file-upload"
            value={uploadFile}
            filename={uploadFilename}
            onChange={handleFileChange}
            isLoading={uploading}
            validated={fileRejected ? 'error' : 'default'}
            dropzoneProps={{
              accept: '.xml,.jfc',
              onDropRejected: handleFileRejected
            }}
          />
        </FormGroup>
        <ActionGroup>
          <Button variant="primary" onClick={handleUploadSubmit} isDisabled={!uploadFilename}>Submit</Button>
          <Button variant="link" onClick={handleUploadCancel}>Cancel</Button>
        </ActionGroup>
      </Form>
    </Modal>
  </>);

}
