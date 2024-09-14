#!/bin/bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <fee-rate>"
    exit 1
fi

yarn build 

# Store the fee rate argument
fee_rate=$1

# Function to run the merge command
run_merge_command() {
    yarn cli merge -i 45ee725c2c5993b3e4d308842d87e973bf1951f5f7a804b21e4dd964ecd12d6b_0 --fee-rate "$fee_rate"
}

# Main loop
while true; do
    echo "Running merge command..."
    
    # Run the command and display output in real-time while also capturing it
    output=$(run_merge_command | tee >(cat - >&2))
    
    # Check if the output contains the success message
    if echo "$output" | grep -q "MERGING DONE"; then
        echo "Success message found. Stopping the loop."
        break
    fi
    
    echo "Waiting for 10 seconds before next execution..."
    sleep 60
done

echo "Script execution completed."