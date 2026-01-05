# Vidora

<div align="center">
  <img src="public/logo.png" alt="Vidora Logo" width="120">
</div>

> 🎬 **Vidora** 是基于 [MoonTV](https://github.com/MoonTechLab/LunaTV) 的二次开发项目，保留了原有的核心功能并进行了负优化自适用改进。它基于 **Next.js 14** + **Tailwind&nbsp;CSS** + **TypeScript** 构建，支持多源聚合搜索、在线播放、收藏同步、播放记录、云端存储。

**原始项目地址**：[MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV)

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker Ready](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

</div>

---

## ✨ 功能特性

- 🔍 **多源搜索**：聚合多个影视资源站点，一次搜索返回全部结果
- 📺 **直播功能**：支持电视直播源观看
- 🎬 **豆瓣集成**：热门电影、电视剧、综艺推荐，发布日历
- 📱 **TVBox 支持**：支持Token 认证，数组和配置文件格式导出等
- ▶️ **在线播放**：HLS.js + ArtPlayer，支持多种视频格式
- ❤️ **数据同步**：收藏、播放记录、观看进度云端同步
- ⏭️ **智能跳过**：自动跳过片头片尾，可自定义时间
- 👤 **用户系统**：注册登录，个人数据管理
- 📊 **播放统计**：观看时长、历史记录分析
- 🔧 **后台管理**：站点配置、用户管理、数据导入导出

### 注意：部署后项目为空壳项目，无内置播放源和直播源，需要自行收集

<details>
  <summary>点击查看项目截图</summary>
  <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px">
</details>

### 请不要在 B 站、小红书、微信公众号、抖音、今日头条或其他中国大陆社交平台发布视频或文章宣传本项目，不授权任何“科技周刊/月刊”类项目或站点收录本项目。

## 🗺 目录

- [技术栈](#技术栈)
- [部署](#部署)
- [配置文件](#配置文件)
- [自动更新](#自动更新)
- [环境变量](#环境变量)
- [AndroidTV 使用](#AndroidTV-使用)
- [Roadmap](#roadmap)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 技术栈

| 分类      | 主要依赖                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 前端框架  | [Next.js 14](https://nextjs.org/) · App Router                                                        |
| UI & 样式 | [Tailwind&nbsp;CSS 3](https://tailwindcss.com/)                                                       |
| 语言      | TypeScript 4                                                                                          |
| 播放器    | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| 代码质量  | ESLint · Prettier · Jest                                                                              |
| 部署      | Docker                                                                                                |

## 部署

本项目**仅支持 Docker 或其他基于 Docker 的平台** 部署。

### Kvrocks 存储（推荐）

```yml
services:
  vidora-core:
    image: ghcr.io/moontechlab/lunatv:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://vidora-kvrocks:6666
      - AUTH_TOKEN=授权码
    networks:
      - vidora-network
    depends_on:
      - vidora-kvrocks
  vidora-kvrocks:
    image: apache/kvrocks
    container_name: vidora-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - vidora-network
networks:
  vidora-network:
    driver: bridge
volumes:
  kvrocks-data:
```

### Redis 存储（有一定的丢数据风险）

```yml
services:
  vidora-core:
    image: ghcr.io/moontechlab/lunatv:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://vidora-redis:6379
      - AUTH_TOKEN=授权码
    networks:
      - vidora-network
    depends_on:
      - vidora-redis
  vidora-redis:
    image: redis:alpine
    container_name: vidora-redis
    restart: unless-stopped
    networks:
      - vidora-network
    # 请开启持久化，否则升级/重启后数据丢失
    volumes:
      - ./data:/data
networks:
  vidora-network:
    driver: bridge
```

### Upstash 存储

1. 在 [upstash](https://upstash.com/) 注册账号并新建一个 Redis 实例，名称任意。
2. 复制新数据库的 **HTTPS ENDPOINT 和 TOKEN**
3. 使用如下 docker compose

```yml
services:
  vidora-core:
    image: ghcr.io/moontechlab/lunatv:latest
    container_name: vidora-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=上面 https 开头的 HTTPS ENDPOINT
      - UPSTASH_TOKEN=上面的 TOKEN
      - AUTH_TOKEN=授权码
```

## 配置文件

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置中填写配置文件（后续会支持订阅）

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ]
}
```

- `cache_time`：接口缓存时间（秒）。
- `api_site`：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- `custom_category`：自定义分类配置，用于在导航中添加个性化的影视分类。以 type + query 作为唯一标识。支持以下字段：
  - `name`：分类显示名称（可选，如不提供则使用 query 作为显示名）
  - `type`：分类类型，支持 `movie`（电影）或 `tv`（电视剧）
  - `query`：搜索关键词，用于在豆瓣 API 中搜索相关内容

custom_category 支持的自定义分类已知如下：

- movie：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈
- tv：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

也可输入如 "哈利波特" 效果等同于豆瓣搜索

Vidora 支持标准的苹果 CMS V10 API 格式。

## 自动更新

可借助 [watchtower](https://github.com/containrrr/watchtower) 自动更新镜像容器

dockge/komodo 等 docker compose UI 也有自动更新功能

## 环境变量

| 变量                                | 说明                     | 可选值                   | 默认值                                                                                                                     |
| ----------------------------------- | ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| USERNAME                            | 站长账号                 | 任意字符串               | 无默认，必填字段                                                                                                           |
| PASSWORD                            | 站长密码                 | 任意字符串               | 无默认，必填字段                                                                                                           |
| SITE_BASE                           | 站点 url                 | 形如 https://example.com | 空                                                                                                                         |
| NEXT_PUBLIC_SITE_NAME               | 站点名称                 | 任意字符串               | Vidora                                                                                                                     |
| ANNOUNCEMENT                        | 站点公告                 | 任意字符串               | 本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。 |
| NEXT_PUBLIC_STORAGE_TYPE            | 播放记录/收藏的存储方式  | redis、kvrocks、upstash  | 无默认，必填字段                                                                                                           |
| KVROCKS_URL                         | kvrocks 连接 url         | 连接 url                 | 空                                                                                                                         |
| REDIS_URL                           | redis 连接 url           | 连接 url                 | 空                                                                                                                         |
| UPSTASH_URL                         | upstash redis 连接 url   | 连接 url                 | 空                                                                                                                         |
| UPSTASH_TOKEN                       | upstash redis 连接 token | 连接 token               | 空                                                                                                                         |
| NEXT_PUBLIC_SEARCH_MAX_PAGE         | 搜索接口可拉取的最大页数 | 1-50                     | 5                                                                                                                          |
| NEXT_PUBLIC_DOUBAN_PROXY_TYPE       | 豆瓣数据源请求方式       | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_PROXY            | 自定义豆瓣数据代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE | 豆瓣图片代理类型         | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY      | 自定义豆瓣图片代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DISABLE_YELLOW_FILTER   | 关闭色情内容过滤         | true/false               | false                                                                                                                      |
| NEXT_PUBLIC_FLUID_SEARCH            | 是否开启搜索接口流式输出 | true/ false              | true                                                                                                                       |

NEXT_PUBLIC_DOUBAN_PROXY_TYPE 选项解释：

- direct: 由服务器直接请求豆瓣源站
- cors-proxy-zwei: 浏览器向 cors proxy 请求豆瓣数据，该 cors proxy 由 [Zwei](https://github.com/bestzwei) 搭建
- cmliussss-cdn-tencent: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_PROXY 定义

NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE 选项解释：

- direct：由浏览器直接请求豆瓣分配的默认图片域名
- server：由服务器代理请求豆瓣分配的默认图片域名
- img3：由浏览器请求豆瓣官方的精品 cdn（阿里云）
- cmliussss-cdn-tencent：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_IMAGE_PROXY 定义

## 安全与隐私提醒

### 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：

### 部署要求

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规

### 重要声明

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明

## License

[MIT](LICENSE) © 2025 Vidora & Contributors

## 致谢

- [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV) — 原始项目仓库
- [MoonTV](https://github.com/SzeMeng76/LunaTV) — 隐藏的小黄人
- [ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter) — 项目脚手架
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 网页视频播放器
- [HLS.js](https://github.com/video-dev/hls.js) — HLS 流媒体播放支持
- [Zwei](https://github.com/bestzwei) — 豆瓣数据 cors proxy
- [CMLiussss](https://github.com/cmliu) — 豆瓣 CDN 服务

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)
