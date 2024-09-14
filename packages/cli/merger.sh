#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 <fee-rate>"
    exit 1
fi

fee_rate=$1

run_merge_command() {
    yarn cli merge -i 45ee725c2c5993b3e4d308842d87e973bf1951f5f7a804b21e4dd964ecd12d6b_0 --fee-rate "$fee_rate"
}

while true; do
    echo "Running merge command..."
    output=$(run_merge_command)

    echo "$output"
    
    if echo "$output" | grep -q "Done merging tokens!"; then
        echo "Success message found. Stopping the loop."
        break
    fi
    
    echo "Waiting for 10 seconds before next execution..."
    sleep 10
done

echo "Script execution completed."