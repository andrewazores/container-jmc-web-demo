import * as React from 'react';
import { ApiService } from './Api.service';
import { CommandChannel } from './CommandChannel.service';

interface Services {
  api: ApiService;
  commandChannel: CommandChannel;
}

const api = new ApiService();
const commandChannel = new CommandChannel(api);

const defaultServices: Services = { api, commandChannel };

const ServiceContext: React.Context<Services> = React.createContext(defaultServices);

export { Services, ServiceContext, defaultServices };
