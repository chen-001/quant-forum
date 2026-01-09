#!/bin/bash
# 数据库备份脚本 - 每小时运行，保留最近50次备份

DB_PATH="/home/chenzongwei/quant-forum/data/forum.db"
BACKUP_DIR="/home/chenzongwei/forum_db_backup"
KEEP_COUNT=100

mkdir -p "$BACKUP_DIR"

# 使用时间戳创建备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/forum_$TIMESTAMP.db"

# 复制数据库文件
cp "$DB_PATH" "$BACKUP_FILE"

# 删除旧备份，保留最近50次
ls -t "$BACKUP_DIR"/forum_*.db | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm
