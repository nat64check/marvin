#------------------------------------------------
# Start with a separate image for building stuff
#------------------------------------------------
FROM centos:7 AS builder

# Add extra repositories that we need
RUN curl --silent --location https://rpm.nodesource.com/setup_9.x | bash -

# Install packages
RUN yum install -y nodejs make gcc-c++

# Add our package info and install all dependencies
COPY package.json /root/marvin/
COPY package-lock.json /root/marvin/
RUN cd /root/marvin && npm install

#-------------------------------------
# Use the results for the final image
#-------------------------------------
FROM centos:7
LABEL maintainer="Sander Steffann <sander@steffann.nl>"
EXPOSE 3001

# Add extra repositories that we need
RUN yum install -y epel-release \
 && curl --silent --location https://rpm.nodesource.com/setup_9.x | bash - \
 \
 # Puppeteer installs it's own Chromium, but we do need to install the dependencies
 && yum install -y `yum deplist chromium chromium-common chromium-libs chromium-libs-media | awk '/provider:/ {print $2}' | fgrep -v chromium | sort -u` \
 \
 # Install packages
 && yum install -y nodejs httpie curl cabextract xorg-x11-font-utils fontconfig \
 \
 # Install base fonts
 && yum install -y https://downloads.sourceforge.net/project/mscorefonts2/rpms/msttcore-fonts-installer-2.6-1.noarch.rpm

# Get our dependencies from builder and add our own sources
COPY --from=builder /root/marvin/ /root/marvin/
COPY . /root/marvin/

# And we're ready to run Marvin
ENV HOME /root
WORKDIR /root/marvin
CMD ["/bin/node","main.js"]

# Let Marvin self-test regularly
HEALTHCHECK --timeout=5s --start-period=10s \
    CMD /root/marvin/scripts/healthcheck.sh
