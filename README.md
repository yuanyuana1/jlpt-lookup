# JLPT Lookup - 日语划词查询工具

选中日语文本，一键查看 JLPT 释义、假名读音和语法分析。

## 授权与数据来源

本软件代码为商业专有软件。购买者获得个人使用许可，不获得源代码、修改、再分发或转售权；完整条款见 [LICENSE](LICENSE)。

词典数据的授权独立于软件代码。应用使用了 JMdict/EDRDG 词典数据，相关署名、许可与更新要求见 [DATA_SOURCES.md](DATA_SOURCES.md)。第三方软件许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 功能

- 🔍 系统级划词查询（Ctrl+Shift+J）
- 📖 显示单词释义和假名读音
- 🏷️ JLPT 等级标注（N5~N1）
- 📝 语法识别和解释
- 🔤 日语分词（基于 kuromoji）
- 💾 本地词典，离线可用

## 使用方法

1. 在任意位置选中日语文本并复制（Ctrl+C）
2. 按 `Ctrl+Shift+J` 触发查询
3. 弹窗显示查询结果

## 开发

```bash
# 安装依赖
npm install

# 启动应用
npm start
```

## 技术栈

- Electron - 桌面应用框架
- kuromoji - 日语形态分析/分词
- sql.js - SQLite 数据库（WASM 版本）

## 后续计划

- [ ] 导入完整 JMdict 词典
- [ ] 接入大模型 API 做语法分析
- [ ] 支持更多 JLPT 语法条目
- [ ] 添加生词本功能
- [ ] 支持 Anki 导出
