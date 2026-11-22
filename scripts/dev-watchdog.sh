#!/bin/zsh
# Runs `next dev` for spotlight/website under a guard: stops it once its process tree passes 4.5 GB of
# memory or after 3 hours, so a runaway Turbopack compile can't take the machine down.
cd "${0:A:h}/../spotlight/website" || exit 2
limit_kb=${DEV_RSS_LIMIT_KB:-4500000}
limit_s=${DEV_MAX_SECONDS:-10800}
node node_modules/next/dist/bin/next dev -p ${PORT:-3000} &
pid=$!
tree() { local c; for c in $(pgrep -P $1); do echo $c; tree $c; done }
stop() { local all=($pid $(tree $pid)); kill $all 2>/dev/null; sleep 2; kill -9 $all 2>/dev/null; }
trap 'stop; exit 0' INT TERM HUP
start=$SECONDS
while kill -0 $pid 2>/dev/null; do
  sleep 3
  all=($pid $(tree $pid))
  rss=$(ps -o rss= -p ${(j:,:)all} 2>/dev/null | awk '{s+=$1} END {print s+0}')
  if (( rss > limit_kb )); then echo "WATCHDOG: dev server at ${rss} KB, over ${limit_kb} KB; stopping it"; stop; exit 3; fi
  if (( SECONDS - start > limit_s )); then echo "WATCHDOG: dev server up ${limit_s}s; stopping it"; stop; exit 4; fi
done
wait $pid
