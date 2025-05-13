#!/system/bin/sh

log_file="/cache/touch_optimizer.log"
echo "启动触控优化守护进程..." > "$log_file"

# 游戏进程匹配（多个包名之间用|分隔）
game_regex="com.pubg.krmobile|com.tencent.ig|com.tencent.tmgp.pubgmhd|com.tencent.tmgp.sgame|com.tencent.tmgp.cod|com.tencent.tmgp.cf|com.miHoYo.ys.mi|com.tencent.KiHan|com.miHoYo.bh3.huawei|com.hypergryph.arknights|com.PigeonGames.Phigros"

# 用于记录当前正在监控的游戏进程 PID（每行一个）
monitored_pids="/cache/monitored_pids.tmp"
> "$monitored_pids"

optimization_on=0

monitor_pid() {
    pid="$1"
    pkg="$2"
    # 等待进程退出
    inotifywait -e delete "/proc/$pid" >/dev/null 2>&1
    echo "$(date) - 触控优化：进程退出（$pkg, PID: $pid）" >> "$log_file"
    sed -i "/^$pid$/d" "$monitored_pids"
}

while true; do
    # 检查当前所有匹配的游戏进程
    for pid in $(pgrep -f "$game_regex"); do
        if ! grep -q "^$pid$" "$monitored_pids"; then
            echo "$pid" >> "$monitored_pids"
            pkg=$(ps -p "$pid" -o cmd=)
            echo "$(date) - 新检测到游戏进程：$pkg, PID: $pid" >> "$log_file"
            monitor_pid "$pid" "$pkg" &
        fi
    done

    # 根据监控列表判断是否需要开启或关闭触控优化
    if [ -s "$monitored_pids" ]; then
        if [ $optimization_on -eq 0 ]; then
            touchHidlTest -c wo 0 26 12c
            echo "$(date) - 触控优化：开启" >> "$log_file"
            optimization_on=1
        fi
    else
        if [ $optimization_on -eq 1 ]; then
            touchHidlTest -c wo 0 26 0
            echo "$(date) - 触控优化：关闭" >> "$log_file"
            optimization_on=0
        fi
    fi

    sleep 15
done
