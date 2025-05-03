# Example of containerized NodeJS Azure function

Microsoft documentation provides example how to create containerized Azure Function on [MS Learn](https://learn.microsoft.com/en-us/azure/azure-functions/functions-create-container-registry?tabs=acr%2Cbash&pivots=programming-language-typescript).

This repository contains that example and also some improved ways for build.

## TL;DR;

Most secure and efficient way to create NodeJS Azure function would be to build it with `esbuild` and create image with `containerify`.

This can be done by running `npm run containerify`.

## Initial cretion of function (MS Learn way)

```bash
func init --worker-runtime node --language typescript --docker
func new --name HttpExample --template "HTTP trigger"
docker image build --file Dockerfile -t testfunction:latest .
```

This results function image of whopping *3.73GB* size.

### Created layers

```
docker image history 198948d1e1f5
IMAGE          CREATED        CREATED BY                                      SIZE      COMMENT
198948d1e1f5   10 hours ago   RUN /bin/sh -c npm run build # buildkit         3.51kB    buildkit.dockerfile.v0
<missing>      10 hours ago   COPY . . # buildkit                             1.1GB     buildkit.dockerfile.v0
<missing>      10 hours ago   RUN /bin/sh -c npm install # buildkit           922MB     buildkit.dockerfile.v0
<missing>      11 hours ago   COPY package.json package.json # buildkit       551B      buildkit.dockerfile.v0
<missing>      11 hours ago   WORKDIR /home/site/wwwroot                      0B        buildkit.dockerfile.v0
<missing>      11 hours ago   ENV AzureWebJobsScriptRoot=/home/site/wwwroo…   0B        buildkit.dockerfile.v0
```

Image can be tested locally by running it and calling from other terminal:
```bash
docker run -p 8080:80 --rm -it testfunction:latest
# Other terminal
curl http://localhost:8080/api/HttpExample?name=Functions
```

### Disadvantages of initial function creation

- No `.dockerignore` to leave node_modules out from copy
- Single layer with `node_modules` twice
- `node_modules` with dev dependencies (twice)
- Requires Docker daemon (or similar usually privileged process) for build
- Slowish build (around 7.1 seconds)
- Runs as root

## Multistage build

First improvement would be to move multistage build according [Dockerfile.multistage](./Dockerfile.multistage).

When creating image with command `docker image build --file Dockerfile.multistage -t multistagetestfunction:latest .` resulted image with size *1.71GB*. With this accuracy size of the base image is *1.7GB*, so image would be quite efficient.

To be precise, content adds just around 2.1MB of content:

```bash
IMAGE          CREATED          CREATED BY                                      SIZE      COMMENT
8f3715338dd8   27 seconds ago   COPY /home/site/wwwroot/host.json /home/site…   288B      buildkit.dockerfile.v0
<missing>      27 seconds ago   COPY /home/site/wwwroot/package.json /home/s…   509B      buildkit.dockerfile.v0
<missing>      27 seconds ago   COPY /home/site/wwwroot/dist/ /home/site/www…   2.83kB    buildkit.dockerfile.v0
<missing>      27 seconds ago   COPY /home/site/wwwroot/node_modules/ /home/…   2.1MB     buildkit.dockerfile.v0
```

Image can be tested locally by running it and calling from other terminal:
```bash
docker run -p 8080:80 --rm -it multistagetestfunction:latest
# Other terminal
curl http://localhost:8080/api/HttpExample?name=Functions
```

### Disadvantages (still) with multistage build

- Requires Docker daemon (or similar usually privileged process) for build
- Slowish build (around 8 seconds)
- Runs as root

## Creating image without Docker daemon

While  Docker (or similar) capability to build the images is usually included in CI systems, it might not be always there. Also utilizing "real" image building with simple functions can easily create attack vectors and prevent the common way of doing things.

With Java ecosystem there's [Jib](https://github.com/GoogleContainerTools/jib) that offers very nicely reproducible creation of images, and prevents application teams to do suboptimal things within Dockerfiles.

With NodeJS there's couple of similar tooling available:
- [google/nodejs-container-image-builder](https://github.com/google/nodejs-container-image-builder) (last time modified 2 years ago, not good option)
- [containerify](https://github.com/eoftedal/containerify)

Using latter would allow easy way to create the images without offering too much possibilities to customize those. Example build can be made with:

```bash
npx containerify --file containerify.json 
```

Image can be tested locally by running it and calling from other terminal (this requires Docker, so image creation without Docker is more of CI thing and to produce common kind of images):

```bash
docker run -p 8080:80 --rm -it containerifyfunction:latest
# Other terminal
curl http://localhost:8080/api/HttpExample?name=Functions
```

### Disadvantages (still) with Containerify build

- Big image (*2.8GB*) due to node_modules
- Copies node_modules, which has to contain also dev dependencies due to Containerify
- Build takes around 7 seconds

## Building with Esbuild and creating image with Containerify

When replacing tsc with [esbuild](https://esbuild.github.io/) it would ba possible to create function completely to `dist` directory without need to worry about node_modules or state of the local environment. This allows to run static analysis, test etc. locally (or at the top of agent/runner/worker on CI) and then just include needed files easy way to image.

Creating image with esbuild and containerify:

```bash
npm run containerify
```

Image created can be tested with:

```bash
docker run -p 8080:80 --rm -it esbuildcontainerifyfunction:latest
# Other terminal
curl http://localhost:8080/api/HttpExample?name=Functions
```

### Advanteges of esbuild built function with containerify

- Extremely fast bundling (~0.3 seconds)
- Dist is ready to be included to image as-is with all the dependencies
- No need to run privileged processes
