# Container-JFR-Web

Web front-end for container-jfr, providing a graphical user interface for managing JFR on remote JVMs.

Based on [Patternfly React Seed](https://github.com/patternfly/patternfly-react-seed).

## Development Scripts

Install development/build dependencies
`npm install`

Start the development server
`npm run start:dev`

Run a production build
`npm run build`

Run the test suite
`npm run test`

Run the linter
`npm run lint`

Run the code formatter
`npm run format`

Launch a tool to inspect the bundle size
`npm run bundle-profile:analyze`

Start the express server (run a production build first)
`npm run start`

## Development server

First run a `container-jfr` instance with WebSocket communication and CORS enabled. 
The environment variable `CONTAINER_JFR_CORS_ORIGIN` enables CORS and sets its origin to the value provided.
For example:

`cd $CONTAINER_JFR_DIR && CONTAINER_JFR_CORS_ORIGIN=http://localhost:9000 sh run.sh`

Then run `npm run start:dev` to start a hot-reloading WebServer instance of the `-web` UI, which will by default target the `container-jfr` instance started above. This can be customized by editing the `.env` file, for example if you have another service already listening on the default port `8181` and your ContainerJFR is listening elsewhere.
