# SuperMP3

SuperMP3 是一个使用 Tauri + 原生 HTML/CSS/JavaScript 开发的音频转换工具，支持从视频文件中提取并转换音频。

## 功能特性

- 支持从视频文件(MP4, MKV, AVI)中提取音频
- 支持多种音频输出格式(MP3, AAC, WAV, FLAC)
- 支持批量转换
- 支持设置音频截取时间段
- 支持设置音频元数据(标题、艺术家)
- 支持自定义输出目录
- 支持音频质量设置(比特率、采样率等)

## 开发环境要求

- [Node.js](https://nodejs.org/) (推荐 v18 或更高版本)
- [Rust](https://www.rust-lang.org/) (最新稳定版)
- [VS Code](https://code.visualstudio.com/) (推荐)
- FFmpeg (用于音频处理)

### 推荐的 VS Code 插件

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 安装说明

1. 克隆项目
```bash
git clone <repository-url>
cd SuperMP3
```

2. 安装依赖
```bash
# 安装 Rust 依赖
cd src-tauri
cargo check

# 安装前端依赖
cd ..
npm install
```

3. 开发运行
```bash
npm run tauri dev
```

4. 构建应用
```bash
npm run tauri build
```

## 使用说明

1. 点击"添加视频"选择要处理的视频文件
2. 设置音频截取时间段(可选)
3. 填写音频标题和艺术家信息
4. 选择输出格式
5. 设置输出目录(可选)
6. 点击"开始转换"进行处理

## 目录结构

```
SuperMP3/
├── src/                # 前端源码
├── src-tauri/         # Rust 后端源码
├── public/            # 静态资源
└── ...
```

## License

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request。
