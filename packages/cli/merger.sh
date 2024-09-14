#!/bin/bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <fee-rate>"
    exit 1
fi

# Store the fee rate argument
fee_rate=$1

# Function to run the merge command
run_merge_command() {
    yarn cli merge -i 45ee725c2c5993b3e4d308842d87e973bf1951f5f7a804b21e4dd964ecd12d6b_0 --fee-rate "$fee_rate"
}

# Main loop
while true; do
    echo "Running merge command..."
    run_merge_command
    echo "Waiting for 10 seconds before next execution..."
    sleep 10
done
