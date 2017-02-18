FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/uptime
WORKDIR /usr/src/uptime

# Install app dependencies
COPY package.json /usr/src/uptime
RUN npm install

# Bundle app source
COPY . /usr/src/uptime

EXPOSE 8082
CMD [ "npm", "start" ]
