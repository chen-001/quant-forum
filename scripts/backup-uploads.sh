#!/bin/bash
# uploads 文件夹备份脚本 - 每小时检查并复制新文件

SOURCE_DIR="/home/chenzongwei/quant-forum/public/uploads"
BACKUP_DIR="/home/chenzongwei/forum_uploads_backup"

cd "$SOURCE_DIR"

# 遍历源目录所有文件，如果备份目录不存在则复制
find . -type f | while read -r file; do
    backup_file="$BACKUP_DIR/$file"
    if [ ! -f "$backup_file" ]; then
        mkdir -p "$(dirname "$backup_file")"
        cp "$file" "$backup_file"
    fi
done
