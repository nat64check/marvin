#------------------------------------------------
# Start with a separate image for building stuff
#------------------------------------------------
FROM centos:7 AS builder

# Add extra repositories that we need
RUN curl --silent --location https://rpm.nodesource.com/setup_9.x | bash -

# Install packages
RUN yum install -y nodejs make gcc-c++

# Add our sources and install all dependencies
COPY . /root/marvin/
RUN cd /root/marvin && npm install

#-------------------------------------
# Use the results for the final image
#-------------------------------------
FROM centos:7
LABEL maintainer="Sander Steffann <sander@steffann.nl>"
EXPOSE 3001

# Add extra repositories that we need
RUN yum install -y epel-release
RUN curl --silent --location https://rpm.nodesource.com/setup_9.x | bash -

# Puppeteer installs it's own Chromium, but we do need to install the dependencies
RUN yum install -y `yum deplist chromium chromium-common chromium-libs chromium-libs-media | awk '/provider:/ {print $2}' | fgrep -v chromium | sort -u`

# Install packages
RUN yum install -y nodejs httpie

# Add our sources and install all dependencies
COPY --from=builder /root/marvin/ /root/marvin/
RUN cd /root/marvin && npm install

# And we're ready to run Marvin
ENV HOME /root
WORKDIR /root/marvin
CMD ["/bin/node","main.js"]

# Let Marvin self-test regularly
HEALTHCHECK --timeout=5s --start-period=10s \
    CMD /root/marvin/scripts/healthcheck.sh
