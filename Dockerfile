# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only manifest files first for better layer caching
COPY package*.json ./

# package-lock.json was generated on a glibc host; Alpine's musl libc
# needs a different set of optional platform-specific native binaries
# (e.g. @emnapi/core, pulled in transitively by an eslint devDependency),
# which trips `npm ci`'s strict lockfile check. `npm install` tolerates
# that reconciliation; `npm ci` does not.
RUN npm install

# Now copy source and build
COPY . .

RUN npm run build

# Prune dev dependencies out, leaving only what's needed at runtime
RUN npm prune --omit=dev


# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# Oracle Instant Client + native deps — thick-client mode. This resolves
# the Phase 0 open question (thick vs. thin): EDX_IMT runs thick mode, so
# database.config.ts / migrations.config.ts's initOracleClient() gate
# (NODE_ENV === 'production') now has a real LD_LIBRARY_PATH to find.
RUN apk --no-cache add libaio libnsl libc6-compat curl unzip && \
    curl -o /tmp/instantclient-basiclite-linuxx64.zip https://download.oracle.com/otn_software/linux/instantclient/211000/instantclient-basiclite-linux.x64-21.1.0.0.0.zip && \
    cd /tmp && \
    unzip instantclient-basiclite-linuxx64.zip && \
    mv instantclient_21_1/ /usr/lib/instantclient && \
    rm instantclient-basiclite-linuxx64.zip && \
    ln -s /usr/lib/instantclient/libclntsh.so.21.1 /usr/lib/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.21.1 /usr/lib/libocci.so && \
    ln -s /usr/lib/instantclient/libociicus.so /usr/lib/libociicus.so && \
    ln -s /usr/lib/instantclient/libnnz21.so /usr/lib/libnnz21.so && \
    ln -s /usr/lib/libnsl.so.2 /usr/lib/libnsl.so.1 && \
    ln -s /lib/libc.so.6 /usr/lib/libresolv.so.2 && \
    ln -s /lib64/ld-linux-x86-64.so.2 /usr/lib/ld-linux-x86-64.so.2 && \
    apk del curl unzip

ENV ORACLE_BASE=/usr/lib/instantclient \
    LD_LIBRARY_PATH=/usr/lib/instantclient \
    TNS_ADMIN=/usr/lib/instantclient \
    ORACLE_HOME=/usr/lib/instantclient \
    NODE_ENV=production

# Copy built app + pruned node_modules from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Run as non-root
RUN addgroup -S imt && adduser -S imt -G imt
USER imt

EXPOSE 3000

CMD ["node", "dist/main.js"]