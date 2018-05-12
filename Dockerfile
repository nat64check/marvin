FROM centos:7

LABEL maintainer="Sander Steffann <sander@steffann.nl>"

EXPOSE 3001

RUN yum install -y epel-release
RUN curl --silent --location https://rpm.nodesource.com/setup_9.x | bash -
RUN yum install -y nodejs chromium httpie
ADD * /root/marvin/
RUN cd /root/marvin && npm install
RUN rm -rf /var/cache/yum /root/.npm

ENV HOME /root
WORKDIR /root/marvin
CMD ["/bin/node","main.js"]

HEALTHCHECK --timeout=5s --start-period=10s \
    CMD /root/marvin/scripts/healthcheck.sh
