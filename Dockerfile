# 多阶段构建 Dockerfile
# Stage 1: 构建阶段
FROM node:20-slim AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm ci

# 复制源代码
COPY client ./client
COPY server ./server

# 构建 client 和 server
RUN npm run build

# Stage 2: 运行阶段
FROM node:20-slim

# 安装 dumb-init 和 nginx 用于正确的信号处理和静态文件服务
RUN apt-get update && apt-get install -y dumb-init nginx && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# 只安装生产依赖
RUN npm ci --omit=dev

# 从构建阶段复制构建产物
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist

# 复制配置文件
COPY nginx.conf /etc/nginx/sites-enabled/default

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
# 80: nginx (统一入口，转发到 client 和 server)
EXPOSE 80

# 使用 dumb-init 启动，同时运行 server 和 nginx
CMD ["dumb-init", "sh", "-c", "nginx && npm run start -w server"]
