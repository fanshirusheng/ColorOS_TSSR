#!/system/bin/sh

# 配置文件路径
config_file="/data/adb/modules/ColorOS_Touch_Sampler/touch.conf"

# 触控采样率映射
declare -A sample_rate_map
sample_rate_map=(
    ["1"]=240
    ["12c"]=360
    ["258"]=600
)

# 监控进程的函数
monitor_game() {
    while true; do
        # 获取所有游戏包名的列表
        for game in $(cat $config_file); do
            # 提取包名和采样率
            package_name=$(echo $game | cut -d '=' -f 1)
            sample_rate=$(echo $game | cut -d '=' -f 2)

            # 如果采样率无效或未定义，默认为1
            if [ -z "${sample_rate_map[$sample_rate]}" ]; then
                sample_rate="1"
            fi

            # 获取对应的触控采样率值
            rate=${sample_rate_map[$sample_rate]}

            # 判断游戏是否正在运行
            if pgrep -f "$package_name" >/dev/null; then
                # 游戏正在运行，设置触控采样率
                touchHidlTest -c wo 0 26 "$rate"
                break
            fi
        done

        # 如果没有游戏运行，根据config.txt中的包名动态检查
        all_games=$(cat $config_file | cut -d '=' -f 1)  # 提取所有游戏包名
        package_running=false
        for game in $all_games; do
            if pgrep -f "$game" >/dev/null; then
                package_running=true
                break
            fi
        done

        if [ "$package_running" = false ]; then
            # 如果没有游戏运行，触控采样率设置为 0
            touchHidlTest -c wo 0 26 0
        fi

        # 每 30 秒检查一次
        sleep 30
    done
}

# 调用监控函数
monitor_game
