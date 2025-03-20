#!/bin/bash

echo "启动人体研究问卷预览服务器..."
echo "访问地址: http://localhost:8000"
echo "按 Ctrl+C 终止服务器"
echo ""

# 确保我们在正确的目录
cd "$(dirname "$0")"

# 启动Python内置的HTTP服务器
python -m http.server 8000 